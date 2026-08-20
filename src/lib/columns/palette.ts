/**
 * How a board of any length stays legible.
 *
 * Seven hues carry the first seven columns. Past that, columns take pairs of
 * hues, and past those, triples -- so a fifty-column board still reads as a
 * gradient of distinguishable things rather than fifty near-identical blues.
 * Seven singles, twenty-one pairs and thirty-five triples is sixty-three
 * combinations, comfortably past the cap.
 *
 * A column's colour is its position, derived not stored, so reordering a board
 * re-colours it and nothing has to be migrated.
 */

/** The three the board has always used, then four that hold up beside them. */
export const BASE_HUES = [
  "#47A3F3", // blue
  "#F7B84B", // amber
  "#4ADE80", // green
  "#7C83FF", // violet
  "#F471B5", // rose
  "#22D3EE", // cyan
  "#C084FC", // orchid
] as const;

/** The longest a board may get. Past this the sky stops being readable. */
export const MAX_COLUMNS = 50;

export interface ColumnPalette {
  /** One, two or three base hues. More than one means draw a gradient. */
  hues: string[];
  /** The single hue to use where a gradient will not fit. */
  core: string;
  /** That hue at the glow opacity the board and the galaxy share. */
  glow: string;
}

/** Every combination of `size` hues, in a fixed order. */
const combinations = (size: number): number[][] => {
  const out: number[][] = [];
  const walk = (start: number, picked: number[]) => {
    if (picked.length === size) {
      out.push(picked);
      return;
    }
    for (let i = start; i < BASE_HUES.length; i += 1) walk(i + 1, [...picked, i]);
  };
  walk(0, []);
  return out;
};

/** Singles, then pairs, then triples -- the order columns consume them in. */
const COMBINATIONS: number[][] = [
  ...combinations(1),
  ...combinations(2),
  ...combinations(3),
].slice(0, MAX_COLUMNS);

const glowOf = (hex: string): string => {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  return `rgba(${r},${g},${b},0.45)`;
};

/**
 * The colours for the column standing at `index`. Out-of-range indices wrap
 * rather than throw: a board should never fail to draw over a colour.
 */
export const columnPalette = (index: number): ColumnPalette => {
  const safe = ((Math.trunc(index) % COMBINATIONS.length) + COMBINATIONS.length) %
    COMBINATIONS.length;
  const hues = COMBINATIONS[safe].map((hue) => BASE_HUES[hue]);
  return { hues, core: hues[0], glow: glowOf(hues[0]) };
};
