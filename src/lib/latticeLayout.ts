/**
 * The lattice: work laid out as columns of nodes with the links between them
 * left to draw the structure, the way a tensor or a memory graph is drawn.
 *
 * It is the opposite reading of the same board from HELIOS. HELIOS says how far
 * along a task is by how far out it orbits; the lattice says it by which column
 * it stands in, and lets the links between tasks carry the shape.
 */

export const LATTICE_COLUMNS = ["TO-DO", "IN PROGRESS", "DONE"] as const;

export type LatticeColumn = (typeof LATTICE_COLUMNS)[number];

/** Horizontal gap between columns, in graph units. */
const COLUMN_GAP = 250;
/** Vertical gap between neighbours in a column, before crowding sets in. */
const ROW_GAP = 128;
/** A column taller than this starts to compress rather than run off-screen. */
const COMFORTABLE_ROWS = 6;

export const latticeColumnIndex = (status: string): number => {
  const found = LATTICE_COLUMNS.indexOf(status as LatticeColumn);
  return found >= 0 ? found : 0;
};

export interface LatticeSlot {
  /** Which column, left to right. */
  column: number;
  /** Position within that column, top to bottom. */
  index: number;
  /** How many share the column. */
  total: number;
}

/**
 * Where one node stands. Columns are centred on the midline so the lattice
 * grows evenly up and down rather than hanging off the top.
 */
export const latticePosition = ({ column, index, total }: LatticeSlot): {
  x: number;
  y: number;
} => {
  const col = Number.isFinite(column) ? Math.max(0, Math.floor(column)) : 0;
  const count = Number.isFinite(total) && total > 0 ? Math.floor(total) : 1;
  const row = Number.isFinite(index) ? Math.min(count - 1, Math.max(0, Math.floor(index))) : 0;

  // Past a comfortable depth the column tightens instead of growing without
  // bound, so a hundred to-dos still fit on the same screen as three.
  const gap = count <= COMFORTABLE_ROWS ? ROW_GAP : (ROW_GAP * COMFORTABLE_ROWS) / count;

  // Centre the stack: with n rows the middle sits on y = 0.
  const y = (row - (count - 1) / 2) * gap;

  // Centre the whole lattice horizontally too.
  const x = (col - (LATTICE_COLUMNS.length - 1) / 2) * COLUMN_GAP;

  return { x, y };
};
