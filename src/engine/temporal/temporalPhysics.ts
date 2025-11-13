import type { Task } from "../../hooks/useLocalTasks";
import type { CelestialKind, TemporalBody, TemporalEvent, TemporalSnapshot } from "./types";

const BASE_HEAT: Record<string, number> = {
  "TO-DO": 0.32,
  "IN PROGRESS": 0.58,
  DONE: 0.25,
};
const KIND_MAP: Record<Task["status"], TemporalBody["kind"]> = {
  "TO-DO": "asteroid",
  "IN PROGRESS": "sun",
  DONE: "moon",
};

const HEAT_DECAY = 0.006;
const ENTROPY_GAIN = 0.004;
const MOMENTUM_DECAY = 0.003;
const DRIFT_GAIN = 0.002;
const TOUCH_HEAT = 0.15;
const TOUCH_MOMENTUM = 0.1;
const TOUCH_ENTROPY = -0.08;

const rand = (seed: number): number => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));

const randomPosition = (index: number): { position: { x: number; y: number }; theta: number } => {
  const angle = rand(index + 1) * Math.PI * 2;
  const radius = 120 + rand(index + 2) * 220;
  return {
    position: { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius },
    theta: angle,
  };
};

export class TemporalPhysicsEngine {
  private bodies = new Map<string, TemporalBody>();
  private lastTick = Date.now();
  private raf: number | null = null;
  private listeners = new Set<(snapshot: TemporalSnapshot) => void>();
  private running = false;

  syncTasks(tasks: Task[]) {
    tasks.forEach((task, index) => {
      const existing = this.bodies.get(task.id);
      if (existing) {
        existing.title = task.title;
        existing.status = task.status;
        existing.kind = KIND_MAP[task.status] ?? existing.kind;
        return;
      }
      const baseHeat = BASE_HEAT[task.status] ?? 0.3;
      const { position, theta } = randomPosition(index);
      const body: TemporalBody = {
        id: task.id,
        title: task.title,
        status: task.status,
        kind: KIND_MAP[task.status] ?? "asteroid",
        heat: baseHeat,
        entropy: 0.35,
        drift: 0.25,
        momentum: task.status === "IN PROGRESS" ? 0.42 : 0.18,
        position,
        velocity: { x: 0, y: 0 },
        orbitRadius: Math.hypot(position.x, position.y),
        orbitTheta: theta,
        lastUpdate: Date.now(),
        lastTouchedAt: Date.now(),
      };
      this.bodies.set(task.id, body);
    });
    const ids = new Set(tasks.map((task) => task.id));
    Array.from(this.bodies.keys()).forEach((id) => {
      if (!ids.has(id)) {
        this.bodies.delete(id);
      }
    });
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTick = Date.now();
    this.tick();
  }

  stop() {
    this.running = false;
    if (this.raf && typeof window !== "undefined") {
      window.cancelAnimationFrame(this.raf);
    }
    this.raf = null;
  }

  emit(event: TemporalEvent) {
    const body = event.taskId ? this.bodies.get(event.taskId) : undefined;
    if (!body) return;
    const now = event.timestamp ?? Date.now();
    if (event.type === "touch") {
      body.heat = clamp(body.heat + TOUCH_HEAT);
      body.momentum = clamp(body.momentum + TOUCH_MOMENTUM);
      body.entropy = clamp(body.entropy + TOUCH_ENTROPY, 0, 1);
      body.lastTouchedAt = now;
    }
    if (event.type === "boost") {
      const dHeat = Number(event.payload?.heat ?? 0);
      const dMomentum = Number(event.payload?.momentum ?? 0);
      const dDrift = Number(event.payload?.drift ?? 0);
      body.heat = clamp(body.heat + dHeat);
      body.momentum = clamp(body.momentum + dMomentum);
      body.drift = clamp(body.drift + dDrift, 0, 1);
    }
  }

  subscribe(listener: (snapshot: TemporalSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  boostKind(kind: CelestialKind, heatDelta = BOOST_DEFAULTS.heat, momentumDelta = BOOST_DEFAULTS.momentum) {
    this.bodies.forEach((body) => {
      if (body.kind !== kind) return;
      body.heat = clamp(body.heat + heatDelta);
      body.momentum = clamp(body.momentum + momentumDelta);
      body.entropy = clamp(body.entropy - heatDelta * 0.4);
    });
    this.listeners.forEach((listener) => listener(this.getSnapshot()));
  }

  getSnapshot(): TemporalSnapshot {
    return {
      bodies: new Map(this.bodies),
      updatedAt: Date.now(),
    };
  }

  private tick = () => {
    if (!this.running) return;
    if (typeof window === "undefined") return;
    const now = Date.now();
    const delta = Math.min(0.12, (now - this.lastTick) / 1000);
    this.lastTick = now;
    this.bodies.forEach((body) => {
      body.heat = clamp(body.heat - HEAT_DECAY * delta + body.momentum * 0.001);
      body.entropy = clamp(body.entropy + ENTROPY_GAIN * delta + (body.heat < 0.3 ? 0.002 : 0));
      body.momentum = clamp(body.momentum - MOMENTUM_DECAY * delta + body.heat * 0.001);
      body.drift = clamp(body.drift + DRIFT_GAIN * delta + (body.entropy > 0.6 ? 0.002 : 0));
      const angularVelocity = 0.12 + body.momentum * 0.5;
      body.orbitTheta += angularVelocity * delta;
      const wander = (body.drift - 0.5) * 0.8;
      body.orbitRadius += wander;
      const radius = Math.max(80, body.orbitRadius);
      body.position.x = Math.cos(body.orbitTheta) * radius;
      body.position.y = Math.sin(body.orbitTheta) * radius;
      body.velocity.x = -Math.sin(body.orbitTheta) * radius * angularVelocity * 0.1;
      body.velocity.y = Math.cos(body.orbitTheta) * radius * angularVelocity * 0.1;
      body.lastUpdate = now;
    });
    this.listeners.forEach((listener) => listener(this.getSnapshot()));
    this.raf = window.requestAnimationFrame(this.tick);
  };
}

let temporalSingleton: TemporalPhysicsEngine | null = null;

export const getTemporalEngine = (): TemporalPhysicsEngine => {
  if (!temporalSingleton) {
    temporalSingleton = new TemporalPhysicsEngine();
  }
  return temporalSingleton;
};

export const BOOST_DEFAULTS = {
  heat: 0.22,
  momentum: 0.08,
};
