import type { Constellation } from "../../types/celestial";

/**
 * Carries user-given names (and original ages) across re-analysis. The
 * analyzer rebuilds constellations from scratch each pass, so without this a
 * rename would survive exactly one animation of the graph. A successor
 * inherits a name when it keeps at least half the ancestor's members; if a
 * cluster splits, the largest overlap wins and the name goes to one child only.
 */
export const mergeConstellations = (
  previous: Constellation[],
  next: Constellation[]
): Constellation[] => {
  if (!previous.length) return next;

  const named = previous.filter((p) => p.name);
  const claimed = new Set<string>();
  const result = next.map((candidate) => ({ ...candidate }));

  for (const ancestor of named) {
    const ancestorSet = new Set(ancestor.memberIds);
    let best: { index: number; overlap: number } | null = null;

    result.forEach((candidate, index) => {
      if (claimed.has(candidate.id)) return;
      const overlap = candidate.memberIds.filter((id) => ancestorSet.has(id)).length;
      if (overlap * 2 >= ancestorSet.size && (!best || overlap > best.overlap)) {
        best = { index, overlap };
      }
    });

    if (best !== null) {
      const winner = result[(best as { index: number }).index];
      winner.name = ancestor.name;
      winner.createdAt = Math.min(winner.createdAt, ancestor.createdAt);
      claimed.add(winner.id);
    }
  }

  // Unnamed ancestors still donate their age to an identical successor.
  const prevById = new Map(previous.map((p) => [p.id, p]));
  for (const candidate of result) {
    const ancestor = prevById.get(candidate.id);
    if (ancestor) candidate.createdAt = Math.min(candidate.createdAt, ancestor.createdAt);
  }

  return result;
};
