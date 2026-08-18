import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ForceGraph2D, { type LinkObject } from "react-force-graph-2d";
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
import Starfield from "./Starfield";
import { logEvent } from "../../lib/analytics";
import { useGraphPhysics, type ForceGraphInstance } from "./graphPhysics";
import type { Constellation, Tether } from "../../types/celestial";
import { analyzeConstellations } from "../../engine/constellations/analyzer";
import { deriveStars } from "../../lib/earnedStars";
import { replayLog, logTimeRange } from "../../lib/replayLog";
import { readLog } from "../../lib/taskLog";

type BaseStarfieldProps = React.ComponentProps<typeof Starfield>;
type EnhancedStarfieldProps = BaseStarfieldProps & {
  event?: StarfieldEventType | null;
  nodePositions?: NodePosition[];
  earnedStars?: ReturnType<typeof deriveStars>;
};
const EnhancedStarfield = Starfield as React.ComponentType<EnhancedStarfieldProps>;

type ClusterMode = "none" | "column" | "tag";
type GraphPreset = "planning" | "focus";
type LegendKey = (typeof legendSwatches)[number]["label"];
const LEGEND_KEYS = legendSwatches.map((swatch) => swatch.label) as LegendKey[];
const LEGEND_KEY_SET = new Set<LegendKey>(LEGEND_KEYS);
type Debounced<T extends (...args: never[]) => void> = ((...args: Parameters<T>) => void) & {
  cancel: () => void;
};

