import type { Task } from "../../hooks/useLocalTasks";

export type ObserverEventType =
  | "task_touch"
  | "drag_move"
  | "heat_sample"
  | "session_tick";

export interface ObserverEvent {
  type: ObserverEventType;
  taskId?: string;
  timestamp: number;
  payload?: Record<string, unknown>;
}

export interface TaskSignal {
  taskId: string;
  title: string;
  status: Task["status"];
  touches: number;
  entropy: number;
  heat: number;
  drift: number;
  momentum: number;
  lastTouchedAt: number;
  updatedAt: number;
}

export interface EntropySample {
  taskId: string;
  entropy: number;
  heat: number;
  updatedAt: number;
}

export interface ObserverInsight {
  id: string;
  kind: "entropy-spike" | "drift" | "heat-neglect" | "momentum" | "observation";
  summary: string;
  detail?: string;
  confidence: number;
  taskIds: string[];
  createdAt: number;
  data?: Record<string, unknown>;
}

export interface ObserverEngineSnapshot {
  signals: Map<string, TaskSignal>;
  insights: ObserverInsight[];
}
