import { describe, expect, test } from "vitest";
import { run } from "./run";
import type { Task } from "../../hooks/useLocalTasks";
import { DEFAULT_COLUMNS } from "../columns/columns";

const NOW = 1_755_500_000_000;
const DAY = 86_400_000;

const task = (id: string, title: string, extra: Partial<Task> = {}): Task => ({
  id,
  title,
  status: "TO-DO",
  createdAt: NOW - DAY,
  updatedAt: NOW - DAY,
  ...extra,
});

const board = [
  task("t1", "Refactor auth middleware"),
  task("t2", "Ship the pricing page", { status: "DONE", completedAt: NOW - DAY }),
  task("t3", "Write onboarding copy", { updatedAt: NOW - 20 * DAY }),
];

describe("run: move", () => {
  test("changes the matched task's status", () => {
    const result = run({ kind: "move", target: "auth", to: "IN PROGRESS" }, board, NOW);
    expect(result.tasks.find((t) => t.id === "t1")?.status).toBe("IN PROGRESS");
  });

  test("stamps completedAt when entering DONE", () => {
    const result = run({ kind: "move", target: "auth", to: "DONE" }, board, NOW);
    expect(result.tasks.find((t) => t.id === "t1")?.completedAt).toBe(NOW);
  });

  test("clears completedAt when leaving DONE", () => {
    const result = run({ kind: "move", target: "pricing", to: "TO-DO" }, board, NOW);
    expect(result.tasks.find((t) => t.id === "t2")?.completedAt).toBeUndefined();
  });

  test("touches updatedAt so decay resets", () => {
    const result = run({ kind: "move", target: "auth", to: "DONE" }, board, NOW);
    expect(result.tasks.find((t) => t.id === "t1")?.updatedAt).toBe(NOW);
  });

  test("leaves other tasks untouched", () => {
    const result = run({ kind: "move", target: "auth", to: "DONE" }, board, NOW);
    expect(result.tasks.find((t) => t.id === "t3")).toEqual(board[2]);
  });

  test("never mutates the board it was given", () => {
    const original = structuredClone(board);
    run({ kind: "move", target: "auth", to: "DONE" }, board, NOW);
    expect(board).toEqual(original);
  });
});

describe("run: undo", () => {
  test("a mutation carries the pre-change board", () => {
    const result = run({ kind: "move", target: "auth", to: "DONE" }, board, NOW);
    expect(result.undo).toEqual(board);
  });

  test("a read-only command carries no undo", () => {
    expect(run({ kind: "list", filter: "open" }, board, NOW).undo).toBeUndefined();
  });

  test("a refused command carries no undo", () => {
    expect(run({ kind: "move", target: "nothing here", to: "DONE" }, board, NOW).undo)
      .toBeUndefined();
  });
});

