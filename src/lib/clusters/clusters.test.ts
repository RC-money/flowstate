import { describe, expect, it } from "vitest";
import type { Task } from "../../hooks/useLocalTasks";
import {
  DEFAULT_CLUSTER_NAME,
  canEther,
  etherCluster,
  isLive,
  liveClusters,
  makeCluster,
  nextActiveClusterId,
  tasksInCluster,
  type Cluster,
} from "./clusters";

const NOW = 1_700_000_000_000;

const task = (over: Partial<Task> & { id: string; clusterId: string }): Task => ({
  title: over.id,
  status: "TO-DO",
  createdAt: NOW,
  updatedAt: NOW,
  ...over,
});

describe("makeCluster", () => {
  it("stamps the name and creation time, and starts live", () => {
    const cluster = makeCluster("Flowstate v2", NOW, "c_1");

    expect(cluster).toEqual({
      id: "c_1",
      name: "Flowstate v2",
      createdAt: NOW,
    });
  });

  it("falls back to the default name when given only whitespace", () => {
    expect(makeCluster("   ", NOW, "c_1").name).toBe(DEFAULT_CLUSTER_NAME);
  });
});

describe("isLive", () => {
  it("is true until the cluster has been ethered", () => {
    const cluster = makeCluster("Home", NOW, "c_1");

    expect(isLive(cluster)).toBe(true);
    expect(isLive({ ...cluster, etheredAt: NOW })).toBe(false);
  });
});

describe("liveClusters", () => {
  it("keeps the live ones in creation order", () => {
    const clusters: Cluster[] = [
      { id: "c_2", name: "Second", createdAt: NOW + 10 },
      { id: "c_1", name: "First", createdAt: NOW },
      { id: "c_0", name: "Gone", createdAt: NOW - 10, etheredAt: NOW },
    ];

    expect(liveClusters(clusters).map((c) => c.id)).toEqual(["c_1", "c_2"]);
  });
});

describe("tasksInCluster", () => {
  it("keeps only the tasks belonging to that cluster", () => {
    const tasks = [
      task({ id: "a", clusterId: "c_1" }),
      task({ id: "b", clusterId: "c_2" }),
      task({ id: "c", clusterId: "c_1" }),
    ];

    expect(tasksInCluster(tasks, "c_1").map((t) => t.id)).toEqual(["a", "c"]);
  });
});

describe("canEther", () => {
  it("refuses a cluster with unfinished work", () => {
    const tasks = [
      task({ id: "a", clusterId: "c_1", status: "DONE" }),
      task({ id: "b", clusterId: "c_1", status: "IN PROGRESS" }),
    ];

    expect(canEther(tasks, "c_1")).toBe(false);
  });

  it("allows a cluster whose tasks are all done", () => {
    const tasks = [
      task({ id: "a", clusterId: "c_1", status: "DONE" }),
      task({ id: "b", clusterId: "c_1", status: "DONE" }),
    ];

    expect(canEther(tasks, "c_1")).toBe(true);
  });

  it("counts an already-ethered task as finished", () => {
    const tasks = [
      task({ id: "a", clusterId: "c_1", status: "DONE" }),
      task({ id: "b", clusterId: "c_1", status: "TO-DO", etheredAt: NOW }),
    ];

    expect(canEther(tasks, "c_1")).toBe(true);
  });

  it("counts a task hidden in the Dark Forest as unfinished", () => {
    const tasks = [
      task({ id: "a", clusterId: "c_1", status: "DONE" }),
      task({ id: "b", clusterId: "c_1", status: "TO-DO", darkForest: true }),
    ];

    expect(canEther(tasks, "c_1")).toBe(false);
  });

  it("refuses an empty cluster -- the ceremony has to be earned", () => {
    expect(canEther([], "c_1")).toBe(false);
  });

  it("ignores unfinished work in other clusters", () => {
    const tasks = [
      task({ id: "a", clusterId: "c_1", status: "DONE" }),
      task({ id: "b", clusterId: "c_2", status: "TO-DO" }),
    ];

    expect(canEther(tasks, "c_1")).toBe(true);
  });
});

describe("etherCluster", () => {
  it("stamps the moment on that cluster only", () => {
    const clusters: Cluster[] = [
      { id: "c_1", name: "First", createdAt: NOW },
      { id: "c_2", name: "Second", createdAt: NOW },
    ];

    const next = etherCluster(clusters, "c_1", NOW + 5);

    expect(next[0].etheredAt).toBe(NOW + 5);
    expect(next[1].etheredAt).toBeUndefined();
  });

  it("leaves an already-ethered cluster at its original moment", () => {
    const clusters: Cluster[] = [
      { id: "c_1", name: "First", createdAt: NOW, etheredAt: NOW + 1 },
    ];

    expect(etherCluster(clusters, "c_1", NOW + 999)[0].etheredAt).toBe(NOW + 1);
  });
});

describe("nextActiveClusterId", () => {
  const clusters: Cluster[] = [
    { id: "c_1", name: "First", createdAt: NOW },
    { id: "c_2", name: "Second", createdAt: NOW + 10 },
  ];

  it("keeps the active cluster when it is still live", () => {
    expect(nextActiveClusterId(clusters, "c_2")).toBe("c_2");
  });

  it("falls to the oldest live cluster when the active one was ethered", () => {
    const ethered = etherCluster(clusters, "c_2", NOW + 20);

    expect(nextActiveClusterId(ethered, "c_2")).toBe("c_1");
  });

  it("falls to the oldest live cluster when the active id is unknown", () => {
    expect(nextActiveClusterId(clusters, "nonsense")).toBe("c_1");
  });

  it("returns null when every cluster has been ethered", () => {
    const gone = clusters.map((c) => ({ ...c, etheredAt: NOW }));

    expect(nextActiveClusterId(gone, "c_1")).toBeNull();
  });
});
