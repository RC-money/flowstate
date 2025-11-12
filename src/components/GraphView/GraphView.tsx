import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ForceGraph2D, {
  type ForceGraphMethods,
  type LinkObject,
} from "react-force-graph-2d";
// @ts-expect-error - d3-force-3d ships without type declarations
import { forceX as d3ForceX, forceY as d3ForceY } from "d3-force-3d";
import type { Task } from "../../App";
import {
  buildGraphData,
  type GraphData,
  type GraphLink,
  type GraphNode,
} from "./graphTransforms";
import {
  drawNode,
  getLinkColor,
  getLinkWidth,
  getParticleColor,
  legendSwatches,
} from "./graphStyles";
import GraphControls from "./GraphControls";
import Starfield from "./Starfield";
import { logEvent } from "../../lib/analytics";

type BaseStarfieldProps = React.ComponentProps<typeof Starfield>;
type EnhancedStarfieldProps = BaseStarfieldProps & {
  event?: StarfieldEventType | null;
  nodePositions?: NodePosition[];
};
const EnhancedStarfield = Starfield as React.ComponentType<EnhancedStarfieldProps>;

type ClusterMode = "none" | "column" | "tag";
type GraphPreset = "planning" | "focus";
type LegendKey = (typeof legendSwatches)[number]["label"];
const LEGEND_KEYS = legendSwatches.map((swatch) => swatch.label) as LegendKey[];
const LEGEND_KEY_SET = new Set<LegendKey>(LEGEND_KEYS);
type Debounced<T extends (...args: any[]) => void> = ((...args: Parameters<T>) => void) & {
  cancel: () => void;
};

const debounce = <T extends (...args: any[]) => void>(fn: T, delay = 75): Debounced<T> => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const debounced = ((...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      fn(...args);
    }, delay);
  }) as Debounced<T>;
  debounced.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };
  return debounced;
};

export interface GraphPreferences {
  clusterMode?: ClusterMode;
  showTemporal?: boolean;
  showLabels?: boolean;
  labelMode?: "hover" | "always";
  showStarfield?: boolean;
  autoLock?: boolean;
  locked?: boolean;
  preset?: GraphPreset;
  cohesion?: number;
  spacing?: number;
  legendKeys?: LegendKey[];
}

interface GraphViewProps {
  tasks: Task[];
  onOpenTask(id: string): void;
  prefs?: GraphPreferences;
}

const DEFAULT_COHESION = 70;
const DEFAULT_SPACING = 90;
const DEFAULT_STRONG = -DEFAULT_COHESION;
const DEFAULT_CHARGE = -DEFAULT_SPACING;
const CLUSTER_STRENGTH = 0.35;
const COLUMN_TARGETS: Record<"todo" | "inprogress" | "done", { x: number; y: number }> = {
  todo: { x: -220, y: 0 },
  inprogress: { x: 0, y: 0 },
  done: { x: 220, y: 0 },
};
const TAG_CLUSTER_RADIUS = 260;
const MAX_TAG_CLUSTERS = 5;
const AUTO_LOCK_DELAY = 2500;
const GRAPH_BACKGROUND_TINTS: Record<
  keyof typeof COLUMN_TARGETS,
  { r: number; g: number; b: number; a: number }
> = {
  todo: { r: 0, g: 191, b: 255, a: 0.05 },
  inprogress: { r: 93, g: 63, b: 211, a: 0.06 },
  done: { r: 16, g: 185, b: 129, a: 0.06 },
};
const GRAPH_BACKGROUND_TRANSITION = "background-color 3000ms ease";
const DEFAULT_GRAPH_PREFS: GraphPreferences = {
  clusterMode: "column",
  showTemporal: false,
  showLabels: false,
  labelMode: "hover",
  showStarfield: true,
  autoLock: true,
  locked: true,
  preset: "planning",
  cohesion: DEFAULT_COHESION,
  spacing: DEFAULT_SPACING,
};

let driftStarsInjected = false;
const ensureDriftStars = () => {
  if (driftStarsInjected || typeof document === "undefined") {
    return;
  }
  const style = document.createElement("style");
  style.textContent = `
    @keyframes driftStars {
      0% { transform: translate3d(0, 0, 0); }
      50% { transform: translate3d(-80px, -50px, 0); }
      100% { transform: translate3d(0, 0, 0); }
    }
  `;
  document.head.appendChild(style);
  driftStarsInjected = true;
};

const normalizeStatusKey = (status?: string): keyof typeof COLUMN_TARGETS => {
  if (!status) return "todo";
  const normalized = status.replace(/[\s-]/g, "").toLowerCase();
  if (normalized === "inprogress") return "inprogress";
  if (normalized === "done") return "done";
  return "todo";
};

const statusLegendMap: Record<string, LegendKey | undefined> = {
  "TO-DO": "To-Do",
  "IN PROGRESS": "In Progress",
  DONE: "Done",
};

const linkLegendMap: Record<GraphLink["kind"], LegendKey> = {
  dependency: "Dependency",
  temporal: "Temporal",
};

const isLegendKey = (value: unknown): value is LegendKey =>
  typeof value === "string" && LEGEND_KEY_SET.has(value as LegendKey);

const sanitizeLegendKeys = (value: unknown): LegendKey[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const keys = value.filter(isLegendKey) as LegendKey[];
  if (!keys.length) return undefined;
  return Array.from(new Set(keys));
};

type NodePosition = { x: number; y: number };
type StarfieldEventType = "add" | "move" | "complete";
const STARFIELD_TASK_EVENT = "flowstate:task-event";
const KEYBOARD_EDITABLE_SELECTOR = "input, textarea, [contenteditable=\"true\"]";

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!target || typeof window === "undefined") {
    return false;
  }
  const maybeElement = target as Element;
  return Boolean(maybeElement?.closest?.(KEYBOARD_EDITABLE_SELECTOR));
};