describe("run: refusals", () => {
  test("an ambiguous target changes nothing and names the candidates", () => {
    const twins = [task("a", "Fix login bug"), task("b", "Fix login copy")];
    const result = run({ kind: "move", target: "login", to: "DONE" }, twins, NOW);
    expect(result.tasks).toEqual(twins);
    expect(result.message).toContain("Fix login bug");
    expect(result.message).toContain("Fix login copy");
  });

  test("an unmatched target changes nothing", () => {
    const result = run({ kind: "move", target: "quarterly taxes", to: "DONE" }, board, NOW);
    expect(result.tasks).toEqual(board);
  });

  test("unknown text changes nothing and offers guidance", () => {
    const result = run({ kind: "unknown", text: "ponder work" }, board, NOW);
    expect(result.tasks).toEqual(board);
    expect(result.message).toMatch(/what's open|move/i);
  });
});

describe("run: list", () => {
  test("open excludes done and dark forest tasks", () => {
    const withDark = [...board, task("t4", "Old idea", { darkForest: true })];
    const result = run({ kind: "list", filter: "open" }, withDark, NOW);
    expect(result.listed?.map((t) => t.id)).toEqual(["t1", "t3"]);
  });

  test("open excludes ethered tasks, matching the board's own filter", () => {
    const withEthered = [...board, task("t5", "Let go of this", { etheredAt: NOW - DAY })];
    const result = run({ kind: "list", filter: "open" }, withEthered, NOW);
    expect(result.listed?.map((t) => t.id)).toEqual(["t1", "t3"]);
  });

  test("decaying returns only neglected tasks, worst first", () => {
    const result = run({ kind: "list", filter: "decaying" }, board, NOW);
    expect(result.listed?.map((t) => t.id)).toEqual(["t3"]);
  });

  test("done returns finished work", () => {
    const result = run({ kind: "list", filter: "done" }, board, NOW);
    expect(result.listed?.map((t) => t.id)).toEqual(["t2"]);
  });
});

describe("run: dark forest", () => {
  test("darkForest sets the flag", () => {
    const result = run({ kind: "darkForest", target: "auth" }, board, NOW);
    expect(result.tasks.find((t) => t.id === "t1")?.darkForest).toBe(true);
  });

  test("restore clears it", () => {
    const resting = [task("t1", "Refactor auth middleware", { darkForest: true })];
    const result = run({ kind: "restore", target: "auth" }, resting, NOW);
    expect(result.tasks[0].darkForest).toBe(false);
  });
});

describe("run: create", () => {
  test("appends a TO-DO task with the given title", () => {
    const result = run({ kind: "create", title: "Book the venue" }, board, NOW, {
      makeId: () => "t9",
    });
    expect(result.tasks).toHaveLength(4);
    expect(result.tasks[3]).toMatchObject({
      id: "t9",
      title: "Book the venue",
      status: "TO-DO",
      createdAt: NOW,
      updatedAt: NOW,
    });
  });

  test("refuses an empty title", () => {
    const result = run({ kind: "create", title: "   " }, board, NOW);
    expect(result.tasks).toEqual(board);
    expect(result.undo).toBeUndefined();
  });
});

describe("run: clusters", () => {
  const clusters = [
    { id: "c_1", name: "Flowstate v2", createdAt: NOW , columns: DEFAULT_COLUMNS},
    { id: "c_2", name: "Gardening", createdAt: NOW , columns: DEFAULT_COLUMNS},
    { id: "c_3", name: "Shipped", createdAt: NOW, columns: DEFAULT_COLUMNS, etheredAt: NOW },
  ];
  const clustered = [
    task("t1", "Refactor auth middleware", { clusterId: "c_1" }),
    task("t2", "Prune the roses", { clusterId: "c_2" }),
    task("t3", "Old finished work", { clusterId: "c_3" }),
  ];

  test("switch reports the cluster to make active", () => {
    const result = run({ kind: "switch", target: "gardening" }, clustered, NOW, { clusters });

    expect(result.activeClusterId).toBe("c_2");
    expect(result.message).toBe('Switched to "Gardening".');
  });

  test("switch changes no tasks, so there is nothing to undo", () => {
    const result = run({ kind: "switch", target: "gardening" }, clustered, NOW, { clusters });

    expect(result.tasks).toBe(clustered);
    expect(result.undo).toBeUndefined();
  });

  test("switch refuses a cluster it cannot find", () => {
    const result = run({ kind: "switch", target: "astrophysics" }, clustered, NOW, { clusters });

    expect(result.activeClusterId).toBeUndefined();
    expect(result.message).toContain("No cluster matches");
  });

  test("switch refuses rather than guessing between two clusters", () => {
    const twins = [
      { id: "c_1", name: "Launch", createdAt: NOW , columns: DEFAULT_COLUMNS},
      { id: "c_2", name: "Launch", createdAt: NOW , columns: DEFAULT_COLUMNS},
    ];
    const result = run({ kind: "switch", target: "launch" }, clustered, NOW, {
      clusters: twins,
    });

    expect(result.activeClusterId).toBeUndefined();
    expect(result.message).toContain("Be more specific");
  });

  test("assign moves a task into another cluster", () => {
    const result = run({ kind: "assign", target: "auth", cluster: "gardening" }, clustered, NOW, {
      clusters,
    });

    expect(result.tasks.find((t) => t.id === "t1")?.clusterId).toBe("c_2");
    expect(result.message).toBe('Moved "Refactor auth middleware" to "Gardening".');
  });

  test("assign stamps the task as changed", () => {
    const result = run({ kind: "assign", target: "auth", cluster: "gardening" }, clustered, NOW, {
      clusters,
    });

    expect(result.tasks.find((t) => t.id === "t1")?.updatedAt).toBe(NOW);
  });

  test("assign can be undone", () => {
    const result = run({ kind: "assign", target: "auth", cluster: "gardening" }, clustered, NOW, {
      clusters,
    });

    expect(result.undo).toBe(clustered);
  });

  test("assign refuses when the task is already there", () => {
    const result = run({ kind: "assign", target: "roses", cluster: "gardening" }, clustered, NOW, {
      clusters,
    });

    expect(result.message).toContain("already in");
    expect(result.undo).toBeUndefined();
  });

  test("assign refuses an unknown cluster without touching the board", () => {
    const result = run({ kind: "assign", target: "auth", cluster: "atlantis" }, clustered, NOW, {
      clusters,
    });

    expect(result.tasks).toBe(clustered);
    expect(result.message).toContain("No cluster matches");
  });

  test("a created task lands in the cluster the user is looking at", () => {
    const result = run({ kind: "create", title: "Book the venue" }, clustered, NOW, {
      clusters,
      activeClusterId: "c_2",
      makeId: () => "t9",
    });

    expect(result.tasks.find((t) => t.id === "t9")?.clusterId).toBe("c_2");
  });

  test("listing skips work inside a cluster that has been ethered", () => {
    const result = run({ kind: "list", filter: "open" }, clustered, NOW, { clusters });

    expect(result.listed?.map((t) => t.id)).toEqual(["t1", "t2"]);
  });

  test("assign lands the task in a column the new cluster actually has", () => {
    // Otherwise the task is invisible: the board renders a column's cards by
    // matching status, so a status no column has shows up nowhere at all.
    const clustersWithOwnColumns = [
      {
        id: "c_1",
        name: "Alpha",
        createdAt: NOW,
        columns: [
          { id: "A1", name: "Inbox" },
          { id: "A2", name: "Shipped" },
        ],
      },
      {
        id: "c_2",
        name: "Beta",
        createdAt: NOW,
        columns: [
          { id: "B1", name: "Ideas" },
          { id: "B2", name: "Built" },
        ],
      },
    ];
    const wanderer = [task("t1", "Wanderer", { clusterId: "c_1", status: "A2" })];

    const result = run({ kind: "assign", target: "wanderer", cluster: "beta" }, wanderer, NOW, {
      clusters: clustersWithOwnColumns,
    });
    const moved = result.tasks[0];

    expect(moved.clusterId).toBe("c_2");
    expect(["B1", "B2"]).toContain(moved.status);
  });

  test("assign keeps the column when the new cluster has one by that name", () => {
    const shared = [
      { id: "c_1", name: "Alpha", createdAt: NOW, columns: DEFAULT_COLUMNS },
      { id: "c_2", name: "Beta", createdAt: NOW, columns: DEFAULT_COLUMNS },
    ];
    const inFlight = [
      task("t1", "Halfway", { clusterId: "c_1", status: "IN PROGRESS" }),
    ];

    const result = run({ kind: "assign", target: "halfway", cluster: "beta" }, inFlight, NOW, {
      clusters: shared,
    });

    expect(result.tasks[0].status).toBe("IN PROGRESS");
  });

  test("assign surrenders completedAt when the task lands somewhere unfinished", () => {
    const clustersWithOwnColumns = [
      { id: "c_1", name: "Alpha", createdAt: NOW, columns: [{ id: "A1", name: "In" }, { id: "A2", name: "Done" }] },
      { id: "c_2", name: "Beta", createdAt: NOW, columns: [{ id: "B1", name: "Ideas" }, { id: "B2", name: "Built" }] },
    ];
    const finished = [
      task("t1", "Was finished", { clusterId: "c_1", status: "A2", completedAt: NOW }),
    ];

    const result = run({ kind: "assign", target: "finished", cluster: "beta" }, finished, NOW, {
      clusters: clustersWithOwnColumns,
    });

    expect(result.tasks[0].completedAt).toBeUndefined();
  });

  test("listing is unchanged when no clusters are supplied", () => {
    const result = run({ kind: "list", filter: "open" }, clustered, NOW);

    expect(result.listed).toHaveLength(3);
  });
});
