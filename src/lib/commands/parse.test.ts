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

describe("parse: switch", () => {
  test("'switch to Flowstate v2' changes cluster", () => {
    expect(parse("switch to Flowstate v2")).toEqual({
      kind: "switch",
      target: "flowstate v2",
    });
  });

  test("'go to gardening' changes cluster", () => {
    expect(parse("go to gardening")).toEqual({ kind: "switch", target: "gardening" });
  });

  test("'switch gardening' works without the preposition", () => {
    expect(parse("switch gardening")).toEqual({ kind: "switch", target: "gardening" });
  });

  test("a bare 'switch' names no cluster and is not a command", () => {
    expect(parse("switch").kind).toBe("unknown");
  });
});

describe("parse: assign", () => {
  test("'assign auth to Flowstate v2' moves a task between clusters", () => {
    expect(parse("assign auth to Flowstate v2")).toEqual({
      kind: "assign",
      target: "auth",
      cluster: "flowstate v2",
    });
  });

  test("moving to a status still beats moving to a cluster", () => {
    expect(parse("move auth to done")).toEqual({
      kind: "move",
      target: "auth",
      to: "DONE",
    });
  });
});
