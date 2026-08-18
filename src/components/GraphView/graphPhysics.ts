import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import type { Task } from "../../App";
import type { GraphData, GraphLink, GraphNode } from "./graphTransforms";
import type { ForceGraphMethods } from "react-force-graph-2d";

export type ForceGraphInstance = ForceGraphMethods<GraphNode, GraphLink> & {
  d3AlphaTarget?: (alpha: number) => ForceGraphInstance;
  d3ReheatSimulation?: () => void;
  d3Force?: (
    name: string,
    force?:
      | (D3Force<GraphNode> | null)
      | undefined
  ) => ForceGraphInstance;
  pauseAnimation?: () => void;
  resumeAnimation?: () => void;
  graph2ScreenCoords?: (x: number, y: number) => { x: number; y: number };
  zoom?: (scale?: number, ms?: number) => number;
  cameraPosition?: (
    position?: { x?: number; y?: number; z?: number },
    lookAt?: { x: number; y: number; z: number },
    transitionMs?: number
  ) => ForceGraphInstance | { x: number; y: number; z: number };
  refresh?: () => ForceGraphInstance;
};

export type OrbitalBodyType = "sun" | "moon" | "comet" | "asteroid";
export type OrbitPattern = "stable" | "restless" | "chaotic";

type PhysicsNode = GraphNode & {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
};

type Vector2 = { x: number; y: number };

type NodePhysicsMeta = {
  entropy: number;
  objectType: OrbitalBodyType;
  driftVector: Vector2;
  clusterAffinities: Array<{ id: string; weight: number }>;
};

type PhysicsDecoratedNode = PhysicsNode & {
  physicsMeta?: NodePhysicsMeta;
  wobbleScore?: number;
  orbitPattern?: OrbitPattern;
};

interface NodeState {
  objectType: OrbitalBodyType;
  entropy: number;
  smoothedVelocity: Vector2;
  driftVector: Vector2;
  driftSeed: number;
  tick: number;
  wobbleScore: number;
  orbitPattern: OrbitPattern;
  positions: Array<{ x: number; y: number }>;
  clusterAffinities: Map<string, number>;
}

