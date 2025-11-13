import type { CelestialKind } from "../../types/celestial";

export type CosmicEventId = "meteor_shower" | "solar_flare" | "nebula_cloud" | "gravitational_anomaly";

export interface CosmicEventDefinition {
  id: CosmicEventId;
  label: string;
  message: string;
  durationMs: number;
  cooldownMs: number;
  rarity: number;
  shouldTrigger(metrics: CosmicEventMetrics): boolean;
  onApply(context: CosmicEventContext): void;
  onCleanup(context: CosmicEventContext): void;
  heatMultiplier?: number;
}

export interface CosmicEventMetrics {
  avgHeat: number;
  avgEntropy: number;
  tetherCount: number;
  constellationCount: number;
}

export interface CosmicEventContext {
  setCssVar(name: string, value: string | null): void;
  boostKind(kind: CelestialKind, heatDelta: number, momentumDelta: number): void;
  wobbleOrbit(multiplier: number): void;
}

export interface ActiveCosmicEvent {
  id: CosmicEventId;
  label: string;
  message: string;
  startedAt: number;
  endsAt: number;
}
