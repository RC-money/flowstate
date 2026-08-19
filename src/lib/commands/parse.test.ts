import { describe, expect, test } from "vitest";
import { parse } from "./parse";

describe("parse: list", () => {
  test("'what's open' asks for open tasks", () => {
    expect(parse("what's open")).toEqual({ kind: "list", filter: "open" });
  });

  test("'what's rotting' asks for decaying tasks", () => {
    expect(parse("what's rotting")).toEqual({ kind: "list", filter: "decaying" });
  });

  test("ignores case and surrounding whitespace", () => {
    expect(parse("  WHAT'S OPEN  ")).toEqual({ kind: "list", filter: "open" });
  });
});

describe("parse: move", () => {
  test("extracts the target and destination", () => {
    expect(parse("move the auth thing to done")).toEqual({
      kind: "move",
      target: "the auth thing",
      to: "DONE",
    });
  });

  test("understands in progress as a destination", () => {
    expect(parse("move payments to in progress")).toEqual({
      kind: "move",
      target: "payments",
      to: "IN PROGRESS",
    });
  });
});

describe("parse: unknown", () => {
  test("unrecognized phrasing returns the original text", () => {
    expect(parse("ponder the nature of work")).toEqual({
      kind: "unknown",
      text: "ponder the nature of work",
    });
  });
});
