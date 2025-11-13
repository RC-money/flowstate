import type { Task } from "../hooks/useLocalTasks";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const clamp = (value: number, min = 0, max = 1): number =>
  Math.max(min, Math.min(max, value));

const lerp = (start: number, end: number, alpha: number): number =>
  start + (end - start) * alpha;

const average = (values: number[]): number => {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const getHourOfDay = (timestamp: number): number => {
  const date = new Date(timestamp);
  return date.getHours();
};

const getDayOfWeek = (timestamp: number): number => {
  const date = new Date(timestamp);
  return date.getDay();
};

export type IntentMode = "flow" | "hunt" | "drift" | "rest";

export type OrbitalBodyKind = "sun" | "moon" | "comet" | "asteroid";

export interface TaskCognitiveState {
  id: string;
  title?: string;
  status?: Task["status"];
  typeHint?: OrbitalBodyKind | string;
  heat?: number;
  entropy?: number;
  touchCount?: number;
  lastTouchedAt?: number;
  lastHeatPeak?: number;
  createdAt?: number;
  tetheredToCore?: boolean;
  previouslyTethered?: boolean;
  clusterId?: string;
  tags?: string[];
  orbitTrace?: OrbitSample[];
  heatHistory?: HeatSample[];
  seasonalAlignment?: IntentMode | string;
  momentum?: number;
}

export interface InteractionEvent {
  timestamp: number;
  type: "focus" | "open" | "peek" | "inspect" | "complete" | "tether" | "untether" | "heatSpike" | string;
  taskId?: string;
  payload?: Record<string, unknown>;
}

export interface OrbitSample {
  timestamp: number;
  taskId: string;
  radius: number;
  velocity?: number;
}

export interface HeatSample {
  timestamp: number;
  taskId: string;
  value: number;
}

export interface IntentEpisode {
  mode: IntentMode;
  startedAt: number;
  endedAt: number;
  intensity?: number;
  scatter?: number;
  interactions?: number;
}

export interface StrangeLoopContext {
  tasks: TaskCognitiveState[];
  interactions: InteractionEvent[];
  orbitSamples?: OrbitSample[];
  heatTimeline?: HeatSample[];
  intentEpisodes?: IntentEpisode[];
  timestamp?: number;
}

export interface RecursionInsight {
  recursionScore: number;
  recursionType: "taskRevisit" | "spiralOrbit" | "circadianHeat" | "deadSunCycle" | "none";
  recursionTrigger: string | null;
  taskIds?: string[];
}

export interface IntentEchoProfile {
  flowDwell: number;
  huntAggression: number;
  driftScatter: number;
  weeklyEcho?: {
    mode: IntentMode;
    day: number;
    score: number;
  };
  dailyRhythm?: {
    mode: IntentMode;
    hour: number;
    score: number;
  };
  signature: string;
  updatedAt: number;
}

export interface ParadoxInsight {
  paradoxDetected: boolean;
  paradoxType: "hotSunIgnored" | "coldMoonFixation" | "entropyTether" | "cometEscape" | "none";
  paradoxNodeIds: string[];
  note?: string;
}

export type MagnetismMatrix = Record<string, Record<string, number>>;

export interface StrangeLoopQuestion {
  generatedQuestion: string;
  contextTags: string[];
  relatedTasks: string[];
  confidence: number;
}

export interface StrangeLoopAnalysis {
  recursion: RecursionInsight;
  intentEcho: IntentEchoProfile;
  paradox: ParadoxInsight;
  magnetism: MagnetismMatrix;
  question: StrangeLoopQuestion;
}

const DEFAULT_RECURSION: RecursionInsight = {
  recursionScore: 0,
  recursionType: "none",
  recursionTrigger: null,
  taskIds: [],
};

const DEFAULT_PARADOX: ParadoxInsight = {
  paradoxDetected: false,
  paradoxType: "none",
  paradoxNodeIds: [],
  note: undefined,
};

const DEFAULT_INTENT_ECHO: IntentEchoProfile = {
  flowDwell: 0,
  huntAggression: 0,
  driftScatter: 0,
  signature: "no-pattern",
  updatedAt: Date.now(),
};

const DEFAULT_QUESTION: StrangeLoopQuestion = {
  generatedQuestion: "Your galaxy is quiet, but the silence is data. What ritual do you need to begin?",
  contextTags: [],
  relatedTasks: [],
  confidence: 0.25,
};

const FOCUS_EVENT_TYPES = new Set(["focus", "open", "peek", "inspect"]);

const identifyTask = (tasks: TaskCognitiveState[], id?: string): TaskCognitiveState | undefined => {
  if (!id) return undefined;
  return tasks.find((task) => task.id === id);
};

const formatTaskLabel = (task?: TaskCognitiveState): string => {
  if (!task) return "this task";
  if (task.title?.trim()) return task.title.trim();
  return task.id;
};

const normalizeHeat = (value?: number): number => {
  if (typeof value !== "number" || Number.isNaN(value)) return 0.5;
  return clamp(value, 0, 1);
};

const calcDuration = (episode: IntentEpisode): number =>
  Math.max(0, (episode.endedAt ?? episode.startedAt) - episode.startedAt);

const computeRevisitScore = (
  interactions: InteractionEvent[],
  tasks: TaskCognitiveState[]
): { score: number; taskId: string | null; loops: number; message?: string } => {
  if (!interactions.length) {
    return { score: 0, taskId: null, loops: 0 };
  }
  const byTask = new Map<string, number>();
  const timestampsByTask = new Map<string, number[]>();
  interactions
    .filter((event) => FOCUS_EVENT_TYPES.has(event.type) && event.taskId)
    .forEach((event) => {
      const list = timestampsByTask.get(event.taskId!) ?? [];
      list.push(event.timestamp);
      timestampsByTask.set(event.taskId!, list);
    });
  let topTask: string | null = null;
  let topLoops = 0;
  timestampsByTask.forEach((timestamps, taskId) => {
    if (timestamps.length < 3) {
      return;
    }
    const sorted = timestamps.slice().sort((a, b) => a - b);
    let loops = 0;
    for (let i = 1; i < sorted.length; i += 1) {
      const delta = sorted[i] - sorted[i - 1];
      if (delta <= 3 * HOUR) {
        loops += 1;
      }
    }
    byTask.set(taskId, loops);
    if (loops > topLoops) {
      topLoops = loops;
      topTask = taskId;
    }
  });
  const score = clamp(topLoops / 6, 0, 1);
  if (topTask) {
    const task = identifyTask(tasks, topTask);
    const label = formatTaskLabel(task);
    return {
      score,
      taskId: topTask,
      loops: topLoops,
      message: `You keep re-entering ${label}.`,
    };
  }
  return { score, taskId: null, loops: 0 };
};

const computeSpiralScore = (tasks: TaskCognitiveState[]): { score: number; taskId: string | null } => {
  let bestTask: string | null = null;
  let bestScore = 0;
  tasks.forEach((task) => {
    if (!task.orbitTrace || task.orbitTrace.length < 6) return;
    const trace = task.orbitTrace.slice().sort((a, b) => a.timestamp - b.timestamp);
    let flips = 0;
    let lastDirection = 0;
    for (let i = 1; i < trace.length; i += 1) {
      const delta = trace[i].radius - trace[i - 1].radius;
      if (Math.abs(delta) < 4) continue;
      const direction = delta > 0 ? 1 : -1;
      if (lastDirection !== 0 && direction !== lastDirection) {
        flips += 1;
      }
      lastDirection = direction;
    }
    if (flips === 0) return;
    const spiralScore = clamp(flips / (trace.length - 1), 0, 1);
    if (spiralScore > bestScore) {
      bestScore = spiralScore;
      bestTask = task.id;
    }
  });
  return { score: bestScore, taskId: bestTask };
};

const computeHeatCycleScore = (heat: HeatSample[]): { score: number; hour: number | null } => {
  if (!heat.length) {
    return { score: 0, hour: null };
  }
  const buckets = new Map<number, number>();
  heat.forEach((sample) => {
    const hour = getHourOfDay(sample.timestamp);
    buckets.set(hour, (buckets.get(hour) ?? 0) + sample.value);
  });
  let topHour: number | null = null;
  let topValue = 0;
  let total = 0;
  buckets.forEach((value, hour) => {
    total += value;
    if (value > topValue) {
      topValue = value;
      topHour = hour;
    }
  });
  if (!total || topHour === null) {
    return { score: 0, hour: null };
  }
  const baseline = total / 24;
  const normalized = clamp((topValue - baseline) / (total - baseline || 1), 0, 1);
  return { score: normalized, hour: topHour };
};

const computeDeadSunScore = (tasks: TaskCognitiveState[]): { score: number; taskId: string | null } => {
  let bestScore = 0;
  let candidate: TaskCognitiveState | null = null;
  tasks.forEach((task) => {
    const isSun = task.typeHint === "sun" || (task.typeHint?.toLowerCase().includes("sun") ?? false);
    if (!isSun || !task.heatHistory || task.heatHistory.length < 4) return;
    const sorted = task.heatHistory.slice().sort((a, b) => a.timestamp - b.timestamp);
    let cycles = 0;
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1];
      const next = sorted[i];
      if (prev.value < 0.25 && next.value > 0.6 && next.timestamp - prev.timestamp <= DAY) {
        cycles += 1;
      }
    }
    if (!cycles) return;
    const score = clamp(cycles / 3, 0, 1);
    if (score > bestScore) {
      bestScore = score;
      candidate = task;
    }
  });
  const taskId = candidate ? (candidate as TaskCognitiveState).id : null;
  return { score: bestScore, taskId };
};

