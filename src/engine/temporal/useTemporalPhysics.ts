import { useEffect, useMemo, useState } from "react";
import type { Task } from "../../hooks/useLocalTasks";
import { getTemporalEngine, TemporalPhysicsEngine } from "./temporalPhysics";
import type { TemporalBody, TemporalEvent } from "./types";

export interface TemporalPhysicsOptions {
  tasks?: Task[];
  enabled?: boolean;
}

export interface TemporalPhysicsState {
  engine: TemporalPhysicsEngine;
  bodies: Map<string, TemporalBody>;
  emitTemporalEvent: (event: TemporalEvent) => void;
}

export const useTemporalPhysics = (options?: TemporalPhysicsOptions): TemporalPhysicsState => {
  const { tasks, enabled = true } = options ?? {};
  const engine = useMemo(() => getTemporalEngine(), []);
  const [bodies, setBodies] = useState<Map<string, TemporalBody>>(engine.getSnapshot().bodies);

  useEffect(() => {
    if (!tasks) return;
    engine.syncTasks(tasks);
  }, [engine, tasks]);

  useEffect(() => {
    if (!enabled) {
      engine.stop();
      return undefined;
    }
    engine.start();
    const unsubscribe = engine.subscribe((snapshot) => {
      setBodies(snapshot.bodies);
    });
    return () => {
      unsubscribe();
    };
  }, [engine, enabled]);

  const emitTemporalEvent = (event: TemporalEvent) => {
    engine.emit(event);
  };

  return { engine, bodies, emitTemporalEvent };
};
