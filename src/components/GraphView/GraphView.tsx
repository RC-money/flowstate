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
import { logEvent } from "../../lib/analytics";

type ClusterMode = "none" | "column" | "tag";
type GraphPreset = "planning" | "focus";

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
  autoLock?: boolean;
  locked?: boolean;
  preset?: GraphPreset;
  cohesion?: number;
  spacing?: number;
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
const DEFAULT_GRAPH_PREFS: GraphPreferences = {
  clusterMode: "column",
  showTemporal: false,
  showLabels: false,
  labelMode: "hover",
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
      return {
        ...DEFAULT_GRAPH_PREFS,
        ...(parsed && typeof parsed === "object" ? parsed : {}),
      };
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
};

type DistanceForce = { distance?: (value: number) => void };
type StrengthForce = { strength?: (value: number) => void };

const GraphView: React.FC<GraphViewProps> = ({ tasks, onOpenTask, prefs }) => {
  const fgRef = useRef<ForceGraphInstance | undefined>(undefined);
  const [hoverNode, setHoverNode] = useState<GraphNode | null>(null);
  const [strongForce, setStrongForce] = useState<number>(DEFAULT_STRONG);
  const [chargeForce, setChargeForce] = useState<number>(DEFAULT_CHARGE);
  const [graphPrefs, setGraphPrefs] = useState<GraphPreferences>(() => loadStoredPrefs());
  const isLocked = Boolean(graphPrefs.locked);

  const graphData: GraphData = useMemo(
    () => buildGraphData(tasks, graphPrefs),
    [tasks, graphPrefs]
  );
  const autoLockTimer = useRef<number | null>(null);
  const prevForceValues = useRef({ strong: strongForce, charge: chargeForce });
  const [cursor, setCursor] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [scrollZoomEnabled, setScrollZoomEnabled] = useState<boolean>(false);
  const rafRef = useRef<number | undefined>(undefined);
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

  const resetLayout = useCallback(() => {
    clearHover();
    fgRef.current?.zoomToFit?.(400);
    fgRef.current?.centerAt?.(0, 0, 400);
  }, [clearHover]);

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
      if (typeof node?.id !== "string") return;
      onOpenTask(node.id);
    },
    [onOpenTask]
  );

  const handleNodeHover = useCallback(
    (node: GraphNode | null) => {
      debouncedSetHover(node ?? null);
    },
    [debouncedSetHover]
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
    const handleKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        resetLayout();
      }
      if (event.key.toLowerCase() === "f") {
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
      window.localStorage.setItem(
        PREFS_STORAGE_KEY,
        JSON.stringify(graphPrefs)
      );
    }
  }, [graphPrefs]);

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
    const fg = fgRef.current;
    if (!fg?.zoom) return;
    setZoomLevel(Number(fg.zoom().toFixed(2)));
  }, []);

  useEffect(() => {
    if (!hoveredGraphNode) {
      setTooltipPosition(null);
      return;
    }
    const fg = fgRef.current;
    if (!fg?.graph2ScreenCoords) return;
    const coords = fg.graph2ScreenCoords(hoveredGraphNode.x ?? 0, hoveredGraphNode.y ?? 0);
    setTooltipPosition(coords);
  }, [hoveredGraphNode]);

  const handleZoomSliderChange = useCallback((value: number) => {
    const next = Math.min(2.4, Math.max(0.5, value));
    setZoomLevel(next);
    fgRef.current?.zoom?.(next, 250);
  }, []);

  const toggleScrollZoom = useCallback(() => {
    setScrollZoomEnabled((prev) => !prev);
  }, []);

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
    <section className="flex min-h-screen flex-col gap-6 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
      <div className="relative space-y-6 pb-4">
        <div className="sticky top-16 z-30 w-full px-4">
          <div className="mx-auto max-w-screen-xl">
            <div className="rounded-2xl border border-white/10 bg-[#0B1220]/85 px-6 py-5 shadow-xl shadow-black/40 backdrop-blur supports-[backdrop-filter]:backdrop-blur">
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
              <p className="mt-3 text-[11px] text-slate-400">
                Tip: drag to pan, zoom with the slider or toggle scroll below,{" "}
                <kbd className="rounded bg-white/10 px-1">F</kbd> lock/unlock,{" "}
                <kbd className="rounded bg-white/10 px-1">R</kbd> reset. Switch “Cluster” to see
                status or tag groupings.
              </p>
            </div>
          </div>
        </div>
        <div className="relative mx-auto max-w-screen-xl px-4">
          <div
            className="relative h-[640px] w-full overflow-hidden rounded-2xl bg-[#050B18]"
            onMouseMove={handleCanvasMouseMove}
            onMouseLeave={handleCanvasMouseLeave}
            onWheelCapture={handleWheelScroll}
          >
            <div className="pointer-events-none absolute inset-0 z-20 flex flex-wrap items-end justify-between gap-3 px-4 pb-4">
              <div className="pointer-events-auto rounded-2xl border border-white/10 bg-[#0B1220]/85 px-3 py-2 text-[11px] text-slate-200 shadow-lg">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Legend
                </div>
                <div className="flex flex-wrap gap-2">
                  {legendSwatches.map((swatch) => (
                    <div
                      key={swatch.label}
                      className="flex items-center gap-2 rounded-xl bg-white/5 px-2 py-1"
                    >
                      {swatch.kind === "node" ? (
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: swatch.color }}
                        />
                      ) : (
                        <span
                          className="inline-block h-[2px] w-6"
                          style={{
                            background: swatch.color,
                            borderBottom: swatch.dashed
                              ? "1px dashed rgba(226,232,240,0.6)"
                              : "none",
                          }}
                        />
                      )}
                      <span className="text-slate-100">{swatch.label}</span>
                    </div>
                  ))}
                </div>
              </div>
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
            </div>
            <ForceGraph2D<GraphNode, GraphLink>
              ref={fgRef}
              graphData={graphData}
              nodeRelSize={6}
              warmupTicks={60}
              backgroundColor="#050B18"
              cooldownTicks={0}
              enableZoomInteraction={scrollZoomEnabled}
              linkDirectionalParticles={1}
              linkDirectionalParticleWidth={(link) =>
                highlightedLinks.has(linkKey(link)) ? 2 : 0
              }
              linkDirectionalParticleColor={(link) =>
                getParticleColor(link, highlightedLinks.has(linkKey(link)))
              }
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
                drawNode(typed, ctx, {
                  globalScale,
                  highlighted: highlightedNodes.has(resolveNodeId(typed)),
                  hovered: hoveredNodeId === typed.id,
                });
                const shouldShowLabel = Boolean(graphPrefs.showLabels) || hoveredNodeId === typed.id;
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
              linkColor={(link) =>
                getLinkColor(link as GraphLink, highlightedLinks.has(linkKey(link)))
              }
              linkWidth={(link) =>
                getLinkWidth(link as GraphLink, highlightedLinks.has(linkKey(link)))
              }
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
    </section>
  );
};

export default GraphView;