export const scanRecursions = (context: StrangeLoopContext): RecursionInsight => {
  if (!context) return DEFAULT_RECURSION;
  const interactions = context.interactions ?? [];
  const tasks = context.tasks ?? [];
  const heatTimeline = context.heatTimeline ?? [];
  const revisit = computeRevisitScore(interactions, tasks);
  const spiral = computeSpiralScore(tasks);
  const heatCycle = computeHeatCycleScore(heatTimeline);
  const deadSun = computeDeadSunScore(tasks);

  const candidates: Array<{
    type: RecursionInsight["recursionType"];
    score: number;
    trigger: string | null;
    taskIds?: string[];
  }> = [
    {
      type: "taskRevisit",
      score: revisit.score,
      trigger: revisit.message ?? null,
      taskIds: revisit.taskId ? [revisit.taskId] : [],
    },
    {
      type: "spiralOrbit",
      score: spiral.score,
      trigger: spiral.taskId
        ? `${formatTaskLabel(identifyTask(tasks, spiral.taskId))} is spiraling in predictable loops.`
        : null,
      taskIds: spiral.taskId ? [spiral.taskId] : [],
    },
    {
      type: "circadianHeat",
      score: heatCycle.score,
      trigger: heatCycle.hour !== null ? `Your heat spikes around ${heatCycle.hour}:00 every day.` : null,
    },
    {
      type: "deadSunCycle",
      score: deadSun.score,
      trigger: deadSun.taskId
        ? `${formatTaskLabel(identifyTask(tasks, deadSun.taskId))} keeps re-igniting after going cold.`
        : null,
      taskIds: deadSun.taskId ? [deadSun.taskId] : [],
    },
  ];

  const winner = candidates.reduce<RecursionInsight>(
    (prev, current) => {
      if (current.score > prev.recursionScore) {
        return {
          recursionScore: current.score,
          recursionType: current.type,
          recursionTrigger: current.trigger ?? null,
          taskIds: current.taskIds,
        };
      }
      return prev;
    },
    { ...DEFAULT_RECURSION }
  );

  return winner;
};

