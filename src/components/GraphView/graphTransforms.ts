import type { Task } from "../../App";

type ColumnID = Task["status"] extends string ? Task["status"] : string;

export type GraphNode = {
  id: string;
  status: ColumnID;
  blocked?: boolean;
  deps: number;
  tags?: string[];
};

export type GraphLink = {
  source: string;
  target: string;
  kind: "dependency" | "temporal";
};

export type GraphData = {
  nodes: GraphNode[];
  links: GraphLink[];
};

export interface TasksToGraphOptions {
  showTemporal: boolean;
}

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

export const tasksToGraph = (
  tasks: Task[],
  opts: TasksToGraphOptions
): GraphData => {
  const safeTasks = Array.isArray(tasks) ? (tasks as TaskLike[]) : [];
  const showTemporal = Boolean(opts?.showTemporal);

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
    const blocked =
      typeof task.blocked === "boolean"
        ? task.blocked
        : typeof (task as TaskLike).blocked === "boolean"
        ? (task as TaskLike).blocked
        : undefined;
    const tags = normalizeTags((task as TaskLike).tags);
    const dependsOn = normalizeDependsOn((task as TaskLike).dependsOn, id);

    nodes.push({
      id,
      status,
      blocked,
      deps: dependsOn.length,
      ...(tags ? { tags } : {}),
    });
    seenNodeIds.add(id);

    if (!statusBuckets.has(status)) statusBuckets.set(status, []);
    statusBuckets.get(status)?.push({
      id,
      updatedAt: parseTimestamp((task as TaskLike).updatedAt),
    });

    dependsOn.forEach((depId) => {
      if (depId === id) return;
      const link: GraphLink = {
        source: depId,
        target: id,
        kind: "dependency",
      };
      const sig = linkSignature(link);
      if (!seenLinks.has(sig)) {
        seenLinks.add(sig);
        links.push(link);
      }
    });
  });

  if (showTemporal) {
    statusBuckets.forEach((bucket) => {
      const sorted = bucket.sort((a, b) => a.updatedAt - b.updatedAt);
      for (let i = 0; i < sorted.length - 1; i += 1) {
        const source = sorted[i]?.id;
        const target = sorted[i + 1]?.id;
        if (!source || !target || source === target) continue;
        const link: GraphLink = { source, target, kind: "temporal" };
        const sig = linkSignature(link);
        if (!seenLinks.has(sig)) {
          seenLinks.add(sig);
          links.push(link);
        }
      }
    });
  }

  return { nodes, links };
};

export const buildGraphData = (
  tasks: Task[],
  prefs?: { showTemporal?: boolean }
): GraphData => {
  const showTemporal = Boolean(prefs?.showTemporal);
  return tasksToGraph(tasks, { showTemporal });
};
