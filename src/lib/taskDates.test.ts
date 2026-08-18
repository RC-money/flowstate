import { describe, expect, test } from "vitest";
import { dueState, formatDueLabel, normalizeDates } from "./taskDates";

// Dates are stored as "YYYY-MM-DD" calendar days rather than timestamps, so a
// task due the 20th is due the 20th everywhere. `now` is injected so these
// tests never depend on the clock.
const at = (iso: string) => new Date(`${iso}T09:00:00`);

describe("dueState", () => {
  test("reports none when there is no due date", () => {
    expect(dueState(undefined, at("2026-08-18"))).toBe("none");
  });

  test("reports today when the due date is the current day", () => {
    expect(dueState("2026-08-18", at("2026-08-18"))).toBe("today");
  });

  test("reports overdue when the due date has passed", () => {
    expect(dueState("2026-08-17", at("2026-08-18"))).toBe("overdue");
  });

  test("reports soon for the next three days", () => {
    expect(dueState("2026-08-21", at("2026-08-18"))).toBe("soon");
  });

  test("reports later beyond three days", () => {
    expect(dueState("2026-08-22", at("2026-08-18"))).toBe("later");
  });

  test("treats a late-evening now as still the same calendar day", () => {
    expect(dueState("2026-08-18", new Date("2026-08-18T23:59:00"))).toBe("today");
  });

  test("crosses month boundaries without drifting", () => {
    expect(dueState("2026-09-01", at("2026-08-31"))).toBe("soon");
    expect(dueState("2026-08-31", at("2026-09-01"))).toBe("overdue");
  });

  test("reports none for an unparseable due date", () => {
    expect(dueState("next tuesday", at("2026-08-18"))).toBe("none");
  });
});

// Every task already saved in someone's browser predates these fields. Nothing
// here may throw or drop a task -- the whole board is rejected if one row fails
// validation, so a strict migration would wipe real data.
describe("normalizeDates", () => {
  const NOW = 1_755_500_000_000;

  test("stamps a task that has no dates at all", () => {
    expect(normalizeDates({}, NOW)).toEqual({ createdAt: NOW, updatedAt: NOW });
  });

  test("preserves timestamps that are already valid", () => {
    expect(normalizeDates({ createdAt: 1000, updatedAt: 2000 }, NOW)).toEqual({
      createdAt: 1000,
      updatedAt: 2000,
    });
  });

  test("falls back to createdAt when only updatedAt is missing", () => {
    expect(normalizeDates({ createdAt: 1000 }, NOW)).toEqual({
      createdAt: 1000,
      updatedAt: 1000,
    });
  });

  test("replaces timestamps that are not finite numbers", () => {
    expect(normalizeDates({ createdAt: "yesterday", updatedAt: NaN }, NOW)).toEqual({
      createdAt: NOW,
      updatedAt: NOW,
    });
  });

  test("replaces a negative timestamp", () => {
    expect(normalizeDates({ createdAt: -5 }, NOW).createdAt).toBe(NOW);
  });

  test("keeps a valid due date", () => {
    expect(normalizeDates({ dueDate: "2026-08-20" }, NOW).dueDate).toBe("2026-08-20");
  });

  test("drops a due date it cannot parse instead of keeping it", () => {
    expect(normalizeDates({ dueDate: "soon" }, NOW).dueDate).toBeUndefined();
    expect(normalizeDates({ dueDate: "" }, NOW).dueDate).toBeUndefined();
    expect(normalizeDates({ dueDate: 20260820 }, NOW).dueDate).toBeUndefined();
  });

  test("drops a due date that looks valid but is not a real day", () => {
    expect(normalizeDates({ dueDate: "2026-02-31" }, NOW).dueDate).toBeUndefined();
  });

  test("never throws on hostile input", () => {
    expect(() => normalizeDates({ createdAt: {}, updatedAt: [], dueDate: null }, NOW)).not.toThrow();
  });
});

describe("formatDueLabel", () => {
  test("returns null when there is nothing to show", () => {
    expect(formatDueLabel(undefined, at("2026-08-18"))).toBeNull();
  });

  test("names today rather than dating it", () => {
    expect(formatDueLabel("2026-08-18", at("2026-08-18"))).toBe("Today");
  });

  test("names tomorrow rather than dating it", () => {
    expect(formatDueLabel("2026-08-19", at("2026-08-18"))).toBe("Tomorrow");
  });

  test("counts the days for the rest of the soon window", () => {
    expect(formatDueLabel("2026-08-21", at("2026-08-18"))).toBe("In 3 days");
  });

  test("singularises a one-day overdue task", () => {
    expect(formatDueLabel("2026-08-17", at("2026-08-18"))).toBe("1 day late");
  });

  test("pluralises a longer overdue task", () => {
    expect(formatDueLabel("2026-08-14", at("2026-08-18"))).toBe("4 days late");
  });

  test("falls back to a short date further out", () => {
    expect(formatDueLabel("2026-09-27", at("2026-08-18"))).toBe("Sep 27");
  });
});
