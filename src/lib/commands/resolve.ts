import type { Task } from "../../hooks/useLocalTasks";

export type Resolution =
  | { kind: "hit"; task: Task }
  | { kind: "ambiguous"; candidates: Task[] }
  | { kind: "miss" };

/** Words people wrap around a real target: "the auth thing", "that card". */
const FILLER = new Set([
  "the", "a", "an", "my", "that", "this", "these", "those",
  "thing", "task", "card", "item", "one", "it", "please",
  "of", "for", "and", "to",
]);

const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 0 && !FILLER.has(word));

/** Levenshtein distance, iterative single-row. */
const editDistance = (a: string, b: string): number => {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = row;
  }
  return prev[b.length];
};

/** Longer words earn more typo forgiveness; short ones get none. */
const tolerance = (word: string): number => {
  if (word.length >= 8) return 2;
  if (word.length >= 5) return 1;
  return 0;
};

const tokenMatches = (target: string, titleWord: string): boolean => {
  if (titleWord === target) return true;
  if (target.length >= 4 && titleWord.startsWith(target)) return true;
  return editDistance(target, titleWord) <= tolerance(target);
};

/** Fraction of the user's meaningful words present in the title. */
const score = (targetTokens: string[], task: Task): number => {
  const titleWords = tokenize(task.title);
  if (!titleWords.length) return 0;
  const hits = targetTokens.filter((token) =>
    titleWords.some((word) => tokenMatches(token, word))
  ).length;
  return hits / targetTokens.length;
};

const MIN_SCORE = 0.5;

/**
 * Stage 2: the user's words become a real task, or they don't.
 *
 * Deliberately deterministic -- no model ever picks a task id. An assistant
 * describes what it means and this decides, so the worst case is "ambiguous",
 * never "confidently mutated the wrong task".
 */
export const resolve = (target: string, tasks: Task[]): Resolution => {
  if (!tasks.length) return { kind: "miss" };

  const wanted = target.trim().toLowerCase();
  const exact = tasks.filter((task) => task.title.trim().toLowerCase() === wanted);
  if (exact.length === 1) return { kind: "hit", task: exact[0] };

  const targetTokens = tokenize(target);
  if (!targetTokens.length) return { kind: "miss" };

  const scored = tasks
    .map((task) => ({ task, value: score(targetTokens, task) }))
    .filter((entry) => entry.value >= MIN_SCORE);
  if (!scored.length) return { kind: "miss" };

  const best = Math.max(...scored.map((entry) => entry.value));
  const winners = scored.filter((entry) => entry.value === best).map((entry) => entry.task);

  if (winners.length === 1) return { kind: "hit", task: winners[0] };
  return { kind: "ambiguous", candidates: winners };
};
