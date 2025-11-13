import { reduceEvent } from "./observerReducers";
import { driftPipeline } from "./pipelines/driftPipeline";
import { entropyPipeline } from "./pipelines/entropyPipeline";
import { momentumPipeline } from "./pipelines/momentumPipeline";
import { overburdenPipeline } from "./pipelines/overburdenPipeline";
import { darkForestPipeline } from "./pipelines/darkForestPipeline";
import type { Insight, ObserverConfig, ObserverEvent, ObserverState, TaskSignal } from "./types";

const DEFAULT_CONFIG: ObserverConfig = {
  maxInsights: 40,
  entropyDecay: 0.01,
  heatDecay: 0.008,
  momentumDecay: 0.006,
};

export class ObserverMachine {
  private state: ObserverState;

  constructor(initial?: Partial<ObserverState>) {
    this.state = {
      signals: initial?.signals ?? new Map(),
      insights: initial?.insights ?? [],
      config: { ...DEFAULT_CONFIG, ...(initial?.config ?? {}) },
    };
  }

  ingest(event: ObserverEvent): void {
    this.state = reduceEvent(this.state, event);
    this.runPipelines(event);
  }

  getSignals(): Map<string, TaskSignal> {
    return new Map(
      Array.from(this.state.signals.entries()).map(([id, signal]) => [id, { ...signal }])
    );
  }

  getInsights(): Insight[] {
    return this.state.insights.slice();
  }

  private runPipelines(event: ObserverEvent): void {
    if (!event || !event.type) return;
    const pipelines = [
      entropyPipeline(this.state),
      momentumPipeline(this.state),
      driftPipeline(this.state),
      overburdenPipeline(this.state),
      darkForestPipeline(this.state),
    ];
    const merged = pipelines.flat();
    if (!merged.length) return;
    const next = [...merged, ...this.state.insights]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, this.state.config.maxInsights);
    this.state = { ...this.state, insights: next };
  }
}