type D3Force<TNode> = ((alpha: number) => void) & {
  initialize?: (nodes: TNode[]) => void;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const clamp01 = (value: number): number => clamp(value, 0, 1);

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;


const pseudoRandom = (seed: number): number => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

const hashStringToFloat = (value: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
};

const normalizeStatus = (status?: string): string => {
  if (!status) return "todo";
  const normalized = status.replace(/[\s-]/g, "").toLowerCase();
  if (normalized === "inprogress") return "inprogress";
  if (normalized === "done") return "done";
  return "todo";
};

const STATUS_ENTROPY: Record<string, number> = {
  todo: 0.18,
  inprogress: 0.38,
  done: 0.12,
};

const DRAG_BY_TYPE: Record<OrbitalBodyType, number> = {
  sun: 0.015,
  moon: 0.045,
  comet: 0.008,
  asteroid: 0.065,
};

const HIGH_ENTROPY = 0.6;
const LOW_ENTROPY = 0.32;
const WOBBLE_HISTORY = 32;
const WOBBLE_PROX_THRESHOLD = 18;
const CLUSTER_RADIUS = 180;
const CLUSTER_MIN_NEIGHBORS = 3;
const CLUSTER_SAMPLE_INTERVAL = 6;
const MAX_CLUSTER_RESULTS = 8;

const nowMs = (): number =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

const hasPosition = (node: PhysicsNode): boolean =>
  typeof node.x === "number" && typeof node.y === "number";

const computeEntropy = (node: PhysicsNode, task?: Task): number => {
  const tagFactor = clamp((node.tags?.length ?? 0) * 0.05, 0, 0.3);
  const depFactor = clamp(node.deps * 0.12, 0, 0.42);
  const blockedFactor = node.blocked ? 0.3 : 0;
  const statusKey = normalizeStatus(task?.status ?? node.status);
  const statusFactor = STATUS_ENTROPY[statusKey] ?? 0.18;
  return clamp01(tagFactor + depFactor + blockedFactor + statusFactor);
};

const classifyOrbitalRole = (
  node: PhysicsNode,
  entropy: number,
  task?: Task
): OrbitalBodyType => {
  if (node.blocked || node.deps >= 4) return "sun";
  const status = (task?.status ?? node.status ?? "").toUpperCase();
  if (status === "DONE") return "moon";
  if (entropy > HIGH_ENTROPY) return "comet";
  if (entropy < LOW_ENTROPY) return "asteroid";
  return status === "IN PROGRESS" ? "comet" : "moon";
};

const computeProximityModifier = (
  node: PhysicsNode,
  majorMasses: PhysicsNode[]
): number => {
  if (!hasPosition(node) || majorMasses.length === 0) return 1;
  const x = node.x ?? 0;
  const y = node.y ?? 0;
  let nearest = Infinity;
  for (const mass of majorMasses) {
    if (!hasPosition(mass)) continue;
    const dx = (mass.x ?? 0) - x;
    const dy = (mass.y ?? 0) - y;
    const dist = Math.hypot(dx, dy);
    if (dist < nearest) {
      nearest = dist;
    }
  }
  if (!Number.isFinite(nearest)) return 1;
  if (nearest < 140) {
    const t = clamp(nearest / 140, 0, 1);
    return lerp(0.72, 0.98, t);
  }
  if (nearest > 300) {
    const t = clamp((nearest - 300) / 260, 0, 1);
    return lerp(1, 1.22, t);
  }
  return 1;
};

type InertiaContext = {
  delta: number;
  reducedMotion: boolean;
  majorMasses: PhysicsNode[];
};

const updateInertia = (
  node: PhysicsNode,
  state: NodeState,
  context: InertiaContext
): void => {
  const { delta, reducedMotion, majorMasses } = context;
  if (!Number.isFinite(delta)) return;
  const smoothing = 1 - Math.exp(-delta * 60);
  const sourceVx = node.vx ?? 0;
  const sourceVy = node.vy ?? 0;
  state.smoothedVelocity.x += (sourceVx - state.smoothedVelocity.x) * smoothing;
  state.smoothedVelocity.y += (sourceVy - state.smoothedVelocity.y) * smoothing;

  const drag = DRAG_BY_TYPE[state.objectType] ?? DRAG_BY_TYPE.asteroid;
  const dragScale = reducedMotion ? drag * 1.4 : drag;
  state.smoothedVelocity.x *= 1 - dragScale;
  state.smoothedVelocity.y *= 1 - dragScale;

  const proximity = reducedMotion ? 1 : computeProximityModifier(node, majorMasses);
  state.smoothedVelocity.x *= proximity;
  state.smoothedVelocity.y *= proximity;

  node.vx = state.smoothedVelocity.x;
  node.vy = state.smoothedVelocity.y;
};

type DriftContext = {
  delta: number;
  reducedMotion: boolean;
};

const applyDrift = (
  node: PhysicsNode,
  state: NodeState,
  context: DriftContext
): void => {
  if (!hasPosition(node)) return;
  const { reducedMotion, delta } = context;
  const entropy = state.entropy;
  const baseScale = reducedMotion ? 0.45 : 1;
  const angle = Math.atan2(node.y ?? 0, node.x ?? 0);
  const entropyDirection = entropy > HIGH_ENTROPY ? 1 : entropy < LOW_ENTROPY ? -1 : 0;
  const entropyMagnitude =
    entropyDirection === 0
      ? 0.08 * baseScale
      : lerp(0.12, 0.4, entropy) * entropyDirection * baseScale;
  const driftX = Math.cos(angle) * entropyMagnitude * delta;
  const driftY = Math.sin(angle) * entropyMagnitude * delta;

  const noiseFactor = delta * (reducedMotion ? 0.35 : 0.65);
  const noiseX = (pseudoRandom(state.driftSeed + state.tick * 11.3) - 0.5) * 0.04 * noiseFactor;
  const noiseY = (pseudoRandom(state.driftSeed + state.tick * 17.7) - 0.5) * 0.04 * noiseFactor;

  const vx = (node.vx ?? 0) + driftX + noiseX;
  const vy = (node.vy ?? 0) + driftY + noiseY;

  if (entropy < LOW_ENTROPY) {
    const stabilizer = (LOW_ENTROPY - entropy) * 0.4 * baseScale;
    node.vx = vx - (node.x ?? 0) * stabilizer * delta;
    node.vy = vy - (node.y ?? 0) * stabilizer * delta;
  } else {
    node.vx = vx;
    node.vy = vy;
  }

  state.driftVector = {
    x: driftX + noiseX,
    y: driftY + noiseY,
  };
  state.tick += 1;
};

const detectWobble = (node: PhysicsNode, state: NodeState): void => {
  if (!hasPosition(node)) {
    state.positions.length = 0;
    return;
  }
  state.positions.push({ x: node.x ?? 0, y: node.y ?? 0 });
  if (state.positions.length > WOBBLE_HISTORY) {
    state.positions.shift();
  }
  if (state.positions.length < 6) {
    state.wobbleScore = 0;
    state.orbitPattern = "stable";
    return;
  }
  let repeats = 0;
  for (let i = 3; i < state.positions.length; i += 1) {
    const current = state.positions[i];
    const prev = state.positions[i - 3];
    const dx = current.x - prev.x;
    const dy = current.y - prev.y;
    if (Math.hypot(dx, dy) < WOBBLE_PROX_THRESHOLD) {
      repeats += 1;
    }
  }
  const repeatRatio = repeats / Math.max(1, state.positions.length - 3);

  let oscillations = 0;
  for (let i = 2; i < state.positions.length; i += 1) {
    const a = state.positions[i - 2];
    const b = state.positions[i - 1];
    const c = state.positions[i];
    const dir1 = Math.atan2(b.y - a.y, b.x - a.x);
    const dir2 = Math.atan2(c.y - b.y, c.x - b.x);
    const deltaTheta = Math.abs(dir2 - dir1);
    if (deltaTheta > Math.PI) {
      oscillations += 1;
    }
  }
  const oscillationScore = clamp01(oscillations / (state.positions.length - 2));

  let variance = 0;
  const mean = state.positions.reduce(
    (acc, point) => {
      acc.x += point.x;
      acc.y += point.y;
      return acc;
    },
    { x: 0, y: 0 }
  );
  mean.x /= state.positions.length;
  mean.y /= state.positions.length;
  for (const point of state.positions) {
    variance += Math.hypot(point.x - mean.x, point.y - mean.y);
  }
  variance /= state.positions.length;
  const varianceScore = clamp01(variance / 260);

  const wobbleScore = clamp01(repeatRatio * 0.45 + oscillationScore * 0.35 + varianceScore * 0.2);
  state.wobbleScore = wobbleScore;
  state.orbitPattern =
    wobbleScore > 0.7 ? "chaotic" : wobbleScore > 0.42 ? "restless" : "stable";
};

type RawCluster = {
  center: Vector2;
  memberIds: string[];
  minDistance: number;
  avgDistance: number;
  density: number;
  affinities: Map<string, number>;
};

type ClusterSnapshot = RawCluster & {
  id: string;
  persistScore: number;
};

type ClusterMemory = {
  id: string;
  center: Vector2;
  persist: number;
};

const detectRawClusters = (nodes: PhysicsNode[]): RawCluster[] => {
  const result: RawCluster[] = [];
  nodes.forEach((node) => {
    if (!hasPosition(node)) return;
    const neighbors: Array<{ node: PhysicsNode; distance: number }> = [];
    nodes.forEach((other) => {
      if (node === other || !hasPosition(other)) return;
      const distance = Math.hypot((other.x ?? 0) - (node.x ?? 0), (other.y ?? 0) - (node.y ?? 0));
      if (distance <= CLUSTER_RADIUS) {
        neighbors.push({ node: other, distance });
      }
    });
    if (neighbors.length < CLUSTER_MIN_NEIGHBORS) return;
    const memberIds = new Set<string>();
    memberIds.add(node.id);
    const affinities = new Map<string, number>();
    neighbors.forEach(({ node: neighbor, distance }) => {
      memberIds.add(neighbor.id);
      const weight = clamp01(1 - distance / CLUSTER_RADIUS);
      affinities.set(neighbor.id, weight);
    });
    affinities.set(node.id, 1);
    const distances = neighbors.map((entry) => entry.distance);
    result.push({
      center: { x: node.x ?? 0, y: node.y ?? 0 },
      memberIds: Array.from(memberIds),
      minDistance: Math.min(...distances),
      avgDistance: distances.reduce((sum, value) => sum + value, 0) / distances.length,
      density: neighbors.length / (Math.PI * CLUSTER_RADIUS * CLUSTER_RADIUS),
      affinities,
    });
  });
  return result;
};

class ClusterComputer {
  private tick = 0;
  private cache: ClusterMemory[] = [];
  private idCounter = 0;

  reset(): void {
    this.tick = 0;
    this.cache = [];
  }

  sample(nodes: PhysicsNode[], states: Map<string, NodeState>): void {
    this.tick += 1;
    if (this.tick % CLUSTER_SAMPLE_INTERVAL !== 0) {
      return;
    }
    const raw = detectRawClusters(nodes).slice(0, MAX_CLUSTER_RESULTS * 2);
    const resolved = this.merge(raw);
    const activeClusters = new Set<string>();
    resolved.forEach((cluster) => {
      activeClusters.add(cluster.id);
      cluster.memberIds.forEach((nodeId) => {
        const state = states.get(nodeId);
        if (!state) return;
        const affinity = cluster.affinities.get(nodeId) ?? 0;
        state.clusterAffinities.set(cluster.id, clamp01(affinity * cluster.persistScore));
      });
    });
    states.forEach((state) => {
      state.clusterAffinities.forEach((value, key) => {
        if (activeClusters.has(key)) {
          return;
        }
        const next = value * 0.82;
        if (next < 0.04) {
          state.clusterAffinities.delete(key);
        } else {
          state.clusterAffinities.set(key, next);
        }
      });
    });
  }

  private merge(raw: RawCluster[]): ClusterSnapshot[] {
    const resolved: ClusterSnapshot[] = [];
    raw.forEach((cluster) => {
      const match = this.findMatch(cluster);
      const id = match?.id ?? `cluster-${this.idCounter += 1}`;
      const persistScore = match ? clamp01(match.persist * 0.7 + 0.3) : 0.45;
      resolved.push({
        ...cluster,
        id,
        persistScore,
      });
      if (match) {
        match.center = cluster.center;
        match.persist = persistScore;
      } else {
        this.cache.push({ id, center: cluster.center, persist: persistScore });
      }
    });
    this.cache = this.cache
      .map((entry) => {
        if (resolved.some((cluster) => cluster.id === entry.id)) {
          return entry;
        }
        const next = entry.persist * 0.8;
        if (next < 0.05) {
          return null;
        }
        return { ...entry, persist: next };
      })
      .filter((entry): entry is ClusterMemory => Boolean(entry));
    return resolved.slice(0, MAX_CLUSTER_RESULTS);
  }

  private findMatch(cluster: RawCluster): ClusterMemory | undefined {
    let closest: ClusterMemory | undefined;
    let bestDistance = Infinity;
    this.cache.forEach((entry) => {
      const distance = Math.hypot(entry.center.x - cluster.center.x, entry.center.y - cluster.center.y);
      if (distance < CLUSTER_RADIUS * 0.5 && distance < bestDistance) {
        closest = entry;
        bestDistance = distance;
      }
    });
    return closest;
  }
}

class OrbitalPhysicsForce {
  private nodes: PhysicsNode[] = [];
  private states = new Map<string, NodeState>();
  private lastTimestamp = nowMs();
  private suspended = false;
  private reducedMotion = false;
  private taskLookup = new Map<string, Task>();
  private clusterComputer = new ClusterComputer();
  private tickCounter = 0;
  private forceFn: D3Force<PhysicsNode>;

  constructor() {
    const force: D3Force<PhysicsNode> = (() => {
      if (this.suspended || !this.nodes.length) return;
      this.step();
    }) as D3Force<PhysicsNode>;
    force.initialize = (nodes: PhysicsNode[]) => {
      this.nodes = nodes;
      this.reconcileStates();
    };
    this.forceFn = force;
  }

  getForce(): D3Force<PhysicsNode> {
    return this.forceFn;
  }

  updateTaskLookup(taskLookup: Map<string, Task>): void {
    this.taskLookup = taskLookup;
    this.reconcileStates();
  }

  syncNodes(nodes: PhysicsNode[]): void {
    this.nodes = nodes;
    this.forceFn.initialize?.(nodes);
  }

  setReducedMotion(value: boolean): void {
    this.reducedMotion = value;
  }

  setSuspended(value: boolean): void {
    this.suspended = value;
  }

  dispose(): void {
    this.nodes = [];
    this.states.clear();
    this.clusterComputer.reset();
  }

  private reconcileStates(): void {
    const seen = new Set<string>();
    this.nodes.forEach((node) => {
      seen.add(node.id);
      const state = this.ensureState(node);
      const task = this.taskLookup.get(node.id);
      state.entropy = computeEntropy(node, task);
      state.objectType = classifyOrbitalRole(node, state.entropy, task);
    });
    Array.from(this.states.keys()).forEach((id) => {
      if (!seen.has(id)) {
        this.states.delete(id);
      }
    });
    this.clusterComputer.reset();
  }

  private ensureState(node: PhysicsNode): NodeState {
    let state = this.states.get(node.id);
    if (!state) {
      state = {
        objectType: "asteroid",
        entropy: 0.3,
        smoothedVelocity: { x: 0, y: 0 },
        driftVector: { x: 0, y: 0 },
        driftSeed: hashStringToFloat(node.id) * 1000,
        tick: 1,
        wobbleScore: 0,
        orbitPattern: "stable",
        positions: [],
        clusterAffinities: new Map(),
      };
      this.states.set(node.id, state);
    }
    return state;
  }

  private step(): void {
    const now = nowMs();
    const delta = clamp((now - this.lastTimestamp) / 1000, 1 / 120, 0.08);
    this.lastTimestamp = now;
    this.tickCounter += 1;
    const majorMasses = this.nodes.filter((node) => this.states.get(node.id)?.objectType === "sun");

    this.nodes.forEach((node) => {
      const state = this.ensureState(node);
      updateInertia(node, state, {
        delta,
        reducedMotion: this.reducedMotion,
        majorMasses,
      });
      applyDrift(node, state, { delta, reducedMotion: this.reducedMotion });
      detectWobble(node, state);
      this.decorateNode(node, state);
    });

    if (this.tickCounter % CLUSTER_SAMPLE_INTERVAL === 0) {
      this.clusterComputer.sample(this.nodes, this.states);
      this.nodes.forEach((node) => {
        const state = this.states.get(node.id);
        if (!state) return;
        this.decorateNode(node, state);
      });
    }
  }

  private decorateNode(node: PhysicsNode, state: NodeState): void {
    const decorated = node as PhysicsDecoratedNode;
    decorated.physicsMeta = {
      entropy: state.entropy,
      objectType: state.objectType,
      driftVector: { ...state.driftVector },
      clusterAffinities: Array.from(state.clusterAffinities.entries()).map(([id, weight]) => ({
        id,
        weight: Number(weight.toFixed(3)),
      })),
    };
    decorated.wobbleScore = Number(state.wobbleScore.toFixed(3));
    decorated.orbitPattern = state.orbitPattern;
  }
}

class GraphPhysicsController {
  private readonly fg: ForceGraphInstance;
  private readonly forceName = "flowstate:orbital";
  private readonly orbitalForce: OrbitalPhysicsForce;

  constructor(fg: ForceGraphInstance) {
    this.fg = fg;
    this.orbitalForce = new OrbitalPhysicsForce();
    this.fg.d3Force?.(this.forceName, this.orbitalForce.getForce());
  }

  syncNodes(nodes: PhysicsNode[], reheating = true): void {
    this.orbitalForce.syncNodes(nodes);
    if (reheating) {
      this.fg.d3ReheatSimulation?.();
    }
  }

  setTaskLookup(taskLookup: Map<string, Task>): void {
    this.orbitalForce.updateTaskLookup(taskLookup);
  }

  setReducedMotion(value: boolean): void {
    this.orbitalForce.setReducedMotion(value);
  }

  setLocked(locked: boolean): void {
    this.orbitalForce.setSuspended(locked);
  }

  dispose(): void {
    this.fg.d3Force?.(this.forceName, null);
    this.orbitalForce.dispose();
  }
}

interface UseGraphPhysicsParams {
  fgRef: MutableRefObject<ForceGraphInstance | undefined>;
  graphData: GraphData;
  taskLookup: Map<string, Task>;
  locked: boolean;
  prefersReducedMotion: boolean;
}

export const useGraphPhysics = ({
  fgRef,
  graphData,
  taskLookup,
  locked,
  prefersReducedMotion,
}: UseGraphPhysicsParams): void => {
  const controllerRef = useRef<GraphPhysicsController | null>(null);

  useEffect(() => {
    if (controllerRef.current || !fgRef.current) {
      return;
    }
    const controller = new GraphPhysicsController(fgRef.current);
    controllerRef.current = controller;
    controller.setTaskLookup(taskLookup);
    controller.setReducedMotion(prefersReducedMotion);
    controller.setLocked(locked);
    controller.syncNodes(graphData.nodes as PhysicsNode[]);
    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, [fgRef]);

  useEffect(() => {
    controllerRef.current?.setTaskLookup(taskLookup);
  }, [taskLookup]);

  useEffect(() => {
    controllerRef.current?.setReducedMotion(prefersReducedMotion);
  }, [prefersReducedMotion]);

  useEffect(() => {
    controllerRef.current?.setLocked(locked);
  }, [locked]);

  useEffect(() => {
    if (!graphData.nodes.length) {
      return;
    }
    controllerRef.current?.syncNodes(graphData.nodes as PhysicsNode[], false);
  }, [graphData.nodes]);
};
