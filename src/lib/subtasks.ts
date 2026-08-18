/**
 * Subtasks are a checklist inside their parent, not board tasks -- they never
 * become cards. On the card they read as a row of stars; in the galaxy they
 * orbit the parent and ignite as they complete.
 */
export interface Subtask {
  id: string;
  title: string;
  done: boolean;
  completedAt?: number;
  /** Which moon sprite orbits the parent for this subtask (0..MOON_COUNT-1). */
  moon?: number;
}

/** Seven rendered moon models live in src/assets/moons. */
export const MOON_COUNT = 7;

export const subtaskProgress = (subtasks: Subtask[] | undefined): { done: number; total: number } => {
  if (!subtasks?.length) return { done: 0, total: 0 };
  return { done: subtasks.filter((s) => s.done).length, total: subtasks.length };
};

export const toggleSubtask = (subtasks: Subtask[], id: string, now: number): Subtask[] =>
  subtasks.map((subtask) => {
    if (subtask.id !== id) return subtask;
    if (subtask.done) {
      const rest = { ...subtask, done: false };
      delete rest.completedAt;
      return rest;
    }
    return { ...subtask, done: true, completedAt: now };
  });

export const addSubtask = (subtasks: Subtask[], title: string): Subtask[] => {
  const trimmed = title.trim();
  if (!trimmed) return subtasks;
  return [
    ...subtasks,
    {
      id: `st_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      title: trimmed,
      done: false,
      // Which moon you get is luck -- assigned once at birth, stable after.
      moon: Math.floor(Math.random() * MOON_COUNT),
    },
  ];
};

export const removeSubtask = (subtasks: Subtask[], id: string): Subtask[] =>
  subtasks.filter((subtask) => subtask.id !== id);

/** Storage repair, same philosophy as the task migration: filter, never throw. */
export const normalizeSubtasks = (raw: unknown): Subtask[] | undefined => {
  if (!Array.isArray(raw)) return undefined;
  const cleaned: Subtask[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Partial<Subtask>;
    if (typeof candidate.id !== "string" || typeof candidate.title !== "string") continue;
    cleaned.push({
      id: candidate.id,
      title: candidate.title,
      done: Boolean(candidate.done),
      ...(typeof candidate.completedAt === "number" ? { completedAt: candidate.completedAt } : {}),
      ...(typeof candidate.moon === "number" && candidate.moon >= 0 && candidate.moon < MOON_COUNT
        ? { moon: Math.floor(candidate.moon) }
        : {}),
    });
  }
  return cleaned;
};
