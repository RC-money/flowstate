export type ObserverEventType =
  | "task_touch"
  | "task_snapshot"
  | "drag_move"
  | "heat_sample"
  | "session_tick";

export interface ObserverEvent {
  type: ObserverEventType;
  taskId?: string;
  timestamp?: number;
  payload?: Record<string, unknown>;
}

export interface TaskSignal {
  taskId: string;
  title: string;
  status: string;
  touches: number;
  entropy: number;
  heat: number;
  drift: number;
  momentum: number;
  lastTouchedAt: number;
  updatedAt: number;
}

export type InsightKind = "entropy" | "momentum" | "drift" | "overburden" | "dark-forest";

export interface Insight {
  id: string;
  kind: InsightKind;
  message: string;
  confidence: number;
  taskIds: string[];
  createdAt: number;
  meta?: Record<string, unknown>;
}

export interface ObserverState {
  signals: Map<string, TaskSignal>;
  insights: Insight[];
  config: ObserverConfig;
}

export interface ObserverConfig {
  maxInsights: number;
  entropyDecay: number;
  heatDecay: number;
  momentumDecay: number;
}
