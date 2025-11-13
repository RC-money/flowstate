import type { Insight, ObserverState } from "../types";

const MAX_IN_PROGRESS = 4;

export const overburdenPipeline = (state: ObserverState): Insight[] => {
  const insights: Insight[] = [];
  const inProgress = Array.from(state.signals.values()).filter(
    (signal) => signal.status === "IN PROGRESS" || signal.status === "sun"
  );
  if (inProgress.length > MAX_IN_PROGRESS) {
    insights.push({
      id: `insight-overburden-${Date.now()}`,
      kind: "overburden",
      confidence: Math.min(1, inProgress.length / (MAX_IN_PROGRESS + 2)),
      createdAt: Date.now(),
      message: "Your orbit is crowded. Combine or pause a thread.",
      taskIds: inProgress.map((signal) => signal.taskId).slice(0, 5),
      meta: { count: inProgress.length },
    });
  }
  return insights;
};
