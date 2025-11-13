import type { Task } from "../../hooks/useLocalTasks";
import type {
  EntropySample,
  ObserverEngineSnapshot,
  ObserverEvent,
  ObserverInsight,
  TaskSignal,
} from "./types";

type EntropyListener = (sample: EntropySample) => void;
type InsightListener = (insights: ObserverInsight[]) => void;

const ENTROPY_DECAY = 0.015;
const HEAT_DECAY = 0.01;
const HOT_THRESHOLD = 0.68;
const ENTROPY_ALERT = 0.72;
const DRIFT_ALERT = 0.55;
const TICK_MS = 1200;

export class ObserverEngineCore {
  private signals = new Map<string, TaskSignal>();
  private entropySubscribers = new Map<string, Set<EntropyListener>>();
  private insightSubscribers = new Set<InsightListener>();
  private insights: ObserverInsight[] = [];
  private running = false;
  private tickTimer: number | null = null;
  private lastTimestamp = Date.now();
  private insightCooldown = new Map<string, number>();
  private constellations: Array<{ id: string; memberIds: string[]; suggestedName?: string }> = [];

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTimestamp = Date.now();
    this.scheduleTick();
  }

  stop() {
    this.running = false;
    if (this.tickTimer !== null && typeof window !== "undefined") {
      window.clearInterval(this.tickTimer);
    }
    this.tickTimer = null;
  }

  syncTasks(tasks: Task[]) {
    tasks.forEach((task) => {
      const existing = this.signals.get(task.id);
      if (existing) {
        existing.title = task.title;
        existing.status = task.status;
        return;
      }
      this.signals.set(task.id, {
        taskId: task.id,
        title: task.title,
        status: task.status,
        touches: 0,
        entropy: 0.32,
        heat: task.status === "IN PROGRESS" ? 0.55 : 0.3,
        drift: 0.25,
        momentum: task.status === "IN PROGRESS" ? 0.4 : 0.2,
        lastTouchedAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
  }

  ingestEvent(event: ObserverEvent) {
    if (!event) return;
    const now = event.timestamp ?? Date.now();
    if (event.type === "session_tick") {
      this.sample(now);
      return;
    }
    if (event.type === "constellation_snapshot") {
      const list = Array.isArray(event.payload?.constellations)
        ? (event.payload?.constellations as Array<{ id: string; memberIds: string[]; suggestedName?: string }>)
        : [];
      this.constellations = list;
      this.evaluateConstellations();
      return;
    }
    if (!event.taskId) return;
    const signal = this.ensureSignal(event.taskId);
    switch (event.type) {
      case "task_touch":
        signal.touches += 1;
        signal.lastTouchedAt = now;
        signal.heat = Math.min(1, signal.heat + 0.12);
        signal.momentum = Math.min(1, signal.momentum + 0.08);
        break;
      case "drag_move":
        signal.drift = Math.min(1, signal.drift + 0.05);
        signal.momentum = Math.min(1, signal.momentum + 0.04);
        break;
      case "heat_sample":
        signal.heat = Math.min(1, Math.max(0, Number(event.payload?.value) || signal.heat));
        break;
      default:
        break;
    }
    signal.updatedAt = now;
    this.evaluateSignal(signal);
    this.notifyEntropy(signal);
  }

  subscribeEntropy(taskId: string, listener: EntropyListener): () => void {
    if (!taskId) return () => undefined;
    const listeners = this.entropySubscribers.get(taskId) ?? new Set<EntropyListener>();
    listeners.add(listener);
    this.entropySubscribers.set(taskId, listeners);
    const sample = this.getEntropySample(taskId);
    if (sample) {
      listener(sample);
    }
    return () => {
      const next = this.entropySubscribers.get(taskId);
      next?.delete(listener);
      if (next && next.size === 0) {
        this.entropySubscribers.delete(taskId);
      }
    };
  }

  subscribeInsights(listener: InsightListener): () => void {
    this.insightSubscribers.add(listener);
    listener(this.insights.slice());
    return () => {
      this.insightSubscribers.delete(listener);
    };
  }

  getEntropySample(taskId: string): EntropySample | null {
    const signal = this.signals.get(taskId);
    if (!signal) return null;
    return {
      taskId,
      entropy: signal.entropy,
      heat: signal.heat,
      updatedAt: signal.updatedAt,
    };
  }

  getSnapshot(): ObserverEngineSnapshot {
    return {
      signals: new Map(this.signals),
      insights: this.insights.slice(),
    };
  }

  private scheduleTick() {
    if (typeof window === "undefined") return;
    this.tickTimer = window.setInterval(() => {
      this.sample(Date.now());
    }, TICK_MS);
  }

  private sample(timestamp: number) {
    const delta = (timestamp - this.lastTimestamp) / 1000;
    if (!Number.isFinite(delta) || delta <= 0) {
      this.lastTimestamp = timestamp;
      return;
    }
    this.lastTimestamp = timestamp;
    this.signals.forEach((signal) => {
      const heatLoss = HEAT_DECAY * delta;
      signal.heat = Math.max(0, signal.heat - heatLoss);
      const entropyGain = ENTROPY_DECAY * delta + (signal.heat > 0.5 ? 0.005 : 0);
      signal.entropy = Math.max(0, Math.min(1, signal.entropy + entropyGain));
      if (timestamp - signal.lastTouchedAt > 1000 * 60 * 60 * 6) {
        signal.entropy = Math.min(1, signal.entropy + 0.02);
      }
      signal.drift = Math.max(0.12, Math.min(1, signal.drift * 0.995));
      signal.momentum = Math.max(0.1, signal.momentum * 0.992);
      signal.updatedAt = timestamp;
      this.evaluateSignal(signal);
      this.notifyEntropy(signal);
    });
  }

  private notifyEntropy(signal: TaskSignal) {
    const listeners = this.entropySubscribers.get(signal.taskId);
    if (!listeners || listeners.size === 0) return;
    const sample = this.getEntropySample(signal.taskId);
    if (!sample) return;
    listeners.forEach((listener) => listener(sample));
  }

  private evaluateSignal(signal: TaskSignal) {
    const now = Date.now();
    const keyEntropy = `${signal.taskId}:entropy`;
    const keyDrift = `${signal.taskId}:drift`;
    const keyHeat = `${signal.taskId}:heat`;
    if (signal.entropy > ENTROPY_ALERT && this.isCooldownComplete(keyEntropy, now)) {
      this.pushInsight({
        id: createId(),
        kind: "entropy-spike",
        summary: `${signal.title || "Task"} is destabilizing.`,
        detail: "Entropy climbing past safe thresholds.",
        confidence: signal.entropy,
        taskIds: [signal.taskId],
        createdAt: now,
        data: { entropy: signal.entropy },
      });
      this.insightCooldown.set(keyEntropy, now);
    }
    if (signal.drift > DRIFT_ALERT && this.isCooldownComplete(keyDrift, now)) {
      this.pushInsight({
        id: createId(),
        kind: "drift",
        summary: `${signal.title || "Task"} is drifting outward.`,
        confidence: signal.drift,
        taskIds: [signal.taskId],
        createdAt: now,
        data: { drift: signal.drift },
      });
      this.insightCooldown.set(keyDrift, now);
    }
    if (signal.heat > HOT_THRESHOLD && now - signal.lastTouchedAt > 1000 * 60 * 60 && this.isCooldownComplete(keyHeat, now)) {
      this.pushInsight({
        id: createId(),
        kind: "heat-neglect",
        summary: `${signal.title || "Task"} burns while ignored.`,
        detail: "High heat but long neglect window detected.",
        confidence: signal.heat,
        taskIds: [signal.taskId],
        createdAt: now,
        data: {
          heat: signal.heat,
          lastTouchedAt: signal.lastTouchedAt,
        },
      });
      this.insightCooldown.set(keyHeat, now);
    }
  }

  private pushInsight(insight: ObserverInsight) {
    this.insights = [insight, ...this.insights].slice(0, 50);
    this.insightSubscribers.forEach((listener) => {
      listener(this.insights.slice());
    });
  }

  private ensureSignal(taskId: string): TaskSignal {
    let signal = this.signals.get(taskId);
    if (signal) return signal;
    signal = {
      taskId,
      title: "Untitled",
      status: "TO-DO",
      touches: 0,
      entropy: 0.35,
      heat: 0.25,
      drift: 0.2,
      momentum: 0.2,
      lastTouchedAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.signals.set(taskId, signal);
    return signal;
  }

  private isCooldownComplete(key: string, now: number): boolean {
    const last = this.insightCooldown.get(key);
    if (!last) return true;
    return now - last > 1000 * 60 * 20;
  }

  private evaluateConstellations() {
    if (!this.constellations.length) return;
    const dominant = this.constellations.reduce((prev, current) =>
      current.memberIds.length > prev.memberIds.length ? current : prev
    );
    const key = `constellation:${dominant.id}`;
    if (!this.isCooldownComplete(key, Date.now())) return;
    this.pushInsight({
      id: createId(),
      kind: "observation",
      summary: `${dominant.suggestedName ?? "Constellation"} needs focus.`,
      detail: "Multiple tethered tasks want to move together.",
      confidence: Math.min(1, dominant.memberIds.length / 6),
      taskIds: dominant.memberIds.slice(0, 4),
      createdAt: Date.now(),
      data: { constellationId: dominant.id },
    });
    this.insightCooldown.set(key, Date.now());
  }
}

let singleton: ObserverEngineCore | null = null;

export const getObserverEngine = (): ObserverEngineCore => {
  if (!singleton) {
    singleton = new ObserverEngineCore();
  }
  return singleton;
};

const createId = (): string =>
  `obs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