export const computeIntentEchoProfile = (
  context: StrangeLoopContext,
  previous?: IntentEchoProfile
): IntentEchoProfile => {
  const episodes = context.intentEpisodes ?? [];
  if (!episodes.length && previous) {
    return previous;
  }
  const flowDurations = episodes.filter((episode) => episode.mode === "flow").map((episode) => calcDuration(episode));
  const huntAggression = episodes
    .filter((episode) => episode.mode === "hunt")
    .map((episode) => {
      const duration = Math.max(calcDuration(episode) / HOUR, 0.25);
      const bursts = episode.interactions ?? 1;
      return bursts / duration;
    });
  const driftScatter = episodes
    .filter((episode) => episode.mode === "drift")
    .map((episode) => episode.scatter ?? episode.intensity ?? 0);

  const weeklyBuckets = new Map<string, { score: number; mode: IntentMode; day: number }>();
  const dailyBuckets = new Map<string, { score: number; mode: IntentMode; hour: number }>();
  episodes.forEach((episode) => {
    const duration = calcDuration(episode);
    const intensity = episode.intensity ?? 0.5;
    const weight = clamp(duration / (2 * HOUR), 0, 1) * 0.6 + clamp(intensity, 0, 1) * 0.4;
    const day = getDayOfWeek(episode.startedAt);
    const hour = getHourOfDay(episode.startedAt);
    const weeklyKey = `${episode.mode}:${day}`;
    const dailyKey = `${episode.mode}:${hour}`;
    weeklyBuckets.set(weeklyKey, {
      score: (weeklyBuckets.get(weeklyKey)?.score ?? 0) + weight,
      mode: episode.mode,
      day,
    });
    dailyBuckets.set(dailyKey, {
      score: (dailyBuckets.get(dailyKey)?.score ?? 0) + weight,
      mode: episode.mode,
      hour,
    });
  });

  const pickTop = <T extends { score: number }>(map: Map<string, T>): T | undefined => {
    let best: T | undefined;
    map.forEach((entry) => {
      if (!best || entry.score > best.score) {
        best = entry;
      }
    });
    return best;
  };

  const weeklyEcho = pickTop(weeklyBuckets);
  const dailyRhythm = pickTop(dailyBuckets);

  const nextProfile: IntentEchoProfile = {
    flowDwell: average(flowDurations) / HOUR,
    huntAggression: average(huntAggression),
    driftScatter: average(driftScatter),
    weeklyEcho: weeklyEcho
      ? {
          mode: weeklyEcho.mode,
          day: weeklyEcho.day,
          score: clamp(weeklyEcho.score / Math.max(episodes.length, 1), 0, 1),
        }
      : undefined,
    dailyRhythm: dailyRhythm
      ? {
          mode: dailyRhythm.mode,
          hour: dailyRhythm.hour,
          score: clamp(dailyRhythm.score / Math.max(episodes.length, 1), 0, 1),
        }
      : undefined,
    signature: (() => {
      if (!episodes.length) return previous?.signature ?? "no-pattern";
      if (weeklyEcho && weeklyEcho.score > 2) {
        return `${weeklyEcho.mode}-loop-${weeklyEcho.day}`;
      }
      if (dailyRhythm && dailyRhythm.score > 1.5) {
        return `${dailyRhythm.mode}-pulse-${dailyRhythm.hour}`;
      }
      return "shifting";
    })(),
    updatedAt: context.timestamp ?? Date.now(),
  };

  if (!previous) {
    return nextProfile;
  }
  return {
    flowDwell: lerp(previous.flowDwell, nextProfile.flowDwell, 0.6),
    huntAggression: lerp(previous.huntAggression, nextProfile.huntAggression, 0.6),
    driftScatter: lerp(previous.driftScatter, nextProfile.driftScatter, 0.6),
    weeklyEcho: nextProfile.weeklyEcho ?? previous.weeklyEcho,
    dailyRhythm: nextProfile.dailyRhythm ?? previous.dailyRhythm,
    signature: nextProfile.signature,
    updatedAt: nextProfile.updatedAt,
  };
};

