import type { Task } from "../../hooks/useLocalTasks";
import type { Constellation, Tether } from "../../types/celestial";

export interface PositionMap {
  [taskId: string]: { x: number; y: number };
}

const MIN_SIZE = 3;
const MAX_DISTANCE = 220;

const suggestName = (tasks: Task[], members: string[]): string => {
  // A tag every member carries is the cluster's real name -- the user already
  // named this work, one label at a time.
  const memberTasks = members
    .map((id) => tasks.find((task) => task.id === id))
    .filter((task): task is Task => Boolean(task));
  if (memberTasks.length === members.length && memberTasks.length > 0) {
    const first = (memberTasks[0].tags ?? []).map((tag) => tag.toLowerCase());
    const shared = first.find((tag) =>
      memberTasks.every((task) => (task.tags ?? []).some((t) => t.toLowerCase() === tag))
    );
    if (shared) return shared.charAt(0).toUpperCase() + shared.slice(1);
  }

  const keywords = memberTasks.map((task) => task.title.split(/\s+/)[0]).filter(Boolean);
  if (!keywords.length) {
    return `Constellation-${Math.random().toString(36).slice(2, 5)}`;
  }
  return `${keywords[0]}-${keywords.length}`;
};

export const analyzeConstellations = (
  tasks: Task[],
  tethers: Tether[],
  positions: PositionMap
): Constellation[] => {
  if (!tethers.length) return [];
  const adjacency = new Map<string, Set<string>>();
  tethers.forEach((tether) => {
    if (!adjacency.has(tether.sourceId)) adjacency.set(tether.sourceId, new Set());
    if (!adjacency.has(tether.targetId)) adjacency.set(tether.targetId, new Set());
    adjacency.get(tether.sourceId)?.add(tether.targetId);
    adjacency.get(tether.targetId)?.add(tether.sourceId);
  });
  const visited = new Set<string>();
  const constellations: Constellation[] = [];

  const visit = (start: string) => {
    const queue = [start];
    const members = new Set<string>();
    while (queue.length) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      members.add(current);
      adjacency.get(current)?.forEach((neighbor) => {
        if (!visited.has(neighbor)) queue.push(neighbor);
      });
    }
    return members;
  };

  Array.from(adjacency.keys()).forEach((nodeId) => {
    if (visited.has(nodeId)) return;
    const members = visit(nodeId);
    if (members.size < MIN_SIZE) return;
    const coords = Array.from(members).map((id) => positions[id]).filter(Boolean);
    if (!coords.length) return;
    const centroid = coords.reduce(
      (acc, coord) => {
        acc.x += coord.x;
        acc.y += coord.y;
        return acc;
      },
      { x: 0, y: 0 }
    );
    centroid.x /= coords.length;
    centroid.y /= coords.length;
    const density =
      coords.filter((coord) => distance(coord, centroid) < MAX_DISTANCE).length / coords.length;
    const isNursery = members.size <= 4;
    constellations.push({
      id: `constellation-${Array.from(members).join("-")}`,
      memberIds: Array.from(members),
      centroid,
      density,
      suggestedName: suggestName(tasks, Array.from(members)),
      createdAt: Date.now(),
      kind: isNursery ? "nursery" : "constellation",
    });
  });

  return constellations;
};

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
};
