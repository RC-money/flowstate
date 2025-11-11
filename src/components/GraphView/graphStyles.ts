import type { Task } from "../../App";
import type { GraphLink, GraphNode } from "./graphTransforms";

type ColumnID = Task["status"] extends string ? Task["status"] : string;

/**
 * Palette reference:
 * --accent-cyan: 190 83% 60%
 * --accent-indigo: 258 81% 64%
 * --accent-emerald: 150 78% 58%
 * --muted: 220 20% 30%
 * --muted-strong: 220 30% 50%
 */
export const nodeColor = (status: ColumnID, blocked?: boolean): string => {
  if (blocked) return "hsl(var(--muted-strong))";
  switch (status) {
    case "TO-DO":
      return "hsl(var(--accent-cyan))";
    case "IN PROGRESS":
      return "hsl(var(--accent-indigo))";
    case "DONE":
      return "hsl(var(--accent-emerald))";
    default:
      return "hsl(var(--muted))";
  }
};

export const nodeSize = (deps: number): number => {
  if (!Number.isFinite(deps) || deps <= 0) return 10;
  const clamped = Math.min(4, Math.max(0, deps));
  return 10 + clamped * 2;
};

const getCoreRadius = (node: GraphNode, globalScale: number): number => {
  const base = nodeSize(node.deps);
  const scale = Math.max(0.6, 1 / Math.sqrt(globalScale || 1));
  return base * scale;
};

type RenderableGraphNode = GraphNode & { x?: number; y?: number };

export const drawNode = (
  node: RenderableGraphNode,
  ctx: CanvasRenderingContext2D,
  opts: { globalScale: number; highlighted: boolean; hovered: boolean }
) => {
  const radius = getCoreRadius(node, opts.globalScale);
  const color = nodeColor(node.status, node.blocked);
  const haloColor = opts.highlighted
    ? "rgba(255,255,255,0.35)"
    : "rgba(17,24,39,0.0)";

  ctx.save();
  if (opts.highlighted || opts.hovered) {
    ctx.shadowColor = haloColor;
    ctx.shadowBlur = opts.hovered ? radius * 2.5 : radius * 1.5;
  }

  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.strokeStyle = opts.hovered ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.15)";
  ctx.lineWidth = opts.hovered ? 2 : 1;
  ctx.arc(node.x ?? 0, node.y ?? 0, radius, 0, 2 * Math.PI);
  ctx.fill();
  ctx.stroke();
  ctx.closePath();
  ctx.restore();
};

export const getLinkColor = (
  link: GraphLink,
  highlighted: boolean
): string => {
  if (highlighted) return "hsl(var(--accent-cyan))";
  return link.kind === "dependency"
    ? "hsl(var(--muted-strong))"
    : "hsl(var(--muted))";
};

export const getLinkWidth = (
  link: GraphLink,
  highlighted: boolean
): number => (highlighted || link.kind === "dependency" ? 2 : 1);

export const getParticleColor = (
  link: GraphLink,
  highlighted: boolean
): string => {
  if (highlighted) return "hsl(var(--accent-cyan))";
  return link.kind === "dependency"
    ? "rgba(148, 197, 253, 0.9)"
    : "rgba(148, 163, 184, 0.7)";
};

export const legendSwatches = [
  { label: "To-Do", color: "hsl(var(--accent-cyan))", kind: "node" },
  { label: "In Progress", color: "hsl(var(--accent-indigo))", kind: "node" },
  { label: "Done", color: "hsl(var(--accent-emerald))", kind: "node" },
  { label: "Blocked", color: "hsl(var(--muted-strong))", kind: "node" },
  { label: "Dependency", color: "hsl(var(--muted-strong))", kind: "link", dashed: false },
  { label: "Temporal", color: "hsl(var(--muted))", kind: "link", dashed: true },
] as const;
