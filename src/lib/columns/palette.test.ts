import { describe, expect, it } from "vitest";
import { BASE_HUES, MAX_COLUMNS, columnPalette } from "./palette";

describe("columnPalette: the tiers", () => {
  it("gives each of the first seven columns a hue of its own", () => {
    for (let i = 0; i < 7; i += 1) {
      expect(columnPalette(i).hues).toEqual([BASE_HUES[i]]);
    }
  });

  it("keeps the three original board colours on the three original columns", () => {
    expect(columnPalette(0).hues[0]).toBe("#47A3F3");
    expect(columnPalette(1).hues[0]).toBe("#F7B84B");
    expect(columnPalette(2).hues[0]).toBe("#4ADE80");
  });

  it("starts pairing hues once the seven singles run out", () => {
    expect(columnPalette(7).hues).toHaveLength(2);
    expect(columnPalette(27).hues).toHaveLength(2);
  });

  it("starts tripling once the twenty-one pairs run out", () => {
    expect(columnPalette(28).hues).toHaveLength(3);
    expect(columnPalette(MAX_COLUMNS - 1).hues).toHaveLength(3);
  });

  it("gives all fifty columns a combination no other column has", () => {
    const seen = new Set(
      Array.from({ length: MAX_COLUMNS }, (_, i) => columnPalette(i).hues.join("|"))
    );

    expect(seen.size).toBe(MAX_COLUMNS);
  });

  it("only ever draws from the seven base hues", () => {
    for (let i = 0; i < MAX_COLUMNS; i += 1) {
      columnPalette(i).hues.forEach((hue) => expect(BASE_HUES).toContain(hue));
    }
  });

  it("never repeats a hue inside one column's combination", () => {
    for (let i = 0; i < MAX_COLUMNS; i += 1) {
      const { hues } = columnPalette(i);
      expect(new Set(hues).size).toBe(hues.length);
    }
  });
});

describe("columnPalette: what it hands the renderer", () => {
  it("names one hue to use where only one colour fits", () => {
    const palette = columnPalette(9);

    expect(palette.core).toBe(palette.hues[0]);
  });

  it("carries a translucent glow of that same hue", () => {
    expect(columnPalette(0).glow).toBe("rgba(71,163,243,0.45)");
  });

  it("is the same every time for the same column", () => {
    expect(columnPalette(31)).toEqual(columnPalette(31));
  });

  it("stays inside the palette rather than throwing past the cap", () => {
    expect(columnPalette(MAX_COLUMNS + 3).hues.length).toBeGreaterThan(0);
    expect(columnPalette(-1).hues.length).toBeGreaterThan(0);
  });
});
