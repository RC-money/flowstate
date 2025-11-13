import type { Insight, ObserverState } from "../types";

const DRIFT_THRESHOLD = 0.6;

export const driftPipeline = (state: ObserverState): Insight[] => {
  const insights: Insight[] = [];
  state.signals.forEach((signal) => {
    if (signal.drift < DRIFT_THRESHOLD) return;
    insights.push({
      id: `insight-drift-${signal.taskId}-${Date.now()}`,
      kind: "drift",
      confidence: signal.drift,
      createdAt: Date.now(),
      message: `${signal.title || "Task"} is wobbling away. Anchor it or let it drift.`,
      taskIds: [signal.taskId],
      meta: { drift: signal.drift },
    });
  });
  return insights;
};
