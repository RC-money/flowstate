import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ForceGraph2D, {
  type LinkObject,
  type NodeObject,
} from "react-force-graph-2d";
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
} from "./graphStyles";
import GraphControls from "./GraphControls";

type ClusterMode = "none" | "column" | "tag";

export interface GraphPreferences {
  clusterMode?: ClusterMode;
  showTemporal?: boolean;
}

interface GraphViewProps {
  tasks: Task[];
  onOpenTask(id: string): void;
  prefs?: GraphPreferences;
}

const DEFAULT_STRONG = -60;
const DEFAULT_CHARGE = -90;

type ForceGraphRef = {
  d3Force: (
    forceName: string
  ) =>
    | {
        distance?: (value: number) => void;
        strength?: (value: number) => void;
      }
    | undefined;
  d3ReheatSimulation(): void;
  zoomToFit?(duration?: number, padding?: number): void;
  pauseAnimation(): void;
  resumeAnimation(): void;
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

const GraphView: React.FC<GraphViewProps> = ({ tasks, onOpenTask, prefs }) => {
  const graphRef = useRef<ForceGraphRef | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [strongForce, setStrongForce] = useState<number>(DEFAULT_STRONG);
  const [chargeForce, setChargeForce] = useState<number>(DEFAULT_CHARGE);
  const [isFrozen, setIsFrozen] = useState<boolean>(false);
  const [graphPrefs, setGraphPrefs] = useState<GraphPreferences>(() => ({
    clusterMode: prefs?.clusterMode ?? "none",
    showTemporal: prefs?.showTemporal ?? false,
  }));

  const graphData: GraphData = useMemo(
    () => buildGraphData(tasks, graphPrefs),
    [tasks, graphPrefs]
  );

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

  const handleNodeClick = useCallback(
    (node: NodeObject) => {
      if (typeof node?.id !== "string") return;
      onOpenTask(node.id);
    },
    [onOpenTask]
  );

  const handleNodeHover = useCallback((node: NodeObject | null) => {
    setHoveredNodeId(typeof node?.id === "string" ? node.id : null);
  }, []);

  const resetLayout = useCallback(() => {
    const fg = graphRef.current;
    if (!fg) return;
    fg.d3ReheatSimulation();
    fg.zoomToFit?.(400);
  }, []);

  const toggleFreeze = useCallback(() => {
    const fg = graphRef.current;
    if (!fg) return;
    setIsFrozen((prev) => {
      const next = !prev;
      if (next) {
        fg.pauseAnimation();
      } else {
        fg.resumeAnimation();
      }
      return next;
    });
  }, []);

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
    const fg = graphRef.current;
    if (!fg) return;
    const linkForce = fg.d3Force("link");
    if (linkForce && typeof (linkForce as { distance?: (v: number) => void }).distance === "function") {
      (linkForce as { distance: (v: number) => void }).distance(
        Math.max(24, Math.abs(strongForce))
      );
    }
    const charge = fg.d3Force("charge");
    if (charge && typeof (charge as { strength?: (v: number) => void }).strength === "function") {
      (charge as { strength: (v: number) => void }).strength(chargeForce);
    }
    fg.d3ReheatSimulation();
  }, [strongForce, chargeForce]);

  useEffect(() => {
    if (!isFrozen) return;
    graphRef.current?.pauseAnimation();
  }, [isFrozen]);

  useEffect(() => {
    setGraphPrefs((prev) => ({
      clusterMode: prefs?.clusterMode ?? prev.clusterMode ?? "none",
      showTemporal:
        typeof prefs?.showTemporal === "boolean"
          ? prefs.showTemporal
          : prev.showTemporal ?? false,
    }));
  }, [prefs?.clusterMode, prefs?.showTemporal]);

  const handlePrefsChange = (partial: Partial<GraphPreferences>) => {
    setGraphPrefs((prev) => ({ ...prev, ...partial }));
  };

  const assignGraphRef = useCallback((instance: ForceGraphRef | null) => {
    graphRef.current = instance;
  }, []);

  return (
    <section className="flex h-full flex-col gap-6 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
      <GraphControls
        strongForce={strongForce}
        chargeForce={chargeForce}
        isFrozen={isFrozen}
        onStrongForceChange={setStrongForce}
        onChargeForceChange={setChargeForce}
        onReset={resetLayout}
        onToggleFreeze={toggleFreeze}
        prefs={{
          clusterMode: graphPrefs.clusterMode ?? "none",
          showTemporal: Boolean(graphPrefs.showTemporal),
        }}
        onChange={handlePrefsChange}
      />

      <div className="relative h-[600px] w-full rounded-2xl bg-[#050B18]">
        <ForceGraph2D
          ref={assignGraphRef}
          graphData={graphData}
          nodeRelSize={6}
          warmupTicks={60}
          backgroundColor="#050B18"
          cooldownTicks={0}
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
          nodeCanvasObject={(node, ctx, globalScale) =>
            drawNode(node as GraphNode, ctx, {
              globalScale,
              highlighted: highlightedNodes.has(resolveNodeId(node as GraphNode)),
              hovered: hoveredNodeId === node.id,
            })
          }
          linkColor={(link) =>
            getLinkColor(link as GraphLink, highlightedLinks.has(linkKey(link)))
          }
          linkWidth={(link) =>
            getLinkWidth(link as GraphLink, highlightedLinks.has(linkKey(link)))
          }
        />
      </div>
    </section>
  );
};

export default GraphView;
