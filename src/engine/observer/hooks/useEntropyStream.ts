import { useEffect, useMemo, useState } from "react";
import { getObserverEngine } from "../observerEngine";
import type { EntropySample } from "../types";

export const useEntropyStream = (taskId: string | null | undefined): EntropySample | null => {
  const engine = useMemo(() => getObserverEngine(), []);
  const [sample, setSample] = useState<EntropySample | null>(() =>
    taskId ? engine.getEntropySample(taskId) : null
  );

  useEffect(() => {
    if (!taskId) return undefined;
    engine.start();
    return engine.subscribeEntropy(taskId, (next) => setSample(next));
  }, [engine, taskId]);

  return sample;
};