const debounce = <T extends (...args: never[]) => void>(fn: T, delay = 75): Debounced<T> => {
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
  onCreateTether?: (sourceId: string, targetId: string) => void;
  onConstellationsChange?: (constellations: Constellation[]) => void;
  tethers?: Tether[];
  constellations?: Constellation[];
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

const linkLegendMap: Partial<Record<GraphLink["kind"], LegendKey>> = {
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
        const rest = { ...candidate };
        delete rest.legendKeys;
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

type DistanceForce = { distance?: (value: number) => void };
type StrengthForce = { strength?: (value: number) => void };

const GraphView: React.FC<GraphViewProps> = ({
  tasks,
  onOpenTask,
  onCreateTether,
  onConstellationsChange,
  tethers = [],
  constellations = [],
  prefs,
}) => {
  const fgRef = useRef<ForceGraphInstance | undefined>(undefined);
  const [hoverNode, setHoverNode] = useState<GraphNode | null>(null);
  const [strongForce, setStrongForce] = useState<number>(DEFAULT_STRONG);
  const [chargeForce, setChargeForce] = useState<number>(DEFAULT_CHARGE);
  const [graphPrefs, setGraphPrefs] = useState<GraphPreferences>(() => loadStoredPrefs());
  const [activeLegendKeys, setActiveLegendKeys] = useState<Set<LegendKey>>(
    () => new Set<LegendKey>(graphPrefs.legendKeys && graphPrefs.legendKeys.length ? graphPrefs.legendKeys : LEGEND_KEYS)
  );
  const isLocked = Boolean(graphPrefs.locked);

  // Rewind replays the persisted task event log -- real board history, not
  // the old in-memory ghost frames that reset on every reload.
  const [rewindAt, setRewindAt] = useState<number | null>(null);
  const isRewinding = rewindAt !== null;
  const taskLog = useMemo(() => readLog(), []);
  const rewindRange = useMemo(() => logTimeRange(taskLog), [taskLog]);

  const handleRewindChange = useCallback(
    (value: number) => {
      if (!rewindRange) return;
      // The right edge of the slider is "now".
      setRewindAt(value >= rewindRange.end ? null : value);
    },
    [rewindRange]
  );

  const exitRewind = useCallback(() => setRewindAt(null), []);

  const displayTasks = useMemo(
    () => (rewindAt !== null ? replayLog(taskLog, tasks, rewindAt) : tasks),
    [rewindAt, taskLog, tasks]
  );

  const earnedStars = useMemo(() => deriveStars(displayTasks), [displayTasks]);
  const graphData: GraphData = useMemo(
    () => buildGraphData(displayTasks, graphPrefs),
    [displayTasks, graphPrefs]
  );
  const [nodePositions, setNodePositions] = useState<NodePosition[]>([]);
  const [nodeScreenPositions, setNodeScreenPositions] = useState<Record<string, { x: number; y: number }>>({});
  const autoLockTimer = useRef<number | null>(null);
  const prevForceValues = useRef({ strong: strongForce, charge: chargeForce });
  const [cursor, setCursor] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [scrollZoomEnabled, setScrollZoomEnabled] = useState<boolean>(
    () => graphData.nodes.length < 100
  );
  const [tetherDraft, setTetherDraft] = useState<{
    sourceId: string;
    sourceScreen: { x: number; y: number };
    cursor: { x: number; y: number };
  } | null>(null);
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

  useGraphPhysics({
    fgRef,
    graphData,
    taskLookup,
    locked: isLocked,
    prefersReducedMotion,
  });

  const lastAnalysisRef = useRef<{ at: number; signature: string }>({ at: 0, signature: "" });
  useEffect(() => {
    if (!onConstellationsChange) return;
    // nodeScreenPositions updates every animation frame; unthrottled, this
    // re-analyzed and re-persisted constellations 60 times a second.
    const now = Date.now();
    if (now - lastAnalysisRef.current.at < 2000) return;
    // Tag links act as soft tethers: clusters emerge from shared labels
    // without the user ever drawing a line.
    const tagTethers = graphData.links
      .filter((link) => link.kind === "tag")
      .map((link, index) => ({
        id: `tag-link-${index}`,
        sourceId: typeof link.source === "string" ? link.source : String(link.source),
        targetId: typeof link.target === "string" ? link.target : String(link.target),
        createdAt: 0,
        strength: 0.5,
      }));
    const next = analyzeConstellations(tasks, [...(tethers ?? []), ...tagTethers], nodeScreenPositions);
    const signature = next
      .map((c) => c.memberIds.slice().sort().join("."))
      .sort()
      .join("|");
    if (signature === lastAnalysisRef.current.signature) return;
    lastAnalysisRef.current = { at: now, signature };
    onConstellationsChange(next);
  }, [tasks, tethers, graphData.links, nodeScreenPositions, onConstellationsChange]);

  const tetherLines = useMemo(() => {
    if (!tethers.length) return [];
    return tethers
      .map((tether) => {
        const source = nodeScreenPositions[tether.sourceId];
        const target = nodeScreenPositions[tether.targetId];
        if (!source || !target) return null;
        return {
          id: tether.id,
          source,
          target,
          strength: tether.strength,
        };
      })
      .filter(Boolean) as Array<{
        id: string;
        source: { x: number; y: number };
        target: { x: number; y: number };
        strength: number;
      }>;
  }, [tethers, nodeScreenPositions]);

  const constellationOverlays = useMemo(() => {
    if (!constellations.length) return [];
    return constellations
      .map((constellation) => {
        const members = constellation.memberIds
          .map((id) => nodeScreenPositions[id])
          .filter(Boolean) as Array<{ x: number; y: number }>;
        if (!members.length) return null;
      const radius =
        members.reduce((sum, coord) => sum + Math.hypot(coord.x - constellation.centroid.x, coord.y - constellation.centroid.y), 0) /
          members.length +
        40;
        return {
          ...constellation,
          radius,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  }, [constellations, nodeScreenPositions]);

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

  const projectToViewport = useCallback(
    (graphNode: GraphNode): { x: number; y: number } | null => {
      const fg = fgRef.current;
      const viewport = graphViewportRef.current;
      if (!fg?.graph2ScreenCoords || !viewport) return null;
      const typed = graphNode as GraphNode & { x?: number; y?: number };
      const coords = fg.graph2ScreenCoords(typed.x ?? 0, typed.y ?? 0);
      const rect = viewport.getBoundingClientRect();
      return {
        x: coords.x - rect.left,
        y: coords.y - rect.top,
      };
    },
    []
  );

  const handleNodeClick = useCallback(
    (node: GraphNode, event?: MouseEvent) => {
      if (isRewinding) return;
      if (!node || typeof node.id !== "string") return;
      if (event?.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        if (tetherDraft && tetherDraft.sourceId !== node.id) {
          onCreateTether?.(tetherDraft.sourceId, node.id);
          setTetherDraft(null);
          return;
        }
        const sourceScreen = projectToViewport(node);
        if (sourceScreen) {
          setTetherDraft({ sourceId: node.id, sourceScreen, cursor: sourceScreen });
        }
        return;
      }
      if (!isNodeVisible(node)) return;
      onOpenTask(node.id);
    },
    [isNodeVisible, onOpenTask, onCreateTether, projectToViewport, tetherDraft]
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
      if (graphViewportRef.current) {
        const rect = graphViewportRef.current.getBoundingClientRect();
        setTetherDraft((prev) =>
          prev
            ? {
                ...prev,
                cursor: {
                  x: clientX - rect.left,
                  y: clientY - rect.top,
                },
              }
            : prev
        );
      }
    });
  }, []);

  const handleCanvasMouseLeave = useCallback(() => {
    clearHover();
    setTetherDraft(null);
  }, [clearHover]);

  const handleBackgroundClick = useCallback(() => {
    clearHover();
    setTetherDraft(null);
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
      if (event.key === "Escape" && tetherDraft) {
        setTetherDraft(null);
        return;
      }
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
  }, [resetLayout, toggleFreeze, tetherDraft]);

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
        const screenMap: Record<string, { x: number; y: number }> = {};
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
          const screenX = coords.x - rect.left;
          const screenY = coords.y - rect.top;
          next.push({
            x: screenX,
            y: screenY,
          });
          screenMap[typed.id] = { x: screenX, y: screenY };
        });
        updateNodePositions(next);
        setNodeScreenPositions(screenMap);
      } else {
        updateNodePositions([]);
        setNodeScreenPositions({});
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

  return (
    <section className="min-h-screen space-y-8 px-4 py-8">
      {rewindRange && rewindRange.end > rewindRange.start ? (
        <div className="mx-auto mt-4 w-full max-w-5xl rounded-2xl border border-white/10 bg-[#0B1220]/70 px-5 py-4 text-sm text-white shadow-lg shadow-black/30 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-white/60">
                Rewind
              </p>
              <p className="text-base font-semibold">
                {isRewinding && rewindAt !== null
                  ? new Date(rewindAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : "Scrub through the galaxy's memory"}
              </p>
            </div>
            {isRewinding ? (
              <button
                type="button"
                onClick={exitRewind}
                className="rounded-full border border-white/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:border-white/60"
              >
                Return to now
              </button>
            ) : null}
          </div>
          <input
            type="range"
            min={rewindRange.start}
            max={rewindRange.end}
            step={Math.max(1000, Math.floor((rewindRange.end - rewindRange.start) / 200))}
            value={rewindAt ?? rewindRange.end}
            onChange={(event) => handleRewindChange(Number(event.target.value))}
            aria-label="Rewind through board history"
            className="mt-4 w-full"
          />
          <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wide text-white/40">
            <span>{new Date(rewindRange.start).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
            <span>Now</span>
          </div>
        </div>
      ) : null}

      <div className="mx-auto w-full max-w-5xl">
        <div
          className="relative w-full overflow-hidden border border-white/10 bg-black shadow-[0_24px_60px_rgba(0,0,0,0.65)]"
          style={{
            borderRadius: "999px",
            clipPath: "ellipse(96% 58% at 50% 50%)",
          }}
        >
          <div className="pointer-events-none absolute inset-0">
            <EnhancedStarfield
              className="h-full w-full"
              enabled={Boolean(graphPrefs.showStarfield)}
              zoom={zoomLevel}
              event={starfieldEvent}
              nodePositions={nodePositions}
              nodePositionsRef={nodePositionsRef}
              earnedStars={earnedStars}
            />
          </div>
          <div
            ref={graphViewportRef}
            className="relative z-10 aspect-[18/9] w-full min-h-[360px] overflow-hidden md:min-h-[520px]"
            onMouseMove={handleCanvasMouseMove}
            onMouseLeave={handleCanvasMouseLeave}
            onWheelCapture={handleWheelScroll}
            style={graphBackgroundStyle}
          >
            {tetherDraft ? (
              <svg className="pointer-events-none absolute inset-0 z-20" role="presentation">
                <defs>
                  <linearGradient id="tether-line" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f97316" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#e0f2fe" stopOpacity="0.8" />
                  </linearGradient>
                </defs>
                <line
                  x1={tetherDraft.sourceScreen.x}
                  y1={tetherDraft.sourceScreen.y}
                  x2={tetherDraft.cursor.x}
                  y2={tetherDraft.cursor.y}
                  stroke="url(#tether-line)"
                  strokeWidth={3}
                  strokeLinecap="round"
                />
                <circle
                  cx={tetherDraft.cursor.x}
                  cy={tetherDraft.cursor.y}
                  r={6}
                  fill="rgba(255,255,255,0.3)"
                />
              </svg>
            ) : null}
            {constellationOverlays.map((overlay) =>
              overlay ? (
                <div key={overlay.id} className="pointer-events-none absolute inset-0 z-10">
                  <svg className="absolute inset-0">
                    <circle
                      cx={overlay.centroid.x}
                      cy={overlay.centroid.y}
                      r={overlay.radius}
                      fill={overlay.kind === "nursery" ? "rgba(59,130,246,0.08)" : "rgba(236,72,153,0.08)"}
                      stroke={overlay.kind === "nursery" ? "rgba(59,130,246,0.4)" : "rgba(236,72,153,0.4)"}
                      strokeWidth={2}
                    />
                  </svg>
                  <div
                    className="absolute rounded-full border border-white/20 bg-black/60 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white"
                    style={{
                      left: overlay.centroid.x - 40,
                      top: overlay.centroid.y - overlay.radius - 20,
                    }}
                  >
                    {overlay.name ?? overlay.suggestedName}
                  </div>
                </div>
              ) : null
            )}
            {tetherLines.length ? (
              <svg className="pointer-events-none absolute inset-0 z-10">
                {tetherLines.map((line) => (
                  <line
                    key={line.id}
                    x1={line.source.x}
                    y1={line.source.y}
                    x2={line.target.x}
                    y2={line.target.y}
                    stroke="rgba(251,146,60,0.4)"
                    strokeWidth={2 + line.strength * 0.5}
                    strokeLinecap="round"
                  />
                ))}
              </svg>
            ) : null}
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
              onNodeClick={(node, event) => handleNodeClick(node as GraphNode, event as MouseEvent)}
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
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl rounded-2xl border border-white/10 bg-[#0B1220]/85 px-5 py-4 shadow-xl shadow-black/40 backdrop-blur supports-[backdrop-filter]:backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
          <div className="flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-[11px] text-slate-200 shadow-inner shadow-black/30">
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
              className="mt-2 h-1 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-white"
            />
            <button
              type="button"
              onClick={toggleScrollZoom}
              className="mt-3 w-full rounded-lg border border-white/15 px-3 py-2 text-[11px] font-medium text-slate-100 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/60"
            >
              {scrollZoomEnabled ? "Use scroll for page" : "Use scroll to zoom"}
            </button>
          </div>

          <div className="flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-[11px] text-slate-200 shadow-inner shadow-black/30">
            <div className="mb-3 flex items-center justify-between gap-3">
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
                  className="rounded-full border border-white/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white transition hover:border-white/40 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70"
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
    </section>
  );
};

export default GraphView;
