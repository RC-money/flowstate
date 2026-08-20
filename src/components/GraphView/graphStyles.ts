import type { Task } from "../../App";
import solUrl from "../../assets/suns/sol.png";
import coronaUrl from "../../assets/suns/corona.png";
import furnaceUrl from "../../assets/suns/furnace.png";
import cinderUrl from "../../assets/suns/cinder.png";
import alabasterUrl from "../../assets/suns/alabaster.png";
import frostUrl from "../../assets/suns/frost.png";
import sapphireUrl from "../../assets/suns/sapphire.png";
import moon0 from "../../assets/moons/moon0.png";
import moon1 from "../../assets/moons/moon1.png";
import moon2 from "../../assets/moons/moon2.png";
import moon3 from "../../assets/moons/moon3.png";
import moon4 from "../../assets/moons/moon4.png";
import moon5 from "../../assets/moons/moon5.png";
import moon6 from "../../assets/moons/moon6.png";

// Planet portraits rendered once from the source GLB models (70MB each --
// never shipped; regenerate via a three.js GLTFLoader scene at 256px if the
// art changes). Loaded lazily; the gradient core paints until they arrive.
const loadSprite = (url: string): HTMLImageElement | null => {
  if (typeof Image === "undefined") return null;
  const img = new Image();
  img.src = url;
  return img;
};

const MOON_SPRITES: Array<HTMLImageElement | null> = [
  moon0, moon1, moon2, moon3, moon4, moon5, moon6,
].map(loadSprite);

/**
 * Every body a column can fly. Moons double as planets -- at planet scale they
 * read as small dense worlds, which is exactly what a moon portrait is.
 */
/**
 * The stars HELIOS can burn. Sol is rendered from the source GLB at 256px like
 * the planets; the rest are portraits at the same size.
 */
const SUN_SPRITES: Record<SunId, HTMLImageElement | null> = {
  sol: loadSprite(solUrl),
  corona: loadSprite(coronaUrl),
  furnace: loadSprite(furnaceUrl),
  cinder: loadSprite(cinderUrl),
  alabaster: loadSprite(alabasterUrl),
  frost: loadSprite(frostUrl),
  sapphire: loadSprite(sapphireUrl),
};

export const sunSpriteFor = (id: SunId): HTMLImageElement | null =>
  SUN_SPRITES[id] ?? SUN_SPRITES.sol;

const SKIN_SPRITES: Record<SkinId, HTMLImageElement | null> = {
  moon0: MOON_SPRITES[0],
  moon1: MOON_SPRITES[1],
  moon2: MOON_SPRITES[2],
  moon3: MOON_SPRITES[3],
  moon4: MOON_SPRITES[4],
  moon5: MOON_SPRITES[5],
  moon6: MOON_SPRITES[6],
};

/**
 * How far the orbital plane is tipped away from edge-on. 1 would be a flat
 * circle seen face-on (no front or back); 0 an invisible edge. This reads as a
 * shallow tilt, which is what gives moons a near and a far side.
 */
const ORBIT_TILT = 0.42;

/**
 * The view rotation, mirrored here so the canvas renderer can tip a planet's
 * rings and moons into the same space the system is being viewed from. Set
 * from GraphView; drawNode is not a component and cannot subscribe.
 */
let currentView: ViewRotation = IDENTITY_ROTATION;
export const setGraphViewRotation = (rotation: ViewRotation): void => {
  currentView = rotation;
};

/** Expands #rrggbb into an rgba() glow at the given alpha. */
const glowFrom = (hex: string, alpha: number): string => {
  const full =
    hex.length === 4
      ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
      : hex;
  const r = parseInt(full.slice(1, 3), 16);
  const g = parseInt(full.slice(3, 5), 16);
  const b = parseInt(full.slice(5, 7), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return `rgba(148,163,184,${alpha})`;
  return `rgba(${r},${g},${b},${alpha})`;
};
import type { GraphLink, GraphNode } from "./graphTransforms";
import { getCelestialPrefs } from "../../lib/celestialStore";
import {
  moonTintForStatus,
  skinById,
  type SkinId,
  type StatusKey,
  type SunId,
} from "../../lib/celestialPrefs";
import { rotatePoint, IDENTITY_ROTATION, type ViewRotation } from "../../lib/viewRotation";
import {
  moonInclination,
  moonShells,
  planetScale,
  shellMoonAngle,
  shellOf,
  shellOrientation,
  shellStartIndex,
  subtaskHeaviness,
} from "../../lib/orbitalMechanics";

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
  return Math.max(6, Math.min(18, raw));
};