export const locateParadox = (context: StrangeLoopContext): ParadoxInsight => {
  const { tasks = [], interactions = [], timestamp = Date.now() } = context;
  if (!tasks.length) return DEFAULT_PARADOX;

  const recentInteractions = interactions.filter((event) => timestamp - event.timestamp <= DAY);

  const hotSun = tasks.find((task) => {
    const isSun =
      task.typeHint === "sun" ||
      (task.typeHint?.toLowerCase().includes("sun") ?? false) ||
      (task.tags ?? []).includes("sun");
    if (!isSun) return false;
    const heat = normalizeHeat(task.heat);
    if (heat < 0.65) return false;
    const lastTouch = task.lastTouchedAt ?? 0;
    return timestamp - lastTouch > 8 * HOUR;
  });
  if (hotSun) {
    return {
      paradoxDetected: true,
      paradoxType: "hotSunIgnored",
      paradoxNodeIds: [hotSun.id],
      note: `${formatTaskLabel(hotSun)} is volatile but untouched.`,
    };
  }

  const coldMoon = tasks.find((task) => {
    const isMoon =
      task.typeHint === "moon" ||
      (task.typeHint?.toLowerCase().includes("moon") ?? false) ||
      task.status === "DONE";
    if (!isMoon) return false;
    const heat = normalizeHeat(task.heat);
    if (heat > 0.35) return false;
    const touches = recentInteractions.filter((event) => event.taskId === task.id && FOCUS_EVENT_TYPES.has(event.type));
    return touches.length >= 3;
  });
  if (coldMoon) {
    return {
      paradoxDetected: true,
      paradoxType: "coldMoonFixation",
      paradoxNodeIds: [coldMoon.id],
      note: `${formatTaskLabel(coldMoon)} is cold, yet you keep staring at it.`,
    };
  }

  const tetherEvent = recentInteractions.find((event) => event.type === "tether" && event.taskId);
  if (tetherEvent) {
    const task = identifyTask(tasks, tetherEvent.taskId);
    if (task && (task.entropy ?? 0) >= 0.7) {
      return {
        paradoxDetected: true,
        paradoxType: "entropyTether",
        paradoxNodeIds: [task.id],
        note: `${formatTaskLabel(task)} is chaotic yet you anchored it.`,
      };
    }
  }

  const comet = tasks.find((task) => {
    const isComet = task.typeHint === "comet" || (task.typeHint?.toLowerCase().includes("comet") ?? false);
    if (!isComet || !task.orbitTrace || task.orbitTrace.length < 2) return false;
    const createdRecently = (context.timestamp ?? Date.now()) - (task.createdAt ?? 0) < 12 * HOUR;
    if (!createdRecently) return false;
    const trace = task.orbitTrace.slice().sort((a, b) => a.timestamp - b.timestamp);
    const first = trace[0];
    const last = trace[trace.length - 1];
    return last.radius - first.radius > 60;
  });

  if (comet) {
    return {
      paradoxDetected: true,
      paradoxType: "cometEscape",
      paradoxNodeIds: [comet.id],
      note: `${formatTaskLabel(comet)} was born and bolted.`,
    };
  }

  return DEFAULT_PARADOX;
};

