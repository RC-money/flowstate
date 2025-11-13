import type { Insight, ObserverState, TaskSignal } from "../types";

const ENTROPY_ALERT = 0.7;

export const entropyPipeline = (state: ObserverState): Insight[] => {
  const insights: Insight[] = [];
  state.signals.forEach((signal) => {
    if (signal.entropy < ENTROPY_ALERT) {
      return;
    }
    insights.push(createInsight(signal, "entropy"));
  });
  return insights;
};

const createInsight = (signal: TaskSignal, kind: Insight["kind"]): Insight => ({
  id: `insight-${kind}-${signal.taskId}-${Date.now()}`,
  kind,
  confidence: signal.entropy,
  createdAt: Date.now(),
  message: `${signal.title || "Task"} is destabilizing. Give it attention or let it go.`,
  taskIds: [signal.taskId],
  meta: { entropy: signal.entropy },
});
