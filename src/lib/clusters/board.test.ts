import { describe, expect, it } from "vitest";
import { DEFAULT_CLUSTER_ID, DEFAULT_CLUSTER_NAME, normalizeBoard } from "./board";
import { DEFAULT_COLUMNS } from "../columns/columns";

const NOW = 1_700_000_000_000;

const legacyTask = (id: string) => ({
  id,
  title: `Task ${id}`,
  status: "TO-DO" as const,
  createdAt: NOW,
  updatedAt: NOW,
});

describe("normalizeBoard: boards saved before clusters existed", () => {
  it("wraps a bare array into one cluster and keeps every task", () => {
    const board = normalizeBoard([legacyTask("a"), legacyTask("b")], NOW);

    expect(board?.clusters).toEqual([
      {
        id: DEFAULT_CLUSTER_ID,
        name: DEFAULT_CLUSTER_NAME,
        createdAt: NOW,
        columns: DEFAULT_COLUMNS,
      },
    ]);
    expect(board?.tasks.map((t) => t.id)).toEqual(["a", "b"]);
    expect(board?.tasks.every((t) => t.clusterId === DEFAULT_CLUSTER_ID)).toBe(true);
  });

  it("wraps an empty array without inventing tasks", () => {
    const board = normalizeBoard([], NOW);

    expect(board?.tasks).toEqual([]);
    expect(board?.clusters).toHaveLength(1);
  });
});

describe("normalizeBoard: boards that already have clusters", () => {
  it("reads clusters and tasks back unchanged", () => {
    const board = normalizeBoard(
      {
        clusters: [{ id: "c_1", name: "Flowstate v2", createdAt: NOW }],
        tasks: [{ ...legacyTask("a"), clusterId: "c_1" }],
      },
      NOW
    );

    expect(board?.clusters).toEqual([
      { id: "c_1", name: "Flowstate v2", createdAt: NOW, columns: DEFAULT_COLUMNS },
    ]);
    expect(board?.tasks[0].clusterId).toBe("c_1");
  });

  it("keeps an ethered cluster ethered", () => {
    const board = normalizeBoard(
      {
        clusters: [{ id: "c_1", name: "Done", createdAt: NOW, etheredAt: NOW + 5 }],
        tasks: [],
      },
      NOW
    );

    expect(board?.clusters[0].etheredAt).toBe(NOW + 5);
  });
});

describe("normalizeBoard: repairs rather than rejects", () => {
  it("adopts a task whose cluster does not exist rather than dropping it", () => {
    const board = normalizeBoard(
      {
        clusters: [{ id: "c_1", name: "Real", createdAt: NOW }],
        tasks: [{ ...legacyTask("orphan"), clusterId: "c_missing" }],
      },
      NOW
    );

    expect(board?.tasks.map((t) => t.id)).toEqual(["orphan"]);
    expect(board?.tasks[0].clusterId).toBe("c_1");
  });

  it("adopts a task with no cluster at all", () => {
    const board = normalizeBoard(
      { clusters: [{ id: "c_1", name: "Real", createdAt: NOW }], tasks: [legacyTask("a")] },
      NOW
    );

    expect(board?.tasks[0].clusterId).toBe("c_1");
  });

  it("rebuilds a missing cluster list from the ids the tasks reference", () => {
    const board = normalizeBoard(
      { tasks: [{ ...legacyTask("a"), clusterId: "c_7" }] },
      NOW
    );

    expect(board?.clusters.map((c) => c.id)).toEqual(["c_7"]);
    expect(board?.tasks[0].clusterId).toBe("c_7");
  });

  it("drops a corrupt cluster row without touching the tasks", () => {
    const board = normalizeBoard(
      {
        clusters: [{ id: "c_1", name: "Real", createdAt: NOW }, { name: "no id" }, null],
        tasks: [{ ...legacyTask("a"), clusterId: "c_1" }],
      },
      NOW
    );

    expect(board?.clusters.map((c) => c.id)).toEqual(["c_1"]);
    expect(board?.tasks).toHaveLength(1);
  });

  it("gives a cluster with no usable name the default one", () => {
    const board = normalizeBoard(
      { clusters: [{ id: "c_1", name: "  ", createdAt: NOW }], tasks: [] },
      NOW
    );

    expect(board?.clusters[0].name).toBe(DEFAULT_CLUSTER_NAME);
  });

  it("backfills a cluster missing its creation time", () => {
    const board = normalizeBoard({ clusters: [{ id: "c_1", name: "Real" }], tasks: [] }, NOW);

    expect(board?.clusters[0].createdAt).toBe(NOW);
  });

  it("always leaves at least one cluster to stand on", () => {
    const board = normalizeBoard({ clusters: [], tasks: [] }, NOW);

    expect(board?.clusters).toHaveLength(1);
    expect(board?.clusters[0].id).toBe(DEFAULT_CLUSTER_ID);
  });

  it("leaves a live cluster to stand on when every stored one was ethered", () => {
    const board = normalizeBoard(
      { clusters: [{ id: "c_1", name: "Gone", createdAt: NOW, etheredAt: NOW }], tasks: [] },
      NOW
    );

    expect(board?.clusters.filter((c) => c.etheredAt === undefined)).toHaveLength(1);
  });
});

describe("normalizeBoard: what it refuses", () => {
  it("refuses a payload that is neither array nor object", () => {
    expect(normalizeBoard("nonsense", NOW)).toBeNull();
    expect(normalizeBoard(null, NOW)).toBeNull();
  });

  it("refuses an object whose tasks are not a list", () => {
    expect(normalizeBoard({ clusters: [], tasks: "nope" }, NOW)).toBeNull();
  });

  it("refuses a task row that is not a task, as the loader always has", () => {
    expect(normalizeBoard({ tasks: [{ id: "a" }] }, NOW)).toBeNull();
  });
});

describe("normalizeBoard: columns", () => {
  it("gives a cluster that has never had columns the three defaults", () => {
    const board = normalizeBoard(
      { clusters: [{ id: "c_1", name: "Real", createdAt: NOW }], tasks: [] },
      NOW
    );

    expect(board?.clusters[0].columns).toEqual(DEFAULT_COLUMNS);
  });

  it("keeps a board that has made its own columns", () => {
    const board = normalizeBoard(
      {
        clusters: [
          {
            id: "c_1",
            name: "Real",
            createdAt: NOW,
            columns: [
              { id: "ideas", name: "Ideas" },
              { id: "built", name: "Built" },
            ],
          },
        ],
        tasks: [],
      },
      NOW
    );

    expect(board?.clusters[0].columns.map((c) => c.id)).toEqual(["ideas", "built"]);
  });
});