const buildTouchAdjacency = (interactions: InteractionEvent[]): Map<string, number> => {
  const adjacency = new Map<string, number>();
  const sorted = interactions.slice().sort((a, b) => a.timestamp - b.timestamp);
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (!prev.taskId || !curr.taskId || prev.taskId === curr.taskId) continue;
    if (curr.timestamp - prev.timestamp > 15 * 60 * 1000) continue;
    const key = [prev.taskId, curr.taskId].sort().join("::");
    adjacency.set(key, (adjacency.get(key) ?? 0) + 1);
  }
  return adjacency;
};

const computeSharedConstellation = (a: TaskCognitiveState, b: TaskCognitiveState): number => {
  if (a.clusterId && a.clusterId === b.clusterId) return 1;
  if (a.tags && b.tags) {
    const shared = a.tags.filter((tag) => b.tags?.includes(tag));
    if (shared.length) {
      return clamp(shared.length / Math.max(a.tags.length, b.tags.length), 0, 1);
    }
  }
  return 0;
};

const computeMomentumSimilarity = (a: TaskCognitiveState, b: TaskCognitiveState): number => {
  if (typeof a.momentum !== "number" || typeof b.momentum !== "number") return 0;
  return 1 - Math.min(1, Math.abs(a.momentum - b.momentum));
};

const computeSeasonAlignment = (a: TaskCognitiveState, b: TaskCognitiveState): number => {
  if (!a.seasonalAlignment || !b.seasonalAlignment) return 0;
  return a.seasonalAlignment === b.seasonalAlignment ? 1 : 0;
};

