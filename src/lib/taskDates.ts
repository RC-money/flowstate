export type DueState = "none" | "overdue" | "today" | "soon" | "later";

/** How many days out still counts as "soon" rather than "later". */
export const SOON_WINDOW_DAYS = 3;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

/**
 * Parses a "YYYY-MM-DD" calendar day into a local midnight Date, or null if it
 * isn't one. Constructing from parts rather than Date.parse keeps the day local
 * -- `new Date("2026-08-20")` is parsed as UTC and lands on the 19th for anyone
 * west of Greenwich.
 */
const parseDay = (value: string | undefined): Date | null => {
  if (typeof value !== "string" || !ISO_DAY.test(value)) return null;

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);

  // Rejects dates that silently roll over, like 2026-02-31.
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
};

const startOfDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const daysBetween = (due: Date, now: Date): number =>
  Math.round((due.getTime() - startOfDay(now).getTime()) / MS_PER_DAY);

/**
 * A short human label for a due date, or null when there is nothing to say.
 * Near dates get names ("Today", "Tomorrow") because that is how people hold
 * them; distant ones get a plain date.
 */
export const formatDueLabel = (
  dueDate: string | undefined,
  now: Date
): string | null => {
  const due = parseDay(dueDate);
  if (!due) return null;

  const daysOut = daysBetween(due, now);

  if (daysOut < 0) {
    const late = Math.abs(daysOut);
    return `${late} ${late === 1 ? "day" : "days"} late`;
  }
  if (daysOut === 0) return "Today";
  if (daysOut === 1) return "Tomorrow";
  if (daysOut <= SOON_WINDOW_DAYS) return `In ${daysOut} days`;

  return due.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

/** Card and badge colours per due state, kept with the logic they describe. */
export const DUE_TONES: Record<DueState, string> = {
  none: "",
  overdue: "border-rose-300/40 bg-rose-500/10 text-rose-200",
  today: "border-amber-300/40 bg-amber-400/10 text-amber-200",
  soon: "border-sky-300/30 bg-sky-400/10 text-sky-200",
  later: "border-white/15 bg-white/5 text-slate-300",
};

export interface TaskDates {
  createdAt: number;
  updatedAt: number;
  dueDate?: string;
}

interface RawDates {
  createdAt?: unknown;
  updatedAt?: unknown;
  dueDate?: unknown;
}

const asTimestamp = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;

/**
 * Fills in date fields for a task that may predate them. Every task already in
 * a user's localStorage was written before these existed, and the storage layer
 * rejects the entire board if a single row fails validation -- so this repairs
 * rather than rejects, and never throws.
 */
export const normalizeDates = (raw: RawDates, now: number): TaskDates => {
  const createdAt = asTimestamp(raw?.createdAt) ?? now;
  const updatedAt = asTimestamp(raw?.updatedAt) ?? createdAt;
  const dueDate = typeof raw?.dueDate === "string" ? raw.dueDate : undefined;

  const dates: TaskDates = { createdAt, updatedAt };
  if (parseDay(dueDate)) {
    dates.dueDate = dueDate;
  }
  return dates;
};

export const dueState = (dueDate: string | undefined, now: Date): DueState => {
  const due = parseDay(dueDate);
  if (!due) return "none";

  // Rounding absorbs the one-hour error a DST boundary introduces.
  const daysOut = Math.round((due.getTime() - startOfDay(now).getTime()) / MS_PER_DAY);

  if (daysOut < 0) return "overdue";
  if (daysOut === 0) return "today";
  if (daysOut <= SOON_WINDOW_DAYS) return "soon";
  return "later";
};
