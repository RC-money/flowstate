import { getTemporalEngine } from "../temporal";
import type {
  ActiveCosmicEvent,
  CosmicEventContext,
  CosmicEventDefinition,
  CosmicEventId,
  CosmicEventMetrics,
} from "./types";

const css = (name: string, value: string | null) => {
  if (typeof document === "undefined") return;
  if (value === null) {
    document.documentElement.style.removeProperty(name);
  } else {
    document.documentElement.style.setProperty(name, value);
  }
};


const TEMPORAL_CONTEXT: CosmicEventContext = {
  setCssVar: css,
  boostKind: (kind, heat, momentum) => {
    const engine = getTemporalEngine();
    engine.boostKind(kind, heat, momentum);
  },
  wobbleOrbit(multiplier: number) {
    css("--galaxy-wobble", multiplier.toString());
  },
};

const EVENT_REGISTRY: CosmicEventDefinition[] = [
  {
    id: "meteor_shower",
    label: "Meteor Shower",
    message: "Captain… the sky is falling. Perfect time to hunt.",
    durationMs: 90_000,
    cooldownMs: 15 * 60 * 1000,
    rarity: 0.6,
    shouldTrigger: (metrics) => metrics.avgHeat < 0.55,
    onApply(context) {
      context.setCssVar("--meteor-particle-speed", "1.35");
      context.boostKind("asteroid", 0.35, 0.12);
    },
    onCleanup(context) {
      context.setCssVar("--meteor-particle-speed", null);
    },
  },
  {
    id: "solar_flare",
    label: "Solar Flare",
    message: "Solar winds ignite every sun. Brace for turbulence.",
    durationMs: 75_000,
    cooldownMs: 20 * 60 * 1000,
    rarity: 0.4,
    shouldTrigger: (metrics) => metrics.avgHeat < 0.4 && metrics.avgEntropy > 0.5,
    onApply(context) {
      context.boostKind("sun", 0.4, 0.15);
      context.setCssVar("--biome-overlay", "rgba(251,146,60,0.2)");
    },
    onCleanup(context) {
      context.setCssVar("--biome-overlay", null);
    },
  },
  {
    id: "nebula_cloud",
    label: "Nebula Cloud",
    message: "A nebula drifts in—visibility low, intuition high.",
    durationMs: 120_000,
    cooldownMs: 25 * 60 * 1000,
    rarity: 0.3,
    shouldTrigger: (metrics) => metrics.tetherCount > 3,
    onApply(context) {
      context.setCssVar("--nebula-depth", "1");
      context.wobbleOrbit(1.2);
    },
    onCleanup(context) {
      context.setCssVar("--nebula-depth", null);
      context.wobbleOrbit(1);
    },
  },
  {
    id: "gravitational_anomaly",
    label: "Gravitational Anomaly",
    message: "Gravity bends. Constellations rearrange themselves.",
    durationMs: 60_000,
    cooldownMs: 18 * 60 * 1000,
    rarity: 0.2,
    shouldTrigger: (metrics) => metrics.constellationCount >= 2,
    onApply(context) {
      context.setCssVar("--grav-anomaly", "1");
      context.boostKind("gas-giant", 0.2, 0.15);
    },
    onCleanup(context) {
      context.setCssVar("--grav-anomaly", null);
    },
  },
];

export class CosmicEventsEngine {
  private currentEvent: ActiveCosmicEvent | null = null;
  private lastTriggered = new Map<CosmicEventId, number>();

  tick(metrics: CosmicEventMetrics): ActiveCosmicEvent | null {
    this.maybeCleanup();
    if (this.currentEvent) {
      return this.currentEvent;
    }
    const eligible = EVENT_REGISTRY.filter(
      (definition) =>
        definition.shouldTrigger(metrics) &&
        Date.now() - (this.lastTriggered.get(definition.id) ?? 0) > definition.cooldownMs
    );
    if (!eligible.length) return null;
    const totalWeight = eligible.reduce((sum, def) => sum + def.rarity, 0);
    const roll = Math.random() * totalWeight;
    let accumulator = 0;
    for (const definition of eligible) {
      accumulator += definition.rarity;
      if (roll <= accumulator) {
        this.startEvent(definition);
        break;
      }
    }
    return this.currentEvent;
  }

  getActiveEvent(): ActiveCosmicEvent | null {
    this.maybeCleanup();
    return this.currentEvent;
  }

  private startEvent(definition: CosmicEventDefinition) {
    const startedAt = Date.now();
    const endsAt = startedAt + definition.durationMs;
    definition.onApply(TEMPORAL_CONTEXT);
    this.currentEvent = {
      id: definition.id,
      label: definition.label,
      message: definition.message,
      startedAt,
      endsAt,
    };
    this.lastTriggered.set(definition.id, startedAt);
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        this.endEvent(definition);
      }, definition.durationMs);
    }
  }

  private endEvent(definition: CosmicEventDefinition) {
    definition.onCleanup(TEMPORAL_CONTEXT);
    this.currentEvent = null;
  }

  private maybeCleanup() {
    if (!this.currentEvent) return;
    if (Date.now() >= this.currentEvent.endsAt) {
      const definition = EVENT_REGISTRY.find((evt) => evt.id === this.currentEvent?.id);
      if (definition) {
        this.endEvent(definition);
      } else {
        this.currentEvent = null;
      }
    }
  }
}
