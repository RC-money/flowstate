import { describe, expect, it } from "vitest";
import { keyRange, noteToFrequency } from "./notes";

describe("noteToFrequency", () => {
  it("tunes A4 to 440", () => {
    expect(noteToFrequency("A4")).toBeCloseTo(440);
  });

  it("computes equal-temperament neighbours", () => {
    expect(noteToFrequency("C5")).toBeCloseTo(523.25, 1);
    expect(noteToFrequency("G4")).toBeCloseTo(392.0, 1);
  });

  it("handles sharps", () => {
    expect(noteToFrequency("A#4")).toBeCloseTo(466.16, 1);
    expect(noteToFrequency("F#5")).toBeCloseTo(739.99, 1);
  });

  it("doubles across an octave", () => {
    expect(noteToFrequency("A5")).toBeCloseTo(noteToFrequency("A4") * 2);
  });
});

describe("keyRange", () => {
  it("walks chromatically from start to end inclusive", () => {
    const keys = keyRange("G4", "G5");
    expect(keys).toHaveLength(13);
    expect(keys[0]).toEqual({ note: "G4", isBlack: false });
    expect(keys[12]).toEqual({ note: "G5", isBlack: false });
  });

  it("marks the black keys", () => {
    const keys = keyRange("C5", "E5");
    expect(keys).toEqual([
      { note: "C5", isBlack: false },
      { note: "C#5", isBlack: true },
      { note: "D5", isBlack: false },
      { note: "D#5", isBlack: true },
      { note: "E5", isBlack: false },
    ]);
  });

  it("crosses the octave boundary at C", () => {
    const keys = keyRange("B4", "C5");
    expect(keys).toEqual([
      { note: "B4", isBlack: false },
      { note: "C5", isBlack: false },
    ]);
  });
});
