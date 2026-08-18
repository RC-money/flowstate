import type { Task } from "../../App";
import type { GraphLink, GraphNode } from "./graphTransforms";

type ColumnID = Task["status"] extends string ? Task["status"] : string;

export const STATUS_COLORS = {
  "TO-DO": { core: "#47A3F3", glow: "rgba(71,163,243,0.45)" },
  "IN PROGRESS": { core: "#F7B84B", glow: "rgba(247,184,75,0.45)" },
  DONE: { core: "#4ADE80", glow: "rgba(74,222,128,0.45)" },
} as const;

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
  const raw = base * scale;
  return Math.max(6, Math.min(14, raw));
};

type RenderableGraphNode = GraphNode & { x?: number; y?: number };

export const drawNode = (
  node: RenderableGraphNode,
  ctx: CanvasRenderingContext2D,
  opts: { globalScale: number; highlighted: boolean; hovered: boolean }
) => {
  const radius = getCoreRadius(node, opts.globalScale);
  const statusKey = (node.status ?? "TO-DO") as keyof typeof STATUS_COLORS;
  const palette = STATUS_COLORS[statusKey] ?? STATUS_COLORS["TO-DO"];
  const planetCenterX = node.x ?? 0;
  const planetCenterY = node.y ?? 0;

  const decay = node.decay ?? 0;
  const vitality = 1 - decay * 0.72; // fully decayed bodies keep a faint ember

  ctx.save();
  // Glow aura -- neglect dims it first
  ctx.globalAlpha = 0.35 * Math.max(0.08, 1 - decay * 1.15);
  ctx.fillStyle = palette.glow;
  ctx.filter = "blur(6px)";
  ctx.beginPath();
  ctx.arc(planetCenterX, planetCenterY, radius * 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.closePath();
  ctx.restore();

  const gradient = ctx.createRadialGradient(
    planetCenterX,
    planetCenterY,
    radius * 0.1,
    planetCenterX,
    planetCenterY,
    radius
  );
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.35, palette.core);
  gradient.addColorStop(1, palette.core);

  ctx.save();
  if (opts.highlighted || opts.hovered) {
    ctx.shadowColor = palette.glow;
    ctx.shadowBlur = opts.hovered ? radius * 3 : radius * 1.5;
  }
  ctx.globalAlpha = vitality;
  ctx.beginPath();
  ctx.fillStyle = gradient;
  ctx.strokeStyle = opts.hovered ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.12)";
  ctx.lineWidth = opts.hovered ? 1.75 : 1;
  ctx.arc(planetCenterX, planetCenterY, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.globalAlpha = 1;
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