const positionsAreEqual = (a: NodePosition[], b: NodePosition[]): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (Math.abs(a[i].x - b[i].x) > 0.5 || Math.abs(a[i].y - b[i].y) > 0.5) {
      return false;
    }
  }
  return true;
};

const getNodeLegendKeys = (node: GraphNode): LegendKey[] => {
  const keys: LegendKey[] = [];
  const normalizedStatus = typeof node.status === "string" ? node.status.toUpperCase() : "";
  const statusKey = statusLegendMap[normalizedStatus];
  if (statusKey) {
    keys.push(statusKey);
  }
  if (node.blocked) {
    keys.push("Blocked");
  }
  return keys;
};

const getLinkLegendKey = (link: GraphLink | LinkObject): LegendKey | null => {
  const key = linkLegendMap[(link as GraphLink).kind];
  return key ?? null;
};

const resolveNodeId = (node: GraphNode | string | number): string => {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  return String(node.id);
};

const linkKey = (link: GraphLink | LinkObject): string => {
  const source = resolveNodeId(link.source as GraphNode | string | number);
  const target = resolveNodeId(link.target as GraphNode | string | number);
  return `${source}->${target}`;
};

const PREFS_STORAGE_KEY = "flowstate:graph-prefs";

const loadStoredPrefs = (): GraphPreferences => {
  if (typeof window === "undefined") {
    return { ...DEFAULT_GRAPH_PREFS };
  }
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        const candidate = parsed as Partial<GraphPreferences> & { legendKeys?: unknown };
        const sanitizedLegendKeys = sanitizeLegendKeys(candidate.legendKeys);
        const { legendKeys: _ignored, ...rest } = candidate;
        return {
          ...DEFAULT_GRAPH_PREFS,
          ...(rest as GraphPreferences),
          ...(sanitizedLegendKeys ? { legendKeys: sanitizedLegendKeys } : {}),
        };
      }
    }
  } catch {
    // ignore hydration failures
  }
  return { ...DEFAULT_GRAPH_PREFS };
};

type ForceGraphInstance = ForceGraphMethods<GraphNode, GraphLink> & {
  d3AlphaTarget?: (alpha: number) => ForceGraphInstance;
  pauseAnimation?: () => void;
  resumeAnimation?: () => void;
  graph2ScreenCoords?: (x: number, y: number) => { x: number; y: number };
  zoom?: (scale?: number, ms?: number) => number;
  cameraPosition?: (
    position?: { x?: number; y?: number; z?: number },
    lookAt?: { x: number; y: number; z: number },
    transitionMs?: number
  ) => ForceGraphInstance | { x: number; y: number; z: number };
};

type DistanceForce = { distance?: (value: number) => void };
type StrengthForce = { strength?: (value: number) => void };