type RenderableGraphNode = GraphNode & { x?: number; y?: number };

export const drawNode = (
  node: RenderableGraphNode,
  ctx: CanvasRenderingContext2D,
  opts: { globalScale: number; highlighted: boolean; hovered: boolean }
) => {
  const statusKey = (node.status ?? "TO-DO") as keyof typeof STATUS_COLORS;
  const moons = node.subtaskMoons;
  const moonCount = moons?.length ?? 0;

  // A task carrying subtasks has more mass, so its body swells. Bodies only
  // ever grow from the base size -- they stay chubby, never pinched.
  const radius = getCoreRadius(node, opts.globalScale) * planetScale(moonCount);

  const prefs = getCelestialPrefs();
  const skin = skinById(prefs.statusSkins[statusKey as StatusKey]);
  const moonTint = moonTintForStatus(prefs, statusKey as StatusKey);
  const palette = { core: skin.accent, glow: glowFrom(skin.accent, 0.45) };
  const planetCenterX = node.x ?? 0;
  const planetCenterY = node.y ?? 0;
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();

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

  const sprite = SKIN_SPRITES[skin.id] ?? null;
  const spriteReady = Boolean(sprite && sprite.complete && sprite.naturalWidth > 0);

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
  // Subtasks orbit as their own moons -- each was dealt one at random when it
  // was created. Done moons at full presence with a warm glow; pending ones
  // are dim silhouettes waiting to be lit.
  //
  // The orbit is a tilted plane rather than a flat ring, so a moon passes
  // behind the planet on the far side and in front of it on the near side.
  // sin(angle) is the depth: +1 is nearest the viewer, -1 is furthest.
  // Moons fill shells like electrons: two in the innermost, then eight, and so
  // on. Each shell is its own orbit at its own radius, which is what turns a
  // busy task from a dot in a ring into something with structure.
  const shells = moonShells(moonCount);
  const shellRadius = (shell: number) => radius * (1.5 + shell * 0.62);
  // Horizontal, then stood upright against it, then cocked between the two.
  const shellRotation = (shell: number) => shellOrientation(shell);

  const placements = (moons ?? []).map((entry, i) => {
    const shell = shellOf(i, moonCount);
    const orbitR = shellRadius(shell);
    // Spacing is a share of this ring alone: four moons on a ring stand a
    // quarter turn apart however many the planet carries in total. A crowded
    // ring turns slowly, a heavy subtask slower still, and each ring out lags
    // again -- all of it in the period, never in the spacing.
    const size = shells[shell] ?? 1;
    const angle = shellMoonAngle({
      indexInShell: i - shellStartIndex(shell, moonCount),
      shellSize: size,
      shell,
      now,
      heaviness: subtaskHeaviness(entry.title),
    });
    const depth = Math.sin(angle);
    const nearness = (depth + 1) / 2; // 0 far, 1 near
    // Moons on one ring share its plane, so the ring stays a ring.
    const tilt = moonInclination(shell);
    // Place on the shell's own ellipse, then tip it into the shell's plane.
    const lx = Math.cos(angle) * orbitR;
    const ly = depth * orbitR * tilt;
    const rot = shellRotation(shell);
    const cosR = Math.cos(rot);
    const sinR = Math.sin(rot);
    // Tip the ring into its own plane, then into the plane you are viewing the
    // whole system from, so an atom leans with its galaxy.
    const local = rotatePoint(
      { x: lx * cosR - ly * sinR, y: lx * sinR + ly * cosR, z: 0 },
      currentView
    );
    return {
      entry,
      sx: planetCenterX + local.x,
      sy: planetCenterY + local.y,
      // Near moons read bigger; the parallax is what sells the tilt.
      moonR: Math.max(1.6, radius * 0.22 * (0.76 + 0.36 * nearness)),
      inFront: depth > 0,
    };
  });

  const drawMoon = (p: (typeof placements)[number]) => {
    const moonSprite = MOON_SPRITES[p.entry.moon % MOON_SPRITES.length];
    const ready = Boolean(moonSprite && moonSprite.complete && moonSprite.naturalWidth > 0);
    ctx.save();
    ctx.globalAlpha = p.entry.done ? 1 : 0.34;
    // Every moon carries the colour, finished ones just burn brighter. Glowing
    // only the finished ones meant a fresh task showed no colour at all, which
    // read as the setting doing nothing.
    if (prefs.moonGlow) {
      ctx.shadowColor = glowFrom(moonTint, p.entry.done ? 0.9 : 0.4);
      ctx.shadowBlur = p.entry.done ? 9 : 4;
    }
    if (ready && moonSprite) {
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, p.moonR, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(moonSprite, p.sx - p.moonR, p.sy - p.moonR, p.moonR * 2, p.moonR * 2);
      // "color" takes the hue and leaves the sprite's own light alone, so the
      // craters survive. Multiply only ever darkened -- a pale tint did nothing
      // and a dark one turned the moon to mud, which is why this looked broken.
      ctx.globalCompositeOperation = "color";
      ctx.globalAlpha = 1;
      ctx.fillStyle = moonTint;
      ctx.fillRect(p.sx - p.moonR, p.sy - p.moonR, p.moonR * 2, p.moonR * 2);
    } else {
      ctx.fillStyle = p.entry.done ? moonTint : "rgba(148,163,184,0.6)";
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, p.moonR * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  /** Half of one shell's ring, in the same tilted plane as its moons. */
  const strokeShellArc = (shell: number, from: number, to: number) => {
    const r = shellRadius(shell);
    ctx.save();
    // Outer shells sit fainter, so the innermost reads as the tightest bond.
    ctx.globalAlpha = (0.5 - shell * 0.09) * vitality;
    ctx.strokeStyle = glowFrom(skin.accent, 0.9);
    ctx.lineWidth = Math.max(0.7, radius * 0.055);
    const rot = shellRotation(shell);
    const cosR = Math.cos(rot);
    const sinR = Math.sin(rot);
    const STEPS = 40;
    ctx.beginPath();
    for (let i = 0; i <= STEPS; i += 1) {
      const a = from + ((to - from) * i) / STEPS;
      const ex = Math.cos(a) * r;
      const ey = Math.sin(a) * r * ORBIT_TILT;
      const p = rotatePoint(
        { x: ex * cosR - ey * sinR, y: ex * sinR + ey * cosR, z: 0 },
        currentView
      );
      const px = planetCenterX + p.x;
      const py = planetCenterY + p.y;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  };

  // Far side first: the planet will be painted over these.
  shells.forEach((_, shell) => strokeShellArc(shell, Math.PI, Math.PI * 2));
  placements.filter((p) => !p.inFront).forEach(drawMoon);

  ctx.globalAlpha = vitality;
  if (spriteReady && sprite) {
    // The model portrait, clipped to the body circle so decay dimming and the
    // hover ring behave identically to the painted planets.
    ctx.save();
    ctx.beginPath();
    ctx.arc(planetCenterX, planetCenterY, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(sprite, planetCenterX - radius, planetCenterY - radius, radius * 2, radius * 2);
    ctx.restore();
    ctx.beginPath();
    ctx.strokeStyle = opts.hovered ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.12)";
    ctx.lineWidth = opts.hovered ? 1.75 : 1;
    ctx.arc(planetCenterX, planetCenterY, radius, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.fillStyle = gradient;
    ctx.strokeStyle = opts.hovered ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.12)";
    ctx.lineWidth = opts.hovered ? 1.75 : 1;
    ctx.arc(planetCenterX, planetCenterY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.closePath();

  // Near side last, so these cross in front of the body.
  shells.forEach((_, shell) => strokeShellArc(shell, 0, Math.PI));
  placements.filter((p) => p.inFront).forEach(drawMoon);

  ctx.restore();
};

export const getLinkColor = (
  _link: GraphLink,
  highlighted: boolean
): string => (highlighted ? "hsl(var(--accent-cyan))" : "rgba(165, 175, 255, 0.16)");

export const getLinkWidth = (
  _link: GraphLink,
  highlighted: boolean
): number => (highlighted ? 1.2 : 0.8);

export const getParticleColor = (
  _link: GraphLink,
  highlighted: boolean
): string => (highlighted ? "hsl(var(--accent-cyan))" : "rgba(148, 163, 184, 0.7)");

export const legendSwatches = [
  { label: "To-Do", color: "hsl(var(--accent-cyan))", kind: "node" },
  { label: "In Progress", color: "hsl(var(--accent-indigo))", kind: "node" },
  { label: "Done", color: "hsl(var(--accent-emerald))", kind: "node" },
  { label: "Blocked", color: "hsl(var(--muted-strong))", kind: "node" },
  { label: "Shared tag", color: "rgba(165, 175, 255, 0.6)", kind: "link", dashed: true },
] as const;
