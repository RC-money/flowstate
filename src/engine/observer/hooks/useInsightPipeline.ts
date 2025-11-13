import { useEffect, useMemo, useState } from "react";
import { getObserverEngine } from "../observerEngine";
import type { ObserverInsight } from "../types";

export interface InsightPipelineOptions {
  kinds?: ObserverInsight["kind"][];
  minConfidence?: number;
  limit?: number;
}

export const useInsightPipeline = (options?: InsightPipelineOptions): ObserverInsight[] => {
  const engine = useMemo(() => getObserverEngine(), []);
  const [insights, setInsights] = useState<ObserverInsight[]>(() => engine.getSnapshot().insights);
  const kindsKey = (options?.kinds ?? []).join(",");
  const minConfidence = options?.minConfidence ?? 0;
  const limit = options?.limit ?? 12;

  useEffect(() => {
    engine.start();
    return engine.subscribeInsights((next) => {
      const filtered = next.filter((insight) => {
        const kindMatches = options?.kinds?.length ? options.kinds.includes(insight.kind) : true;
        return kindMatches && insight.confidence >= minConfidence;
      });
      setInsights(filtered.slice(0, limit));
    });
  }, [engine, kindsKey, minConfidence, limit, options?.kinds]);

  return insights;
};
