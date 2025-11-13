import { ObserverMachine } from "./observerMachine";
import type { ObserverEvent, Insight, TaskSignal } from "./types";

export class ObserverEngine {
  private machine: ObserverMachine;

  constructor() {
    this.machine = new ObserverMachine();
  }

  ingest(event: ObserverEvent): void {
    this.machine.ingest(event);
  }

  getSignals(): Map<string, TaskSignal> {
    return this.machine.getSignals() as Map<string, TaskSignal>;
  }

  getInsights(): Insight[] {
    return this.machine.getInsights();
  }
}

export type { ObserverEvent, Insight, TaskSignal } from "./types";
