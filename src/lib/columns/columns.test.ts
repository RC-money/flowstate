import { describe, expect, it } from "vitest";
import {
  DEFAULT_COLUMNS,
  addColumn,
  coerceColumns,
  isTerminal,
  moveColumn,
  removeColumn,
  renameColumn,
  terminalColumnId,
  type Column,
} from "./columns";
import { MAX_COLUMNS } from "./palette";

const three = (): Column[] => DEFAULT_COLUMNS.map((column) => ({ ...column }));

describe("DEFAULT_COLUMNS", () => {
  it("keeps the ids every board already stores as its statuses", () => {
    expect(DEFAULT_COLUMNS.map((column) => column.id)).toEqual([
      "TO-DO",
      "IN PROGRESS",
      "DONE",
    ]);
  });
});

describe("the terminal column", () => {
  it("is the last one, whatever it is called", () => {
    const columns = renameColumn(three(), "DONE", "Shipped");

    expect(terminalColumnId(columns)).toBe("DONE");
    expect(isTerminal(columns, "DONE")).toBe(true);
    expect(isTerminal(columns, "TO-DO")).toBe(false);
  });

  it("moves when a column is added after it", () => {
    const columns = addColumn(three(), "Verified", () => "c_new");

    expect(terminalColumnId(columns)).toBe("c_new");
    expect(isTerminal(columns, "DONE")).toBe(false);
  });

  it("moves when the order changes", () => {
    const columns = moveColumn(three(), "TO-DO", 2);

    expect(terminalColumnId(columns)).toBe("TO-DO");
  });

  it("is null for a board with no columns at all", () => {
    expect(terminalColumnId([])).toBeNull();
  });
});

describe("addColumn", () => {
  it("appends the new column with a trimmed name", () => {
    const columns = addColumn(three(), "  Review  ", () => "c_new");

    expect(columns).toHaveLength(4);
    expect(columns[3]).toEqual({ id: "c_new", name: "Review" });
  });

  it("refuses a nameless column", () => {
    const columns = three();

    expect(addColumn(columns, "   ", () => "c_new")).toBe(columns);
  });

  it("refuses to grow past the cap", () => {
    const full: Column[] = Array.from({ length: MAX_COLUMNS }, (_, i) => ({
      id: `c_${i}`,
      name: `Column ${i}`,
    }));

    expect(addColumn(full, "One more", () => "c_new")).toBe(full);
  });
});

describe("renameColumn", () => {
  it("renames in place without moving anything", () => {
    const columns = renameColumn(three(), "IN PROGRESS", "Doing");

    expect(columns[1]).toEqual({ id: "IN PROGRESS", name: "Doing" });
  });

  it("ignores an empty name rather than leaving a blank heading", () => {
    const columns = three();

    expect(renameColumn(columns, "IN PROGRESS", "  ")).toBe(columns);
  });
});

describe("removeColumn", () => {
  it("takes the column out", () => {
    expect(removeColumn(three(), "IN PROGRESS").map((c) => c.id)).toEqual([
      "TO-DO",
      "DONE",
    ]);
  });

  it("refuses to remove the last remaining column", () => {
    const one: Column[] = [{ id: "only", name: "Only" }];

    expect(removeColumn(one, "only")).toBe(one);
  });
});

describe("moveColumn", () => {
  it("puts a column at the position asked for", () => {
    expect(moveColumn(three(), "DONE", 0).map((c) => c.id)).toEqual([
      "DONE",
      "TO-DO",
      "IN PROGRESS",
    ]);
  });

  it("clamps a position past the end rather than dropping the column", () => {
    expect(moveColumn(three(), "TO-DO", 99).map((c) => c.id)).toEqual([
      "IN PROGRESS",
      "DONE",
      "TO-DO",
    ]);
  });

  it("leaves the board alone when the column is unknown", () => {
    const columns = three();

    expect(moveColumn(columns, "nonsense", 0)).toBe(columns);
  });
});

describe("coerceColumns: repairs rather than rejects", () => {
  it("falls back to the three defaults when there is nothing usable", () => {
    expect(coerceColumns(undefined)).toEqual(DEFAULT_COLUMNS);
    expect(coerceColumns("nonsense")).toEqual(DEFAULT_COLUMNS);
    expect(coerceColumns([])).toEqual(DEFAULT_COLUMNS);
  });

  it("drops rows that are not columns and keeps the rest", () => {
    const columns = coerceColumns([{ id: "a", name: "A" }, null, { name: "no id" }]);

    expect(columns).toEqual([{ id: "a", name: "A" }]);
  });

  it("names a column after its id when the name is missing", () => {
    expect(coerceColumns([{ id: "a" }])).toEqual([{ id: "a", name: "a" }]);
  });

  it("drops a duplicate id rather than letting two columns collide", () => {
    const columns = coerceColumns([
      { id: "a", name: "First" },
      { id: "a", name: "Second" },
    ]);

    expect(columns).toEqual([{ id: "a", name: "First" }]);
  });

  it("refuses to read in more columns than the cap allows", () => {
    const many = Array.from({ length: MAX_COLUMNS + 10 }, (_, i) => ({
      id: `c_${i}`,
      name: `Column ${i}`,
    }));

    expect(coerceColumns(many)).toHaveLength(MAX_COLUMNS);
  });
});
