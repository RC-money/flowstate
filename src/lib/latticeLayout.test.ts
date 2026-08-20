import { describe, expect, it } from "vitest";
import {
  LATTICE_COLUMNS,
  latticeColumnIndex,
  latticePosition,
} from "./latticeLayout";

describe("latticeColumnIndex", () => {
  it("gives each status its own column, left to right", () => {
    expect(latticeColumnIndex("TO-DO")).toBe(0);
    expect(latticeColumnIndex("IN PROGRESS")).toBe(1);
    expect(latticeColumnIndex("DONE")).toBe(2);
  });

  it("parks anything unrecognised in the first column", () => {
    expect(latticeColumnIndex("SOMETHING ELSE")).toBe(0);
  });

  it("names as many columns as it places", () => {
    expect(LATTICE_COLUMNS).toHaveLength(3);
  });
});

describe("latticePosition", () => {
  it("stacks a column vertically at a single x", () => {
    const a = latticePosition({ column: 1, index: 0, total: 3 });
    const b = latticePosition({ column: 1, index: 2, total: 3 });
    expect(a.x).toBeCloseTo(b.x, 6);
    expect(a.y).not.toBeCloseTo(b.y, 6);
  });

  it("puts the columns side by side in order", () => {
    const left = latticePosition({ column: 0, index: 0, total: 1 });
    const mid = latticePosition({ column: 1, index: 0, total: 1 });
    const right = latticePosition({ column: 2, index: 0, total: 1 });
    expect(left.x).toBeLessThan(mid.x);
    expect(mid.x).toBeLessThan(right.x);
  });

  it("centres a column on the midline rather than hanging it downward", () => {
    const only = latticePosition({ column: 0, index: 0, total: 1 });
    expect(only.y).toBeCloseTo(0, 6);

    const first = latticePosition({ column: 0, index: 0, total: 2 });
    const second = latticePosition({ column: 0, index: 1, total: 2 });
    expect(first.y + second.y).toBeCloseTo(0, 6);
  });

  it("spaces neighbours evenly however many share the column", () => {
    for (const total of [2, 3, 5, 9]) {
      const gaps: number[] = [];
      for (let i = 1; i < total; i += 1) {
        gaps.push(
          latticePosition({ column: 0, index: i, total }).y -
            latticePosition({ column: 0, index: i - 1, total }).y
        );
      }
      for (const gap of gaps) {
        expect(gap).toBeCloseTo(gaps[0], 6);
      }
    }
  });

  it("keeps a long column readable by tightening the spacing", () => {
    const shortSpan =
      latticePosition({ column: 0, index: 2, total: 3 }).y -
      latticePosition({ column: 0, index: 0, total: 3 }).y;
    const longSpan =
      latticePosition({ column: 0, index: 29, total: 30 }).y -
      latticePosition({ column: 0, index: 0, total: 30 }).y;
    // A thirty-deep column must not be ten times taller than a three-deep one.
    expect(longSpan).toBeLessThan(shortSpan * 10);
  });

  it("never returns a non-finite coordinate", () => {
    const odd = latticePosition({ column: -1, index: -4, total: 0 });
    expect(Number.isFinite(odd.x)).toBe(true);
    expect(Number.isFinite(odd.y)).toBe(true);
  });
});
