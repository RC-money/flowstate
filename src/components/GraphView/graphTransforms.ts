import type { Task } from "../../App";
import { decayLevel } from "../../lib/orbitalDecay";

type ColumnID = Task["status"] extends string ? Task["status"] : string;

export type GraphNode = {
  id: string;
  status: ColumnID;
  blocked?: boolean;
  deps: number;
  tags?: string[];
  /** 0 fresh .. 1 fully neglected. Dims the body and feeds Dark Forest suggestions. */
  decay?: number;
  subtaskTotal?: number;
  subtaskDone?: number;
  subtaskMoons?: Array<{ moon: number; done: boolean; title?: string }>;
};

export type GraphLink = {
  source: string;
  target: string;
  /** Only shared tags draw lines now -- relationships the user actually made. */
  kind: "tag";
};

export type GraphData = {
  nodes: GraphNode[];
  links: GraphLink[];
};

type TaskLike = Task & {
  dependsOn?: unknown;
  updatedAt?: unknown;
  blocked?: unknown;
  tags?: unknown;
};

const parseId = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
};

const parseTimestamp = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const ts = Date.parse(value);
    if (!Number.isNaN(ts)) return ts;
  }
  return 0;
};

const normalizeTags = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const tags = value
    .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
    .filter(Boolean);
  return tags.length ? Array.from(new Set(tags)) : undefined;
};

const normalizeDependsOn = (value: unknown, currentId: string): string[] => {
  if (!Array.isArray(value)) return [];
  const ids = value
    .map(parseId)
    .filter((id): id is string => Boolean(id) && id !== currentId);
  return ids.length ? Array.from(new Set(ids)) : [];
};

const linkSignature = (link: GraphLink): string =>
  `${link.kind}:${link.source}->${link.target}`;

export const tasksToGraph = (tasks: Task[]): GraphData => {
  const safeTasks = Array.isArray(tasks) ? (tasks as TaskLike[]) : [];

  // Blocked means waiting on work that is not finished yet -- read from
  // dependsOn rather than a flag, because nothing ever set a flag. Finished is
  // completedAt, not a column name, so this survives a board renaming its own
  // columns. A dependency that no longer exists blocks nothing: the thing it
  // was waiting for is gone.
  const finished = new Set(
    safeTasks
      .filter((entry) => (entry as Task).completedAt !== undefined)
      .map((entry) => parseId(entry.id))
      .filter((id): id is string => id !== null)
  );
  const known = new Set(
    safeTasks.map((entry) => parseId(entry.id)).filter((id): id is string => id !== null)
  );

  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const seenNodeIds = new Set<string>();
  const seenLinks = new Set<string>();
  const statusBuckets = new Map<ColumnID, Array<{ id: string; updatedAt: number }>>();

  safeTasks.forEach((task) => {
    if (!task || typeof task !== "object") return;
    const id = parseId(task.id) ?? null;
    if (!id || seenNodeIds.has(id)) return;

    const status = (task.status ?? "TO-DO") as ColumnID;
    const tags = normalizeTags((task as TaskLike).tags);
    const dependsOn = normalizeDependsOn((task as TaskLike).dependsOn, id);
    // A task that is itself finished is not waiting on anything any more.
    const blocked =
      (task as Task).completedAt === undefined &&
      dependsOn.some((needed) => known.has(needed) && !finished.has(needed));

    // Completed work does not decay -- the sky already holds it.
    const decay =
      status === "DONE" ? 0 : decayLevel(parseTimestamp((task as TaskLike).updatedAt), Date.now());

    const subtasks = Array.isArray((task as Task).subtasks) ? (task as Task).subtasks! : [];
    nodes.push({
      id,
      status,
      blocked,
      deps: dependsOn.length,
      ...(decay > 0 ? { decay } : {}),
      ...(tags ? { tags } : {}),
      ...(subtasks.length
        ? {
            subtaskTotal: subtasks.length,
            subtaskDone: subtasks.filter((s) => s.done).length,
            subtaskMoons: subtasks.map((s) => ({ moon: s.moon ?? 0, done: s.done, title: s.title })),
          }
        : {}),
    });
    seenNodeIds.add(id);

    if (!statusBuckets.has(status)) statusBuckets.set(status, []);
    statusBuckets.get(status)?.push({
      id,
      updatedAt: parseTimestamp((task as TaskLike).updatedAt),
    });

  });

  // Tag gravity: tasks sharing a tag are chained oldest-to-newest. A chain
  // keeps the cluster connected for the constellation analyzer without the
  // n-squared clique a full mesh would draw. Dependencies between the same
  // pair win -- the tag link would only duplicate the line.
  const tagBuckets = new Map<string, Array<{ id: string; createdAt: number }>>();
  safeTasks.forEach((task) => {
    const id = parseId(task.id);
    if (!id) return;
    const tags = normalizeTags((task as TaskLike).tags) ?? [];
    tags.forEach((tag) => {
      const key = tag.toLowerCase();
      if (!tagBuckets.has(key)) tagBuckets.set(key, []);
      tagBuckets.get(key)?.push({ id, createdAt: parseTimestamp((task as TaskLike).createdAt) });
    });
  });
  const pairAlreadyLinked = (a: string, b: string) =>
    links.some(
      (link) =>
        (link.source === a && link.target === b) || (link.source === b && link.target === a)
    );
  tagBuckets.forEach((bucket) => {
    if (bucket.length < 2) return;
    const sorted = bucket.slice().sort((x, y) => x.createdAt - y.createdAt);
    for (let i = 0; i < sorted.length - 1; i += 1) {
      const source = sorted[i].id;
      const target = sorted[i + 1].id;
      if (source === target || pairAlreadyLinked(source, target)) continue;
      const link: GraphLink = { source, target, kind: "tag" };
      const sig = linkSignature(link);
      if (!seenLinks.has(sig)) {
        seenLinks.add(sig);
        links.push(link);
      }
    }
  });


  return { nodes, links };
};

export const buildGraphData = (tasks: Task[]): GraphData => tasksToGraph(tasks);
