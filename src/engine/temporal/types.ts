import type { Task } from "../../hooks/useLocalTasks";

export type CelestialKind = "sun" | "moon" | "asteroid" | "comet" | "blackhole";

export interface TemporalBody {
  id: string;
  title: string;
  status: Task["status"];
  kind: CelestialKind;
  heat: number;
  entropy: number;
  drift: number;
  momentum: number;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  orbitRadius: number;
  orbitTheta: number;
  lastUpdate: number;
  lastTouchedAt: number;
}

export interface TemporalEvent {
  type: "touch" | "boost" | "gravity";
  taskId: string;
  payload?: Record<string, unknown>;
  timestamp?: number;
}

export interface TemporalSnapshot {
  bodies: Map<string, TemporalBody>;
  updatedAt: number;
}
