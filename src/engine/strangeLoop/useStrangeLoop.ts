import { useCallback, useEffect, useMemo, useState } from "react";
import type { ObserverEngineCore } from "../observer/observerEngine";
import { generateStrangeLoopQuestion } from "./strangeLoopEngine";
import type { StrangeLoopQuestion } from "./types";

interface UseStrangeLoopOptions {
  engine: ObserverEngineCore | null;
  enabled?: boolean;
}

interface UseStrangeLoopResult {
  question: StrangeLoopQuestion | null;
  refresh: () => void;
}

export const useStrangeLoop = ({ engine, enabled = true }: UseStrangeLoopOptions): UseStrangeLoopResult => {
  const [question, setQuestion] = useState<StrangeLoopQuestion | null>(null);
  const timerRef = useMemo<{ current: number | null }>(() => ({ current: null }), []);

  const scheduleNext = useCallback(() => {
    if (!enabled || !engine) return;
    if (timerRef.current && typeof window !== "undefined") {
      window.clearTimeout(timerRef.current);
    }
    if (typeof window === "undefined") return;
    const delay = 30000 + Math.random() * 15000;
    timerRef.current = window.setTimeout(() => {
      const snapshot = engine.getSnapshot();
      const nextQuestion = generateStrangeLoopQuestion(snapshot);
      if (nextQuestion) {
        setQuestion(nextQuestion);
      }
      scheduleNext();
    }, delay);
  }, [enabled, engine, timerRef]);

  useEffect(() => {
    if (!enabled || !engine) return undefined;
    scheduleNext();
    return () => {
      if (timerRef.current && typeof window !== "undefined") {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = null;
    };
  }, [engine, enabled, scheduleNext, timerRef]);

  const refresh = useCallback(() => {
    if (!engine) return;
    const snapshot = engine.getSnapshot();
    const nextQuestion = generateStrangeLoopQuestion(snapshot);
    if (nextQuestion) {
      setQuestion(nextQuestion);
    }
    scheduleNext();
  }, [engine, scheduleNext]);

  return { question, refresh };
};
