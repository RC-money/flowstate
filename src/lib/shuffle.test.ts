import { describe, expect, it } from "vitest";
import { pickNextTrack } from "./shuffle";

describe("pickNextTrack", () => {
  it("returns null when there are no tracks", () => {
    expect(pickNextTrack([], null, 0.5)).toBeNull();
  });

  it("never repeats the current track when another exists", () => {
    expect(pickNextTrack(["a", "b"], "a", 0)).toBe("b");
    expect(pickNextTrack(["a", "b"], "a", 0.99)).toBe("b");
    expect(pickNextTrack(["a", "b"], "b", 0.5)).toBe("a");
  });

  it("falls back to the current track when it is the only one", () => {
    expect(pickNextTrack(["a"], "a", 0.5)).toBe("a");
  });

  it("picks from all tracks when nothing is playing", () => {
    expect(pickNextTrack(["a", "b"], null, 0)).toBe("a");
    expect(pickNextTrack(["a", "b"], null, 0.99)).toBe("b");
  });

  it("spreads picks across a larger pool by rand", () => {
    expect(pickNextTrack(["a", "b", "c"], "a", 0)).toBe("b");
    expect(pickNextTrack(["a", "b", "c"], "a", 0.99)).toBe("c");
  });
});
