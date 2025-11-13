import type { ObserverEvent, ObserverState, TaskSignal } from "./types";

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));

export const ensureSignal = (state: ObserverState, event: ObserverEvent): TaskSignal => {
  const taskId = event.taskId ?? "unknown";
  const existing = state.signals.get(taskId);
  if (existing) {
    return existing;
  }
  const now = event.timestamp ?? Date.now();
  const signal: TaskSignal = {
    taskId,
    title: (event.payload?.title as string) || "Untitled",
    status: (event.payload?.status as string) || "TO-DO",
    touches: 0,
    entropy: 0.35,
    heat: 0.3,
    drift: 0.2,
    momentum: 0.2,
    lastTouchedAt: now,
    updatedAt: now,
  };
  state.signals.set(taskId, signal);
  return signal;
};

export const reduceEvent = (state: ObserverState, event: ObserverEvent): ObserverState => {
  const now = event.timestamp ?? Date.now();
  switch (event.type) {
    case "task_snapshot": {
      if (!event.payload?.tasks || !Array.isArray(event.payload.tasks)) {
        return state;
      }
      const snapshot: Array<{ id: string; title?: string; status?: string }> = event.payload.tasks;
      snapshot.forEach((task) => {
        const signal = ensureSignal(state, { ...event, taskId: task.id });
        signal.title = task.title ?? signal.title;
        signal.status = task.status ?? signal.status;
        signal.updatedAt = now;
      });
      return state;
    }
    case "task_touch": {
      if (!event.taskId) return state;
      const signal = ensureSignal(state, event);
      signal.touches += 1;
      signal.heat = clamp(signal.heat + 0.15);
      signal.momentum = clamp(signal.momentum + 0.1);
      signal.entropy = clamp(signal.entropy - 0.12);
      signal.lastTouchedAt = now;
      signal.updatedAt = now;
      return state;
    }
    case "drag_move": {
      if (!event.taskId) return state;
      const signal = ensureSignal(state, event);
      signal.drift = clamp(signal.drift + 0.08);
      signal.momentum = clamp(signal.momentum + 0.05);
      signal.updatedAt = now;
      return state;
    }
    case "heat_sample": {
      if (!event.taskId) return state;
      const signal = ensureSignal(state, event);
      const value = Number(event.payload?.value);
      if (Number.isFinite(value)) {
        signal.heat = clamp(value);
      }
      signal.updatedAt = now;
      return state;
    }
    case "session_tick": {
      const delta = Number(event.payload?.delta) || 1;
      state.signals.forEach((signal) => {
        signal.heat = clamp(signal.heat - state.config.heatDecay * delta);
        signal.entropy = clamp(signal.entropy + state.config.entropyDecay * delta);
        signal.momentum = clamp(signal.momentum - state.config.momentumDecay * delta);
        signal.drift = clamp(signal.drift * (1 + 0.005 * delta));
        signal.updatedAt = now;
      });
      return state;
    }
    default:
      return state;
  }
};