const GraphView: React.FC<GraphViewProps> = ({ tasks, onOpenTask, prefs }) => {
  const fgRef = useRef<ForceGraphInstance | undefined>(undefined);
  const [hoverNode, setHoverNode] = useState<GraphNode | null>(null);
  const [strongForce, setStrongForce] = useState<number>(DEFAULT_STRONG);
  const [chargeForce, setChargeForce] = useState<number>(DEFAULT_CHARGE);
  const [graphPrefs, setGraphPrefs] = useState<GraphPreferences>(() => loadStoredPrefs());
  const [activeLegendKeys, setActiveLegendKeys] = useState<Set<LegendKey>>(
    () => new Set<LegendKey>(graphPrefs.legendKeys && graphPrefs.legendKeys.length ? graphPrefs.legendKeys : LEGEND_KEYS)
  );
  const isLocked = Boolean(graphPrefs.locked);

  const graphData: GraphData = useMemo(
    () => buildGraphData(tasks, graphPrefs),
    [tasks, graphPrefs]
  );
  const [nodePositions, setNodePositions] = useState<NodePosition[]>([]);
  const autoLockTimer = useRef<number | null>(null);
  const prevForceValues = useRef({ strong: strongForce, charge: chargeForce });
  const [cursor, setCursor] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [scrollZoomEnabled, setScrollZoomEnabled] = useState<boolean>(
    () => graphData.nodes.length < 100
  );
  const showStarfield = graphPrefs.showStarfield ?? true;
  const nodePositionsRef = useRef<NodePosition[]>([]);
  const [starfieldEvent, setStarfieldEvent] = useState<StarfieldEventType | null>(null);
  const starfieldEventResetRef = useRef<number | null>(null);
  const filtersDirty = activeLegendKeys.size !== LEGEND_KEYS.length;
  const legendStatusMessage = `Showing: ${activeLegendKeys.size} of ${LEGEND_KEYS.length}`;
  const isLegendKeyActive = useCallback(
    (key: LegendKey | null | undefined) => {
      if (!key) return true;
      return activeLegendKeys.has(key);
    },
    [activeLegendKeys]
  );
  const toggleLegendKey = useCallback((key: LegendKey) => {
    setActiveLegendKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);
  const resetLegendFilters = useCallback(() => {
    setActiveLegendKeys(new Set(LEGEND_KEYS));
  }, []);
  const isNodeVisible = useCallback(
    (node: GraphNode | null | undefined) => {
      if (!node) return false;
      const keys = getNodeLegendKeys(node);
      if (!keys.length) return true;
      return keys.every((key) => isLegendKeyActive(key));
    },
    [isLegendKeyActive]
  );
  const isLinkVisible = useCallback(
    (link: GraphLink | LinkObject) => isLegendKeyActive(getLinkLegendKey(link)),
    [isLegendKeyActive]
  );
  const graphBackgroundColor = useMemo(() => {
    if (!tasks.length) {
      return null;
    }
    const counts: Record<keyof typeof COLUMN_TARGETS, number> = {
      todo: 0,
      inprogress: 0,
      done: 0,
    };
    tasks.forEach((task) => {
      const key = normalizeStatusKey(task.status);
      counts[key] += 1;
    });
    const total = counts.todo + counts.inprogress + counts.done;
    if (!total) {
      return null;
    }
    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;
    (Object.keys(GRAPH_BACKGROUND_TINTS) as Array<keyof typeof GRAPH_BACKGROUND_TINTS>).forEach(
      (key) => {
        const weight = counts[key] / total;
        r += GRAPH_BACKGROUND_TINTS[key].r * weight;
        g += GRAPH_BACKGROUND_TINTS[key].g * weight;
        b += GRAPH_BACKGROUND_TINTS[key].b * weight;
        a += GRAPH_BACKGROUND_TINTS[key].a * weight;
      }
    );
    return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${Number(a.toFixed(3))})`;
  }, [tasks]);
  const graphBackgroundStyle = graphBackgroundColor
    ? { backgroundColor: graphBackgroundColor, transition: GRAPH_BACKGROUND_TRANSITION }
    : undefined;
  const updateNodePositions = useCallback(
    (nextPositions: NodePosition[]) => {
      if (positionsAreEqual(nodePositionsRef.current, nextPositions)) {
        return;
      }
      nodePositionsRef.current = nextPositions;
      setNodePositions(nextPositions);
    },
    []
  );
  const emitStarfieldEvent = useCallback((type: StarfieldEventType) => {
    if (typeof window === "undefined") {
      setStarfieldEvent(type);
      return;
    }
    if (starfieldEventResetRef.current !== null) {
      cancelAnimationFrame(starfieldEventResetRef.current);
      starfieldEventResetRef.current = null;
    }
    setStarfieldEvent(type);
    starfieldEventResetRef.current = window.requestAnimationFrame(() => {
      setStarfieldEvent(null);
      starfieldEventResetRef.current = null;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (typeof window === "undefined") {
        return;
      }
      if (starfieldEventResetRef.current !== null) {
        cancelAnimationFrame(starfieldEventResetRef.current);
        starfieldEventResetRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ type?: StarfieldEventType | null }>).detail;
      if (!detail?.type) return;
      emitStarfieldEvent(detail.type);
    };
    window.addEventListener(STARFIELD_TASK_EVENT, handler as EventListener);
    return () => window.removeEventListener(STARFIELD_TASK_EVENT, handler as EventListener);
  }, [emitStarfieldEvent]);
  const rafRef = useRef<number | undefined>(undefined);
  const scrollZoomOverrideRef = useRef(false);
  const graphViewportRef = useRef<HTMLDivElement | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    if (typeof window === "undefined" || typeof window.matchMedia === "undefined") {
      return false;
    }
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  const debouncedSetHover = useMemo(
    () => debounce((node: GraphNode | null) => setHoverNode(node), 75),
    []
  );
  const clearHover = useCallback(() => {
    debouncedSetHover.cancel();
    setHoverNode(null);
  }, [debouncedSetHover]);
  const hoveredNodeId = hoverNode?.id ?? null;

  const clearAutoLockTimer = useCallback(() => {
    if (autoLockTimer.current) {
      clearTimeout(autoLockTimer.current);
      autoLockTimer.current = null;
    }
  }, []);

  const lockLayout = useCallback(() => {
    clearAutoLockTimer();
    setGraphPrefs((prev) => ({ ...prev, locked: true }));
    fgRef.current?.d3AlphaTarget?.(0);
    fgRef.current?.pauseAnimation?.();
  }, [clearAutoLockTimer]);

  const unlockLayout = useCallback(() => {
    clearAutoLockTimer();
    setGraphPrefs((prev) => ({ ...prev, locked: false, autoLock: false }));
    fgRef.current?.d3AlphaTarget?.(0.3);
    fgRef.current?.resumeAnimation?.();
    fgRef.current?.d3ReheatSimulation?.();
  }, [clearAutoLockTimer]);

  const scheduleAutoLock = useCallback(() => {
    if (!graphPrefs.autoLock || graphPrefs.locked) return;
    clearAutoLockTimer();
    autoLockTimer.current = window.setTimeout(() => {
      lockLayout();
    }, AUTO_LOCK_DELAY);
  }, [graphPrefs.autoLock, graphPrefs.locked, lockLayout, clearAutoLockTimer]);

  const handleInteractionStart = useCallback(() => {
    if (!graphPrefs.autoLock) return;
    clearAutoLockTimer();
  }, [graphPrefs.autoLock, clearAutoLockTimer]);

  const handleInteractionEnd = useCallback(() => {
    scheduleAutoLock();
  }, [scheduleAutoLock]);

  const frameGraphToNodes = useCallback(
    (transition = 400, padding = 50) => {
      const fg = fgRef.current;
      if (!fg || graphData.nodes.length === 0) {
        return;
      }
      fg.zoomToFit?.(transition, padding);
      const measuredZoom = fg.zoom?.();
      const safeZoom = typeof measuredZoom === "number" ? measuredZoom : 1;
      const targetZoom = Math.max(0.6, Math.min(2.2, safeZoom));
      if (typeof fg.cameraPosition === "function") {
        fg.cameraPosition({ z: targetZoom }, undefined, transition);
      }
      setZoomLevel(Number(targetZoom.toFixed(2)));
    },
    [graphData.nodes.length]
  );

  const resetLayout = useCallback(() => {
    clearHover();
    frameGraphToNodes(400);
  }, [clearHover, frameGraphToNodes]);

  const tagClusters = useMemo(() => {
    const counts = new Map<string, number>();
    graphData.nodes.forEach((node) => {
      const primaryTag = node.tags?.[0];
      if (!primaryTag) return;
      counts.set(primaryTag, (counts.get(primaryTag) ?? 0) + 1);
    });
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    const selected = sorted.slice(0, MAX_TAG_CLUSTERS);
    const total = Math.max(selected.length, 1);
    const entries = selected.map(([tag], index) => {
      const angle = (index / total) * Math.PI * 2;
      return {
        tag,
        x: Math.cos(angle) * TAG_CLUSTER_RADIUS,
        y: Math.sin(angle) * TAG_CLUSTER_RADIUS,
      };
    });
    return {
      entries,
      fallback: { tag: "__fallback__", x: 0, y: 0 },
      map: new Map(entries.map((entry) => [entry.tag, entry])),
    };
  }, [graphData.nodes]);

  const taskLookup = useMemo(() => {
    const map = new Map<string, Task>();
    tasks.forEach((task) => map.set(task.id, task));
    return map;
  }, [tasks]);

  const nodeLookup = useMemo(() => {
    const map = new Map<string, GraphNode>();
    graphData.nodes.forEach((node) => map.set(node.id, node));
    return map;
  }, [graphData.nodes]);

  const neighborMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    graphData.links.forEach((link) => {
      const sourceId = resolveNodeId(link.source);
      const targetId = resolveNodeId(link.target);
      if (!map.has(sourceId)) map.set(sourceId, new Set());
      if (!map.has(targetId)) map.set(targetId, new Set());
      map.get(sourceId)?.add(targetId);
      map.get(targetId)?.add(sourceId);
    });
    return map;
  }, [graphData.links]);

  const highlightedNodes = useMemo(() => {
    if (!hoveredNodeId) return new Set<string>();
    const ids = new Set<string>([hoveredNodeId]);
    neighborMap.get(hoveredNodeId)?.forEach((id) => ids.add(id));
    return ids;
  }, [hoveredNodeId, neighborMap]);

  const highlightedLinks = useMemo(() => {
    const ids = new Set<string>();
    if (!hoveredNodeId) return ids;
    graphData.links.forEach((link) => {
      const sourceId = resolveNodeId(link.source);
      const targetId = resolveNodeId(link.target);
      if (sourceId === hoveredNodeId || targetId === hoveredNodeId) {
        ids.add(linkKey(link));
      }
    });
    return ids;
  }, [graphData.links, hoveredNodeId]);

  const hoveredGraphNode =
    hoverNode ?? (hoveredNodeId ? nodeLookup.get(hoveredNodeId) : undefined);
  const hoveredTask = hoveredGraphNode ? taskLookup.get(hoveredGraphNode.id) : undefined;

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      if (!isNodeVisible(node) || typeof node?.id !== "string") return;
      onOpenTask(node.id);
    },
    [isNodeVisible, onOpenTask]
  );

  const handleNodeHover = useCallback(
    (node: GraphNode | null) => {
      if (node && !isNodeVisible(node)) {
        debouncedSetHover(null);
        return;
      }
      debouncedSetHover(node ?? null);
    },
    [debouncedSetHover, isNodeVisible]
  );

  const handleStrongForceChange = useCallback(
    (value: number) => {
      handleInteractionStart();
      setStrongForce(value);
      handleInteractionEnd();
    },
    [handleInteractionEnd, handleInteractionStart]
  );

  const handleChargeForceChange = useCallback(
    (value: number) => {
      handleInteractionStart();
      setChargeForce(value);
      handleInteractionEnd();
    },
    [handleInteractionEnd, handleInteractionStart]
  );

  const handleCanvasMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const { clientX, clientY } = event;
    if (typeof window === "undefined") {
      setCursor({ x: clientX, y: clientY });
      return;
    }
    if (rafRef.current !== undefined) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = window.requestAnimationFrame(() => {
      setCursor({ x: clientX, y: clientY });
    });
  }, []);

  const handleCanvasMouseLeave = useCallback(() => {
    clearHover();
  }, [clearHover]);

  const handleBackgroundClick = useCallback(() => {
    clearHover();
  }, [clearHover]);
  useEffect(() => {
    return () => {
      debouncedSetHover.cancel();
      if (rafRef.current !== undefined) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [debouncedSetHover]);

  const handleNodeDrag = useCallback(() => {
    handleInteractionStart();
  }, [handleInteractionStart]);

  const handleNodeDragEnd = useCallback(() => {
    handleInteractionEnd();
  }, [handleInteractionEnd]);

  // react-force-graph-2d emits pan events through onZoom callbacks; reuse them for hover clearing.
  const handleZoom = useCallback(
    (transform?: { k?: number }) => {
    handleInteractionStart();
      clearHover();
      if (typeof transform?.k === "number") {
        setZoomLevel(Number(transform.k.toFixed(2)));
        return;
      }
      const currentZoom = fgRef.current?.zoom?.();
      if (typeof currentZoom === "number") {
        setZoomLevel(Number(currentZoom.toFixed(2)));
      }
    },
    [handleInteractionStart, clearHover]
  );

  const handleZoomEnd = useCallback(() => {
    handleInteractionEnd();
    clearHover();
  }, [handleInteractionEnd, clearHover]);

  const toggleFreeze = useCallback(() => {
    if (isLocked) {
      unlockLayout();
      logEvent({ type: "graph:unlock" });
    } else {
      lockLayout();
      logEvent({ type: "graph:lock" });
    }
  }, [isLocked, lockLayout, unlockLayout]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.code === "KeyR") {
        if (event.metaKey || event.ctrlKey || isEditableTarget(event.target)) {
          return;
        }
        event.preventDefault();
        resetLayout();
        return;
      }
      if (event.key.toLowerCase() === "f") {
        if (isEditableTarget(event.target)) {
          return;
        }
        event.preventDefault();
        toggleFreeze();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [resetLayout, toggleFreeze]);

  useEffect(() => {
    if (typeof graphPrefs.cohesion === "number") {
      const next = -Math.abs(graphPrefs.cohesion);
      if (strongForce !== next) {
        setStrongForce(next);
      }
    }
  }, [graphPrefs.cohesion, strongForce]);

  useEffect(() => {
    if (typeof graphPrefs.spacing === "number") {
      const next = -Math.abs(graphPrefs.spacing);
      if (chargeForce !== next) {
        setChargeForce(next);
      }
    }
  }, [graphPrefs.spacing, chargeForce]);

  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    const linkForce = fg.d3Force("link") as DistanceForce | undefined;
    linkForce?.distance?.(Math.max(24, Math.abs(strongForce)));
    const charge = fg.d3Force("charge") as StrengthForce | undefined;
    charge?.strength?.(chargeForce);
    fg.d3ReheatSimulation();
  }, [strongForce, chargeForce]);

  useEffect(() => {
    if (!isLocked) return;
    fgRef.current?.pauseAnimation?.();
  }, [isLocked]);

  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;

    if (graphPrefs.clusterMode === "column") {
      const getCenter = (node: GraphNode) => {
        const key = normalizeStatusKey(node.status);
        return COLUMN_TARGETS[key] ?? COLUMN_TARGETS.todo;
      };
      fg.d3Force(
        "clusterX",
        d3ForceX<GraphNode>((node: GraphNode) => getCenter(node).x).strength(CLUSTER_STRENGTH)
      );
      fg.d3Force(
        "clusterY",
        d3ForceY<GraphNode>((node: GraphNode) => getCenter(node).y).strength(CLUSTER_STRENGTH)
      );
      fg.d3ReheatSimulation();
      return;
    }

    if (graphPrefs.clusterMode === "tag") {
      const fallback = tagClusters.fallback;
      fg.d3Force(
        "clusterX",
        d3ForceX<GraphNode>((node: GraphNode) => {
          const primaryTag = node.tags?.[0];
          const center = primaryTag ? tagClusters.map.get(primaryTag) : undefined;
          return (center ?? fallback).x;
        }).strength(CLUSTER_STRENGTH)
      );
      fg.d3Force(
        "clusterY",
        d3ForceY<GraphNode>((node: GraphNode) => {
          const primaryTag = node.tags?.[0];
          const center = primaryTag ? tagClusters.map.get(primaryTag) : undefined;
          return (center ?? fallback).y;
        }).strength(CLUSTER_STRENGTH)
      );
      fg.d3ReheatSimulation();
      return;
    }

    fg.d3Force("clusterX", null);
    fg.d3Force("clusterY", null);
    fg.d3ReheatSimulation();
  }, [graphPrefs.clusterMode, tagClusters]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const persistedLegendKeys = LEGEND_KEYS.filter((key) => activeLegendKeys.has(key));
      const payload: GraphPreferences = {
        ...graphPrefs,
        legendKeys: persistedLegendKeys,
      };
      window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(payload));
    }
  }, [graphPrefs, activeLegendKeys]);

  useEffect(() => {
    if (graphPrefs.autoLock && !graphPrefs.locked) {
      scheduleAutoLock();
      return () => {
        clearAutoLockTimer();
      };
    }
    clearAutoLockTimer();
    return () => {
      clearAutoLockTimer();
    };
  }, [graphPrefs.autoLock, graphPrefs.locked, scheduleAutoLock, clearAutoLockTimer]);

  useEffect(() => {
    const prev = prevForceValues.current;
    if (prev.strong !== strongForce || prev.charge !== chargeForce) {
      if (isLocked) {
        unlockLayout();
      }
    }
    prevForceValues.current = { strong: strongForce, charge: chargeForce };
  }, [strongForce, chargeForce, isLocked, unlockLayout]);

  useEffect(() => {
    setGraphPrefs((prev) => ({
      clusterMode: prefs?.clusterMode ?? prev.clusterMode ?? "column",
      showTemporal:
        typeof prefs?.showTemporal === "boolean"
          ? prefs.showTemporal
          : prev.showTemporal ?? false,
      showLabels:
        typeof prefs?.showLabels === "boolean"
          ? prefs.showLabels
          : prev.showLabels ?? false,
      labelMode:
        typeof prefs?.labelMode === "string" ? prefs.labelMode : prev.labelMode ?? "hover",
      autoLock:
        typeof prefs?.autoLock === "boolean" ? prefs.autoLock : prev.autoLock ?? true,
      locked:
        typeof prefs?.locked === "boolean" ? prefs.locked : prev.locked ?? false,
      preset:
        typeof prefs?.preset === "string" ? prefs.preset : prev.preset ?? DEFAULT_GRAPH_PREFS.preset,
      cohesion:
        typeof prefs?.cohesion === "number"
          ? prefs.cohesion
          : prev.cohesion ?? DEFAULT_COHESION,
      spacing:
        typeof prefs?.spacing === "number"
          ? prefs.spacing
          : prev.spacing ?? DEFAULT_SPACING,
      showStarfield:
        typeof prefs?.showStarfield === "boolean"
          ? prefs.showStarfield
          : prev.showStarfield ?? true,
    }));
  }, [
    prefs?.clusterMode,
    prefs?.showTemporal,
    prefs?.showLabels,
    prefs?.labelMode,
    prefs?.autoLock,
    prefs?.locked,
    prefs?.preset,
    prefs?.cohesion,
    prefs?.spacing,
    prefs?.showStarfield,
  ]);

  const handlePrefsChange = (partial: Partial<GraphPreferences>) => {
    const changeCluster =
      typeof partial.clusterMode !== "undefined" &&
      partial.clusterMode !== graphPrefs.clusterMode;
    const layoutValuesChanged =
      typeof partial.cohesion === "number" || typeof partial.spacing === "number";
    let requiresReheat = changeCluster || layoutValuesChanged;
    if (layoutValuesChanged) {
      if (typeof partial.cohesion === "number") {
        setStrongForce(-Math.abs(partial.cohesion));
      }
      if (typeof partial.spacing === "number") {
        setChargeForce(-Math.abs(partial.spacing));
      }
    }
    if (changeCluster && isLocked) {
      unlockLayout();
    }
    if (changeCluster) {
      clearHover();
    }
    if (requiresReheat) {
      fgRef.current?.d3ReheatSimulation?.();
      handleInteractionStart();
      handleInteractionEnd();
    }

    const analyticsLayoutChange =
      typeof partial.cohesion === "number" ||
      typeof partial.spacing === "number" ||
      typeof partial.preset === "string";

    if (changeCluster) {
      logEvent({ type: "graph:lock" });
    }
    if (analyticsLayoutChange) {
      logEvent({ type: "palette:run" });
    }

    setGraphPrefs((prev) => ({ ...prev, ...partial }));
  };

  useEffect(() => {
    ensureDriftStars();
  }, []);

  useEffect(() => {
    const fg = fgRef.current;
    if (!fg?.zoom) return;
    setZoomLevel(Number(fg.zoom().toFixed(2)));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia === "undefined") {
      return;
    }
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
    } else if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(handleChange);
    }
    return () => {
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", handleChange);
      } else if (typeof mediaQuery.removeListener === "function") {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!graphData.nodes.length) {
      return;
    }
    const timeout = window.setTimeout(() => {
      frameGraphToNodes(400);
    }, 200);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [graphData.nodes.length, frameGraphToNodes]);

  useEffect(() => {
    if (!hoveredGraphNode) {
      setTooltipPosition(null);
      return;
    }
    const fg = fgRef.current;
    if (!fg?.graph2ScreenCoords) return;
    const typed = hoveredGraphNode as GraphNode & { x?: number; y?: number };
    const coords = fg.graph2ScreenCoords(typed.x ?? 0, typed.y ?? 0);
    setTooltipPosition(coords);
  }, [hoveredGraphNode]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    let frame = 0;
    const samplePositions = () => {
      const fg = fgRef.current;
      const viewport = graphViewportRef.current;
      if (fg?.graph2ScreenCoords && viewport) {
        const rect = viewport.getBoundingClientRect();
        const next: NodePosition[] = [];
        graphData.nodes.forEach((node) => {
          const typed = node as GraphNode & { x?: number; y?: number };
          if (
            !isNodeVisible(typed) ||
            typeof typed.x !== "number" ||
            typeof typed.y !== "number"
          ) {
            return;
          }
          const coords = fg.graph2ScreenCoords?.(typed.x, typed.y);
          if (!coords) return;
          next.push({
            x: coords.x - rect.left,
            y: coords.y - rect.top,
          });
        });
        updateNodePositions(next);
      } else {
        updateNodePositions([]);
      }
      frame = window.requestAnimationFrame(samplePositions);
    };
    frame = window.requestAnimationFrame(samplePositions);
    return () => {
      if (frame) {
        cancelAnimationFrame(frame);
      }
    };
  }, [graphData.nodes, isNodeVisible, updateNodePositions]);

  const handleZoomSliderChange = useCallback((value: number) => {
    const next = Math.min(2.4, Math.max(0.5, value));
    setZoomLevel(next);
    fgRef.current?.zoom?.(next, 250);
  }, []);

  const toggleScrollZoom = useCallback(() => {
    scrollZoomOverrideRef.current = true;
    setScrollZoomEnabled((prev) => !prev);
  }, []);

  useEffect(() => {
    if (scrollZoomOverrideRef.current) {
      return;
    }
    const shouldEnableScrollZoom = graphData.nodes.length < 100;
    setScrollZoomEnabled((prev) => (prev === shouldEnableScrollZoom ? prev : shouldEnableScrollZoom));
  }, [graphData.nodes.length]);

  const tooltipCoords = useMemo(() => {
    const baseX = tooltipPosition?.x ?? cursor.x;
    const baseY = tooltipPosition?.y ?? cursor.y;
    if (typeof window === "undefined") {
      return { left: baseX + 12, top: baseY + 12 };
    }
    const maxLeft = window.innerWidth - 280;
    const maxTop = window.innerHeight - 180;
    return {
      left: Math.min(maxLeft, Math.max(16, baseX + 16)),
      top: Math.min(maxTop, Math.max(16, baseY - 16)),
    };
  }, [cursor, tooltipPosition]);

  const handleWheelScroll = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (scrollZoomEnabled || typeof window === "undefined") {
        return;
      }
      event.preventDefault();
      window.scrollBy({
        top: event.deltaY,
        left: event.deltaX,
        behavior: "auto",
      });
    },
    [scrollZoomEnabled]
  );

  const handleStarfieldToggle = useCallback(() => {
    setGraphPrefs((prev) => {
      const next = !(prev.showStarfield ?? true);
      return { ...prev, showStarfield: next };
    });
  }, []);

  return (
    <section className="min-h-screen space-y-8 px-4 py-8">
      <div className="mx-auto w-full max-w-5xl">
        <div className="relative mb-8 h-48 overflow-hidden rounded-3xl border border-white/10 bg-[#050B18] shadow-lg shadow-black/40">
          <Starfield className="z-0" enabled={Boolean(graphPrefs.showStarfield)} zoom={zoomLevel} />
          <div className="relative z-10 flex h-full items-center justify-between px-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Diagnostics
              </p>
              <p className="text-base font-semibold text-white">Live Starfield Preview</p>
              <p className="text-[11px] text-slate-300">
                If you see particles drifting here, the cosmic layer is healthy.
              </p>
            </div>
            <span className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-slate-200">
              {graphPrefs.showStarfield ? "Enabled" : "Disabled"}
            </span>
          </div>
        </div>
      </div>
      <div className="sticky top-6 z-30 w-full">
        <div className="mx-auto max-w-5xl rounded-2xl border border-white/10 bg-[#0B1220]/85 px-6 py-5 shadow-xl shadow-black/40 backdrop-blur supports-[backdrop-filter]:backdrop-blur">
          <div className="[&_div.flex.flex-wrap.items-center.justify-end.gap-3]:hidden">
            <GraphControls
              strongForce={strongForce}
              chargeForce={chargeForce}
              isFrozen={isLocked}
              onStrongForceChange={handleStrongForceChange}
              onChargeForceChange={handleChargeForceChange}
              onReset={resetLayout}
              onToggleFreeze={toggleFreeze}
              prefs={{
                clusterMode: graphPrefs.clusterMode ?? "none",
                showTemporal: Boolean(graphPrefs.showTemporal),
                showLabels: Boolean(graphPrefs.showLabels),
                autoLock: graphPrefs.autoLock ?? true,
                preset: graphPrefs.preset,
                cohesion: graphPrefs.cohesion ?? Math.abs(strongForce),
                spacing: graphPrefs.spacing ?? Math.abs(chargeForce),
              }}
              onChange={handlePrefsChange}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={resetLayout}
              className="rounded-xl border border-white/20 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white transition hover:border-white/40 hover:bg-white/10"
            >
              Reset Layout
            </button>
            <button
              type="button"
              onClick={toggleFreeze}
              className="rounded-xl border border-white/20 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white transition hover:border-white/40 hover:bg-white/10"
            >
              {isLocked ? "Unlock Layout" : "Lock Layout"}
            </button>
            <button
              type="button"
              onClick={handleStarfieldToggle}
              aria-pressed={showStarfield}
              className={[
                "rounded-xl border px-4 py-1.5 text-xs font-semibold uppercase tracking-wide transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70",
                showStarfield
                  ? "border-white/40 bg-white/15 text-white"
                  : "border-white/20 text-slate-200 hover:border-white/40 hover:text-white",
              ].join(" ")}
            >
              Toggle Starfield
            </button>
          </div>
          <p className="mt-3 text-[11px] text-slate-400">
            Tip: drag to pan, zoom with the slider or toggle scroll below,{" "}
            <kbd className="rounded bg-white/10 px-1">F</kbd> lock/unlock,{" "}
            <kbd className="rounded bg-white/10 px-1">R</kbd> reset. Switch “Cluster” to see status
            or tag groupings.
          </p>
        </div>
      </div>

      <div
        className="relative h-screen w-full overflow-hidden"
        style={graphBackgroundStyle}
      >
        <div className="absolute inset-0 z-10 mx-auto flex h-full w-full max-w-7xl flex-col justify-center px-4">
          <div
            ref={graphViewportRef}
            className="relative h-[640px] w-full overflow-hidden rounded-3xl border border-white/10 shadow-2xl shadow-black/40"
            onMouseMove={handleCanvasMouseMove}
            onMouseLeave={handleCanvasMouseLeave}
            onWheelCapture={handleWheelScroll}
          >
            <EnhancedStarfield
              className="absolute inset-0 -z-10 pointer-events-none rounded-3xl"
              enabled={Boolean(graphPrefs.showStarfield)}
              zoom={zoomLevel}
              event={starfieldEvent}
              nodePositions={nodePositions}
              nodePositionsRef={nodePositionsRef}
            />
            <ForceGraph2D<GraphNode, GraphLink>
              ref={fgRef}
              graphData={graphData}
              nodeRelSize={6}
              warmupTicks={60}
              backgroundColor="rgba(0,0,0,0)"
              cooldownTicks={0}
              enableZoomInteraction={scrollZoomEnabled}
              linkDirectionalParticles={1}
              linkDirectionalParticleWidth={(link) => {
                if (!isLinkVisible(link)) return 0;
                return highlightedLinks.has(linkKey(link)) ? 2 : 0;
              }}
              linkDirectionalParticleColor={(link) => {
                if (!isLinkVisible(link)) return "rgba(0,0,0,0)";
                return getParticleColor(
                  link as GraphLink,
                  highlightedLinks.has(linkKey(link))
                );
              }}
              linkDirectionalParticleSpeed={0.003}
              onNodeClick={handleNodeClick}
              onNodeHover={handleNodeHover}
              onNodeDrag={handleNodeDrag}
              onNodeDragEnd={handleNodeDragEnd}
              onZoom={handleZoom}
              onZoomEnd={handleZoomEnd}
              onBackgroundClick={handleBackgroundClick}
              nodeCanvasObject={(node, ctx, globalScale) => {
                const typed = node as GraphNode & { x?: number; y?: number };
                const isHighlighted = highlightedNodes.has(resolveNodeId(typed));
                const isHovered = hoveredNodeId === typed.id;
                const visible = isNodeVisible(typed);
                ctx.save();
                ctx.globalAlpha = visible ? 1 : 0;
                drawNode(typed, ctx, {
                  globalScale,
                  highlighted: isHighlighted,
                  hovered: isHovered,
                });
                ctx.restore();
                if (!visible) {
                  return;
                }
                const shouldShowLabel =
                  Boolean(graphPrefs.showLabels) || hoveredNodeId === typed.id;
                if (!shouldShowLabel) {
                  return;
                }
                const labelSource = taskLookup.get(typed.id)?.title ?? typed.id;
                const shortLabel =
                  labelSource.length > 18 ? `${labelSource.slice(0, 17)}…` : labelSource;
                const opacity = Math.max(0, Math.min(1, 2.4 - globalScale));
                if (opacity <= 0) return;
                ctx.save();
                ctx.globalAlpha = opacity;
                const fontSize = Math.max(6, 14 / globalScale);
                ctx.font = `${fontSize}px 'Inter', sans-serif`;
                ctx.fillStyle = "rgba(230, 237, 243, 0.9)";
                ctx.textBaseline = "middle";
                ctx.fillText(shortLabel, (typed.x ?? 0) + 10, (typed.y ?? 0) - fontSize);
                ctx.restore();
              }}
              linkColor={(link) => {
                if (!isLinkVisible(link)) return "rgba(0,0,0,0)";
                return getLinkColor(link as GraphLink, highlightedLinks.has(linkKey(link)));
              }}
              linkWidth={(link) => {
                if (!isLinkVisible(link)) return 0;
                return getLinkWidth(link as GraphLink, highlightedLinks.has(linkKey(link)));
              }}
            />
            {hoveredGraphNode ? (
              <div
                className="pointer-events-none fixed z-30 max-w-xs rounded-2xl border border-white/10 bg-[#0B1220]/95 p-4 text-sm text-slate-100 shadow-xl shadow-black/40 backdrop-blur"
                style={tooltipCoords}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {hoveredTask?.status ?? hoveredGraphNode.status}
                </p>
                <p className="mt-1 text-base font-semibold text-white">
                  {hoveredTask?.title ?? hoveredGraphNode.id}
                </p>
                <div className="mt-3 flex items-center gap-3 text-xs text-slate-300">
                  <span className="rounded-lg border border-white/10 px-2 py-1">
                    {hoveredGraphNode.deps} deps
                  </span>
                  <span className="rounded-lg border border-white/10 px-2 py-1">
                    {hoveredGraphNode.blocked ? "Blocked" : "Flowing"}
                  </span>
                </div>
                {hoveredGraphNode.tags && hoveredGraphNode.tags.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {hoveredGraphNode.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-lg bg-white/10 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-200"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="pointer-events-none absolute inset-0 z-20 flex items-end justify-between gap-3 px-4 pb-4">
            <div className="pointer-events-auto rounded-2xl border border-white/10 bg-[#0B1220]/85 px-3 py-3 text-[11px] text-slate-200 shadow-lg">
              <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                <span>Zoom</span>
                <span>{Math.round(zoomLevel * 100)}%</span>
              </div>
              <label className="sr-only" htmlFor="graph-zoom-slider">
                Graph zoom
              </label>
              <input
                id="graph-zoom-slider"
                type="range"
                min={0.5}
                max={2.4}
                step={0.05}
                value={zoomLevel}
                onChange={(event) => handleZoomSliderChange(Number(event.target.value))}
                className="mt-2 h-1 w-48 cursor-pointer appearance-none rounded-full bg-white/10 accent-white"
              />
              <button
                type="button"
                onClick={toggleScrollZoom}
                className="mt-2 w-full rounded-lg border border-white/15 px-2 py-1 text-[11px] font-medium text-slate-100 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/60"
              >
                {scrollZoomEnabled ? "Use scroll for page" : "Use scroll to zoom"}
              </button>
            </div>

            <div className="pointer-events-auto rounded-2xl border border-white/10 bg-[#0B1220]/85 px-3 py-3 text-[11px] text-slate-200 shadow-lg">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Legend
                  </div>
                  <p className="text-[10px] text-slate-500" aria-hidden="true">
                    {legendStatusMessage}
                  </p>
                </div>
                {filtersDirty ? (
                  <button
                    type="button"
                    onClick={resetLegendFilters}
                    className="rounded-full border border-white/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white transition hover:border-white/40 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70"
                  >
                    Reset filters
                  </button>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {legendSwatches.map((swatch) => {
                  const legendKey = swatch.label as LegendKey;
                  const isActive = activeLegendKeys.has(legendKey);
                  return (
                    <button
                      key={swatch.label}
                      type="button"
                      role="switch"
                      aria-checked={isActive}
                      onClick={() => toggleLegendKey(legendKey)}
                      className={[
                        "flex items-center gap-2 rounded-xl border px-2 py-1 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70",
                        isActive
                          ? "border-white/40 bg-white/10 text-white"
                          : "border-white/10 text-slate-400 hover:border-white/30 hover:text-white",
                      ].join(" ")}
                    >
                      {swatch.kind === "node" ? (
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{
                            backgroundColor: swatch.color,
                            opacity: isActive ? 1 : 0.3,
                          }}
                        />
                      ) : (
                        <span
                          className="inline-block h-[2px] w-6"
                          style={{
                            background: isActive
                              ? swatch.color
                              : "rgba(148, 163, 184, 0.3)",
                            borderBottom: swatch.dashed
                              ? isActive
                                ? "1px dashed rgba(226,232,240,0.6)"
                                : "1px dashed rgba(148,163,184,0.4)"
                              : "none",
                          }}
                        />
                      )}
                      <span>{swatch.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="sr-only" aria-live="polite">
                {legendStatusMessage}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default GraphView;