export const computeMagnetismMatrix = (context: StrangeLoopContext): MagnetismMatrix => {
  const { tasks = [], interactions = [] } = context;
  if (!tasks.length) return {};
  const adjacency = buildTouchAdjacency(interactions);
  const maxTouch = Math.max(...Array.from(adjacency.values()), 0);
  const limit = tasks.length > 80 ? tasks.slice(0, 80) : tasks;
  const matrix: MagnetismMatrix = {};
  for (let i = 0; i < limit.length; i += 1) {
    const taskA = limit[i];
    for (let j = i + 1; j < limit.length; j += 1) {
      const taskB = limit[j];
      const heatSimilarity = 1 - Math.abs(normalizeHeat(taskA.heat) - normalizeHeat(taskB.heat));
      const key = [taskA.id, taskB.id].sort().join("::");
      const touchWeight = maxTouch > 0 ? (adjacency.get(key) ?? 0) / maxTouch : 0;
      const constellation = computeSharedConstellation(taskA, taskB);
      const momentum = computeMomentumSimilarity(taskA, taskB);
      const season = computeSeasonAlignment(taskA, taskB);
      const force =
        heatSimilarity * 0.28 +
        touchWeight * 0.24 +
        constellation * 0.18 +
        momentum * 0.17 +
        season * 0.13;
      const normalized = clamp(force, 0, 1);
      if (normalized < 0.05) continue;
      matrix[taskA.id] = matrix[taskA.id] ?? {};
      matrix[taskB.id] = matrix[taskB.id] ?? {};
      matrix[taskA.id][taskB.id] = normalized;
      matrix[taskB.id][taskA.id] = normalized;
    }
  }
  return matrix;
};

const selectStrongestMagnetPair = (matrix: MagnetismMatrix): { pair: [string, string] | null; force: number } => {
  let bestPair: [string, string] | null = null;
  let bestForce = 0;
  Object.entries(matrix).forEach(([id, row]) => {
    Object.entries(row).forEach(([targetId, force]) => {
      if (force > bestForce) {
        bestForce = force;
        bestPair = [id, targetId];
      }
    });
  });
  return { pair: bestPair, force: bestForce };
};

const summarizeIntentEcho = (profile: IntentEchoProfile): string | null => {
  if (profile.weeklyEcho && profile.weeklyEcho.score > 0.5) {
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayName = dayNames[profile.weeklyEcho.day] ?? `day ${profile.weeklyEcho.day}`;
    return `${profile.weeklyEcho.mode} spikes every ${dayName}`;
  }
  if (profile.dailyRhythm && profile.dailyRhythm.score > 0.4) {
    return `${profile.dailyRhythm.mode} resonates near ${profile.dailyRhythm.hour}:00`;
  }
  return null;
};

