import { useCallback, useEffect, useMemo, useState } from "react";
import type { Task } from "../../hooks/useLocalTasks";
import { getTemporalEngine, TemporalPhysicsEngine } from "./temporalPhysics";
import type { TemporalBody, TemporalEvent, TemporalHistoryFrame, TemporalHistoryNode } from "./types";

export interface TemporalPhysicsOptions {
  tasks?: Task[];
  enabled?: boolean;
}

export interface TemporalPhysicsState {
  engine: TemporalPhysicsEngine;
  bodies: Map<string, TemporalBody>;
  emitTemporalEvent: (event: TemporalEvent) => void;
  recordHistoryFrame: (nodes: TemporalHistoryNode[]) => void;
  history: TemporalHistoryFrame[];
  rewindFrame: TemporalHistoryFrame | null;
  rewindTo: (frameIndex: number | null) => void;
}

export const useTemporalPhysics = (options?: TemporalPhysicsOptions): TemporalPhysicsState => {
  const { tasks, enabled = true } = options ?? {};
  const engine = useMemo(() => getTemporalEngine(), []);
  const [bodies, setBodies] = useState<Map<string, TemporalBody>>(engine.getSnapshot().bodies);
  const [history, setHistory] = useState<TemporalHistoryFrame[]>(engine.getHistoryFrames());
  const [rewindFrame, setRewindFrame] = useState<TemporalHistoryFrame | null>(null);

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
      setHistory(engine.getHistoryFrames());
    });
    return () => {
      unsubscribe();
    };
  }, [engine, enabled]);

  const emitTemporalEvent = (event: TemporalEvent) => {
    engine.emit(event);
  };

  const recordHistoryFrame = useCallback(
    (nodes: TemporalHistoryNode[]) => {
      engine.recordHistoryFrame(nodes);
      setHistory(engine.getHistoryFrames());
    },
    [engine]
  );

  const rewindTo = useCallback(
    (frameIndex: number | null) => {
      if (frameIndex === null) {
        setRewindFrame(null);
        return;
      }
      const frame = engine.rewindTo(frameIndex);
      setRewindFrame(frame);
    },
    [engine]
  );

  return { engine, bodies, emitTemporalEvent, recordHistoryFrame, history, rewindFrame, rewindTo };
};
