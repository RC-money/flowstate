import { MAX_COLUMNS } from "./palette";

/**
 * A column on a cluster's board.
 *
 * A task's `status` is a column id, which is why the three defaults keep the
 * literal ids the board has always stored: every board saved before columns
 * were editable is already valid, with nothing to migrate.
 *
 * The last column is the finish line. Rename it, reorder it, add columns before
 * it -- reaching the end is what earns the star, stops the decay and lets a
 * cluster be ethered. Nothing to configure, and no way to build a board that
 * can never finish anything.
 */
export interface Column {
  id: string;
  name: string;
}

export const DEFAULT_COLUMNS: Column[] = [
  { id: "TO-DO", name: "To-Do" },
  { id: "IN PROGRESS", name: "In Progress" },
  { id: "DONE", name: "Done" },
];

export const terminalColumnId = (columns: Column[]): string | null =>
  columns.length ? columns[columns.length - 1].id : null;

export const isTerminal = (columns: Column[], columnId: string): boolean =>
  terminalColumnId(columns) === columnId;

export const addColumn = (
  columns: Column[],
  name: string,
  makeId: () => string
): Column[] => {
  const trimmed = name.trim();
  if (!trimmed || columns.length >= MAX_COLUMNS) return columns;
  return [...columns, { id: makeId(), name: trimmed }];
};

export const renameColumn = (
  columns: Column[],
  columnId: string,
  name: string
): Column[] => {
  const trimmed = name.trim();
  if (!trimmed) return columns;
  return columns.map((column) =>
    column.id === columnId ? { ...column, name: trimmed } : column
  );
};

/** A board always keeps one column; emptying it would leave nowhere to stand. */
export const removeColumn = (columns: Column[], columnId: string): Column[] => {
  if (columns.length <= 1) return columns;
  const next = columns.filter((column) => column.id !== columnId);
  return next.length === columns.length ? columns : next;
};

export const moveColumn = (
  columns: Column[],
  columnId: string,
  position: number
): Column[] => {
  const from = columns.findIndex((column) => column.id === columnId);
  if (from < 0) return columns;
  const next = columns.slice();
  const [moved] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(position, next.length)), 0, moved);
  return next;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

/**
 * Stored columns, repaired. Only a missing id is fatal, since a task's status
 * points at one; everything else has a reasonable default. A cluster that ends
 * up with nothing usable gets the three defaults rather than an unusable board.
 */
export const coerceColumns = (value: unknown): Column[] => {
  if (!Array.isArray(value)) return DEFAULT_COLUMNS.map((column) => ({ ...column }));

  const seen = new Set<string>();
  const columns: Column[] = [];
  for (const row of value) {
    if (columns.length >= MAX_COLUMNS) break;
    const record = asRecord(row);
    if (!record) continue;
    const id = typeof record.id === "string" ? record.id.trim() : "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const name = typeof record.name === "string" ? record.name.trim() : "";
    columns.push({ id, name: name || id });
  }

  return columns.length ? columns : DEFAULT_COLUMNS.map((column) => ({ ...column }));
};