export const generateStrangeLoopQuestion = (
  context: StrangeLoopContext,
  analysis: {
    recursion: RecursionInsight;
    intentEcho: IntentEchoProfile;
    paradox: ParadoxInsight;
    magnetism: MagnetismMatrix;
  }
): StrangeLoopQuestion => {
  const { tasks = [] } = context;
  const candidates: Array<{ text: string; score: number; tags: string[]; taskIds: string[] }> = [];
  const { recursion, intentEcho, paradox, magnetism } = analysis;
  const intentSummary = summarizeIntentEcho(intentEcho);

  if (paradox.paradoxDetected) {
    const task = identifyTask(tasks, paradox.paradoxNodeIds[0]);
    if (task) {
      if (paradox.paradoxType === "hotSunIgnored") {
        candidates.push({
          text: `${formatTaskLabel(task)} burns bright while you look away. What are you afraid will happen if you finally touch it?`,
          score: 0.82,
          tags: ["paradox", "heat"],
          taskIds: [task.id],
        });
      } else if (paradox.paradoxType === "coldMoonFixation") {
        candidates.push({
          text: `You keep peeking at ${formatTaskLabel(task)} even though it's cold. Is that inspection caution or attachment?`,
          score: 0.78,
          tags: ["paradox", "recursion"],
          taskIds: [task.id],
        });
      } else if (paradox.paradoxType === "entropyTether") {
        candidates.push({
          text: `${formatTaskLabel(task)} is chaotic yet you tethered it to your core. What belief keeps that storm in your inner orbit?`,
          score: 0.8,
          tags: ["paradox", "tether"],
          taskIds: [task.id],
        });
      } else if (paradox.paradoxType === "cometEscape") {
        candidates.push({
          text: `${formatTaskLabel(task)} was born and immediately bolted. Why did you launch a comet you had no intention of steering?`,
          score: 0.77,
          tags: ["paradox", "drift"],
          taskIds: [task.id],
        });
      }
    }
  }

  if (recursion.recursionScore > 0.3) {
    if (recursion.recursionType === "taskRevisit" && recursion.taskIds?.length) {
      const task = identifyTask(tasks, recursion.taskIds[0]);
      candidates.push({
        text: `You orbit ${formatTaskLabel(task)} over and over. What ritual starts there that you never finish?`,
        score: recursion.recursionScore,
        tags: ["recursion"],
        taskIds: recursion.taskIds,
      });
    } else if (recursion.recursionType === "circadianHeat" && intentSummary) {
      candidates.push({
        text: `Your energy spikes mirror your ${intentSummary}. Which rhythm are you resisting?`,
        score: recursion.recursionScore * 0.9,
        tags: ["recursion", "intent"],
        taskIds: recursion.taskIds ?? [],
      });
    } else if (recursion.recursionType === "spiralOrbit" && recursion.taskIds?.length) {
      candidates.push({
        text: `${formatTaskLabel(identifyTask(tasks, recursion.taskIds[0]))} spins in precise spirals. What pattern are you honoring every time you loop back?`,
        score: recursion.recursionScore * 0.95,
        tags: ["recursion", "orbit"],
        taskIds: recursion.taskIds,
      });
    }
  }

  const magnetPair = selectStrongestMagnetPair(magnetism);
  if (magnetPair.pair && magnetPair.force > 0.45) {
    const [aId, bId] = magnetPair.pair;
    const taskA = identifyTask(tasks, aId);
    const taskB = identifyTask(tasks, bId);
    candidates.push({
      text: `${formatTaskLabel(taskA)} and ${formatTaskLabel(taskB)} keep pulling at each other like twin suns. Why are they still apart?`,
      score: magnetPair.force,
      tags: ["magnetism"],
      taskIds: [aId, bId],
    });
  }

  if (intentSummary) {
    candidates.push({
      text: `You enter ${intentEcho.dailyRhythm?.mode ?? intentEcho.weeklyEcho?.mode ?? "flow"} on a schedule but abandon it when the echo returns. What contract did you sign with that rhythm?`,
      score: 0.55,
      tags: ["intent"],
      taskIds: [],
    });
  }

  const bestCandidate =
    candidates.length > 0
      ? candidates.reduce((prev, current) => (current.score > prev.score ? current : prev))
      : null;

  if (!bestCandidate) {
    return DEFAULT_QUESTION;
  }

  const confidence = clamp(
    (bestCandidate.score +
      (paradox.paradoxDetected ? 0.2 : 0) +
      (recursion.recursionScore > 0.4 ? 0.15 : 0) +
      (magnetPair.force ?? 0) * 0.1) /
      1.4,
    0.3,
    0.98
  );

  return {
    generatedQuestion: bestCandidate.text,
    contextTags: bestCandidate.tags,
    relatedTasks: bestCandidate.taskIds,
    confidence,
  };
};

export const analyzeStrangeLoop = (
  context: StrangeLoopContext,
  previousIntentEcho?: IntentEchoProfile
): StrangeLoopAnalysis => {
  const recursion = scanRecursions(context);
  const intentEcho = computeIntentEchoProfile(context, previousIntentEcho);
  const paradox = locateParadox(context);
  const magnetism = computeMagnetismMatrix(context);
  const question = generateStrangeLoopQuestion(context, {
    recursion,
    intentEcho,
    paradox,
    magnetism,
  });
  return { recursion, intentEcho, paradox, magnetism, question };
};

export const EMPTY_STRANGE_LOOP_ANALYSIS: StrangeLoopAnalysis = {
  recursion: DEFAULT_RECURSION,
  intentEcho: DEFAULT_INTENT_ECHO,
  paradox: DEFAULT_PARADOX,
  magnetism: {},
  question: DEFAULT_QUESTION,
};
