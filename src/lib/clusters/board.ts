import { coerceTasks, type Task } from "../../hooks/useLocalTasks";
import { DEFAULT_CLUSTER_NAME, isLive, makeCluster, type Cluster } from "./clusters";

export { DEFAULT_CLUSTER_NAME };

/**
 * The id every pre-clusters board is migrated into. Fixed rather than
 * generated so the migration is deterministic and re-running it is harmless.
 */
export const DEFAULT_CLUSTER_ID = "cluster_home";

/** Everything the app persists: the projects, and the tasks inside them. */
export interface Board {
  clusters: Cluster[];
  tasks: Task[];
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

/**
 * One stored cluster, repaired. Only a missing or empty id is fatal -- without
 * one there is nothing to point a task at. Everything else has a sane default,
 * because losing a name is survivable and losing a board is not.
 */
const coerceCluster = (value: unknown, now: number): Cluster | null => {
  const row = asRecord(value);
  if (!row) return null;

  const id = typeof row.id === "string" ? row.id.trim() : "";
  if (!id) return null;

  const name = typeof row.name === "string" ? row.name.trim() : "";
  const createdAt = typeof row.createdAt === "number" ? row.createdAt : now;
  const etheredAt = typeof row.etheredAt === "number" ? row.etheredAt : undefined;

  return {
    id,
    name: name || DEFAULT_CLUSTER_NAME,
    createdAt,
    ...(etheredAt !== undefined ? { etheredAt } : {}),
  };
};

/**
 * Reads a stored payload into a board, in whichever shape it was written.
 *
 * Two shapes exist. A bare array is every board saved before clusters, and is
 * wrapped into a single cluster. An object carries its own clusters.
 *
 * The repair rule from `normalizeDates` holds throughout: the loader drops the
 * whole board when coercion returns null, so nothing here rejects over a field
 * it can reasonably fill in. Only a payload that isn't a board at all, or a row
 * that isn't a task, is refused -- exactly what `coerceTasks` already refused.
 */
export const normalizeBoard = (payload: unknown, now: number): Board | null => {
  const isArray = Array.isArray(payload);
  const record = isArray ? null : asRecord(payload);
  if (!isArray && !record) return null;

  const rawTasks = isArray ? payload : record?.tasks;
  const tasks = coerceTasks(rawTasks);
  if (!tasks) return null;

  const rawClusters = isArray ? [] : record?.clusters;
  const stored = Array.isArray(rawClusters)
    ? rawClusters
        .map((row) => coerceCluster(row, now))
        .filter((cluster): cluster is Cluster => cluster !== null)
    : [];

  const clusters: Cluster[] = [];
  const seen = new Set<string>();
  stored.forEach((cluster) => {
    if (seen.has(cluster.id)) return;
    seen.add(cluster.id);
    clusters.push(cluster);
  });

  // A cluster list lost whole leaves its tasks pointing at ids that are now the
  // only surviving record of those projects, so they are rebuilt from the tasks
  // rather than collapsing every project into one. Only when nothing survived:
  // while any cluster is left, an unknown id is one orphan to adopt below, not
  // evidence of a project.
  if (clusters.length === 0) {
    tasks.forEach((task) => {
      const id = task.clusterId;
      if (typeof id !== "string" || !id || seen.has(id)) return;
      seen.add(id);
      clusters.push({ id, name: DEFAULT_CLUSTER_NAME, createdAt: now });
    });
  }

  // Something live has to exist for the board to stand on -- a first launch, or
  // a board whose every project has been sent to the ether.
  if (!clusters.some(isLive)) {
    const home = makeCluster(DEFAULT_CLUSTER_NAME, now, DEFAULT_CLUSTER_ID);
    clusters.push(seen.has(home.id) ? { ...home, id: `${home.id}_${now}` } : home);
  }

  const fallback = clusters.find(isLive)!.id;
  const known = new Set(clusters.map((cluster) => cluster.id));

  return {
    clusters,
    tasks: tasks.map((task) =>
      typeof task.clusterId === "string" && known.has(task.clusterId)
        ? task
        : { ...task, clusterId: fallback }
    ),
  };
};
