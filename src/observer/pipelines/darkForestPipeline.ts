import type { Insight, ObserverState } from "../types";

const DARK_FOREST_THRESHOLD = 0.8;

export const darkForestPipeline = (state: ObserverState): Insight[] => {
  const insights: Insight[] = [];
  state.signals.forEach((signal) => {
    if (signal.entropy <= DARK_FOREST_THRESHOLD) return;
    insights.push({
      id: `insight-dark-forest-${signal.taskId}-${Date.now()}`,
      kind: "dark-forest",
      confidence: signal.entropy,
      createdAt: Date.now(),
      message: `${signal.title || "This task"} wants the Dark Forest. Archive without guilt?`,
      taskIds: [signal.taskId],
      meta: { entropy: signal.entropy },
    });
  });
  return insights;
};
