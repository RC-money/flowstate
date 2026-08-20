import type { Task } from "../../hooks/useLocalTasks";
import { DEFAULT_COLUMNS, isTerminal, type Column } from "../columns/columns";

/**
 * A cluster is one project: its own three-column board, its own sky.
 *
 * While it is live it reads as a star cluster inside the home galaxy. Ethering
 * it -- only ever possible once the work inside is finished -- sends it out to
 * the deep field, where it becomes a galaxy of its own. So the background fills
 * with completed work and nothing else.
 */
export interface Cluster {
  id: string;
  name: string;
  createdAt: number;
  /** This project's own board. Its last column is the finish line. */
  columns: Column[];
  /** Epoch ms. Sent to the ether: off the board, out in the deep field. */
  etheredAt?: number;
}

/** What the first cluster is called, and the fallback for an empty name. */
export const DEFAULT_CLUSTER_NAME = "Flowstate";

export const makeCluster = (name: string, now: number, id: string): Cluster => ({
  id,
  name: name.trim() || DEFAULT_CLUSTER_NAME,
  createdAt: now,
  columns: DEFAULT_COLUMNS.map((column) => ({ ...column })),
});

export const isLive = (cluster: Cluster): boolean => cluster.etheredAt === undefined;

/** The clusters still on the board, oldest first, so the order never jumps. */
export const liveClusters = (clusters: Cluster[]): Cluster[] =>
  clusters.filter(isLive).sort((a, b) => a.createdAt - b.createdAt);

export const tasksInCluster = (tasks: Task[], clusterId: string): Task[] =>
  tasks.filter((task) => task.clusterId === clusterId);

/**
 * Whether a cluster has earned its ending.
 *
 * Every task has to have reached the last column or already gone, and there has
 * to be at least one -- an empty cluster never earned anything. A task parked
 * in the Dark Forest counts as unfinished on purpose: hiding work is not the
 * same as ending it.
 */
export const canEther = (tasks: Task[], cluster: Cluster): boolean => {
  const members = tasksInCluster(tasks, cluster.id);
  if (members.length === 0) return false;
  return members.every(
    (task) =>
      !task.darkForest &&
      (isTerminal(cluster.columns, task.status) || task.etheredAt !== undefined)
  );
};

/** Stamps the moment. An already-ethered cluster keeps its original one. */
export const etherCluster = (
  clusters: Cluster[],
  clusterId: string,
  now: number
): Cluster[] =>
  clusters.map((cluster) =>
    cluster.id === clusterId && isLive(cluster) ? { ...cluster, etheredAt: now } : cluster
  );

/**
 * Which cluster the board should show. Keeps the current one while it is still
 * live, otherwise falls to the oldest live cluster. Null means the sky is all
 * that's left.
 */
export const nextActiveClusterId = (
  clusters: Cluster[],
  activeId: string | null
): string | null => {
  const live = liveClusters(clusters);
  if (activeId && live.some((cluster) => cluster.id === activeId)) return activeId;
  return live[0]?.id ?? null;
};
