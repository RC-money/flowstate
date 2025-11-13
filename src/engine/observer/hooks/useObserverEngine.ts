import { useEffect, useMemo, useRef, useState } from "react";
import type { Task } from "../../../hooks/useLocalTasks";
import { getObserverEngine, ObserverEngineCore } from "../observerEngine";
import type { ObserverEvent, ObserverInsight } from "../types";

export interface UseObserverEngineOptions {
  tasks?: Task[];
  enabled?: boolean;
}

export interface UseObserverEngineResult {
  engine: ObserverEngineCore;
  insights: ObserverInsight[];
  emitEvent: (event: ObserverEvent) => void;
}

export const useObserverEngine = (options?: UseObserverEngineOptions): UseObserverEngineResult => {
  const { tasks, enabled = true } = options ?? {};
  const engine = useMemo(() => getObserverEngine(), []);
  const [insights, setInsights] = useState<ObserverInsight[]>(() => engine.getSnapshot().insights);
  const tasksRef = useRef<Task[] | null>(null);

  useEffect(() => {
    if (tasks && tasks !== tasksRef.current) {
      engine.syncTasks(tasks);
      tasksRef.current = tasks;
    }
  }, [engine, tasks]);

  useEffect(() => {
    if (!enabled) return undefined;
    engine.start();
    return () => {
      engine.stop();
    };
  }, [engine, enabled]);

  useEffect(() => engine.subscribeInsights(setInsights), [engine]);

  const emitEvent = (event: ObserverEvent) => {
    engine.ingestEvent(event);
  };

  return { engine, insights, emitEvent };
};
