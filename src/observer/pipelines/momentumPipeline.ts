import type { Insight, ObserverState } from "../types";

const HIGH_MOMENTUM = 0.65;
const LOW_MOMENTUM = 0.25;

export const momentumPipeline = (state: ObserverState): Insight[] => {
  const insights: Insight[] = [];
  state.signals.forEach((signal) => {
    if (signal.momentum > HIGH_MOMENTUM) {
      insights.push({
        id: `insight-momentum-${signal.taskId}-${Date.now()}`,
        kind: "momentum",
        confidence: signal.momentum,
        createdAt: Date.now(),
        message: `${signal.title || "Task"} is burning bright—use that burst to finish.`,
        taskIds: [signal.taskId],
        meta: { momentum: signal.momentum },
      });
      return;
    }
    if (signal.momentum < LOW_MOMENTUM && signal.heat > 0.5) {
      insights.push({
        id: `insight-momentum-low-${signal.taskId}-${Date.now()}`,
        kind: "momentum",
        confidence: 1 - signal.momentum,
        createdAt: Date.now(),
        message: `${signal.title || "Task"} has heat but no movement. Restart its orbit.`,
        taskIds: [signal.taskId],
        meta: { momentum: signal.momentum },
      });
    }
  });
  return insights;
};
