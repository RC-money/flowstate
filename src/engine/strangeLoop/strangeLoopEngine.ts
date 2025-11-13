import type { ObserverEngineSnapshot } from "../observer/types";
import type { StrangeLoopQuestion } from "./types";

const HOURS = 1000 * 60 * 60;

const createQuestion = (
  kind: StrangeLoopQuestion["kind"],
  message: string,
  taskId?: string
): StrangeLoopQuestion => ({
  id: `loop_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
  kind,
  message,
  taskId,
  createdAt: Date.now(),
});

export const generateStrangeLoopQuestion = (
  snapshot: ObserverEngineSnapshot
): StrangeLoopQuestion | null => {
  const signals = Array.from(snapshot.signals.values());
  if (!signals.length) return null;

  const entropyCandidate = signals
    .filter((signal) => signal.entropy > 0.68 && Date.now() - signal.lastTouchedAt > 2 * HOURS)
    .sort((a, b) => b.entropy - a.entropy)[0];
  if (entropyCandidate) {
    const title = entropyCandidate.title || "this task";
    return createQuestion(
      "entropy",
      `${title} is destabilizing. Revive it or let it drift into the Dark Forest?`,
      entropyCandidate.taskId
    );
  }

  const coolingCandidate = signals
    .filter((signal) => signal.heat < 0.35 && Date.now() - signal.lastTouchedAt > 6 * HOURS)
    .sort((a, b) => a.heat - b.heat)[0];
  if (coolingCandidate) {
    return createQuestion(
      "cooling",
      `${coolingCandidate.title || "A task"} is cooling. Ignore it or reignite it?`,
      coolingCandidate.taskId
    );
  }

  const driftCandidate = signals
    .filter((signal) => signal.drift > 0.6)
    .sort((a, b) => b.drift - a.drift)[0];
  if (driftCandidate) {
    return createQuestion(
      "drift",
      `${driftCandidate.title || "Your orbit"} is wobbling. Combine tasks or tighten focus?`,
      driftCandidate.taskId
    );
  }

  const crowded = signals.filter((signal) => signal.status === "IN PROGRESS");
  if (crowded.length >= 4) {
    return createQuestion("crowded", "Your orbit is crowded. Merge threads or let one drift away?");
  }

  return null;
};
