import { BIOME_REGISTRY } from "./biomeRegistry";
import type { BiomeMetrics, BiomeSeason, BiomeTokens, BiomeId, UserIntent } from "./types";

const INTENT_TO_BIOME: Record<UserIntent, BiomeId> = {
  progress: "hunter",
  clarity: "mentor",
  lost: "archivist",
  overwhelm: "archivist",
  nebula: "nebula",
  supernova: "supernova",
  aurora: "aurora",
  void: "void",
  pulsar: "pulsar",
};

const getSeason = (timestamp: number): BiomeSeason => {
  const hour = new Date(timestamp).getHours();
  if (hour >= 5 && hour < 10) return "dawn";
  if (hour >= 10 && hour < 17) return "day";
  if (hour >= 17 && hour < 21) return "dusk";
  return "night";
};

export interface ComputeBiomeInput {
  intent: UserIntent;
  metrics: BiomeMetrics;
  timestamp?: number;
}

export class BiomeManager {
  compute(input: ComputeBiomeInput): BiomeTokens {
    const timestamp = input.timestamp ?? Date.now();
    const season = getSeason(timestamp);
    const biomeId = this.resolveBiomeId(input.intent);
    const base = BIOME_REGISTRY[biomeId];
    const particleSpeed = this.computeParticleSpeed(base, input.metrics, season);
    const particleDensity = base.ambientParticles.density * (1 + (input.metrics.avgHeat - 0.5) * 0.2);
    const trailStrength = base.heatSensitivity * (0.8 + input.metrics.avgHeat * 0.4);
    const labelVisibility =
      biomeId === "mentor" || input.metrics.avgEntropy > 0.75 ? "all" : biomeId === "archivist" ? "focus" : "hidden";

    return {
      ...base,
      season,
      particleSpeed,
      particleDensity,
      trailStrength,
      labelVisibility,
      overlay: this.computeOverlayColor(base, season),
    };
  }

  private resolveBiomeId(intent: UserIntent): BiomeId {
    // The picker's choice is law. Metrics used to hijack the palette (high
    // entropy forced archivist, high heat forced hunter), which made the
    // Colors setting a suggestion rather than a setting.
    return INTENT_TO_BIOME[intent] ?? "mentor";
  }

  private computeParticleSpeed(base: typeof BIOME_REGISTRY[BiomeId], metrics: BiomeMetrics, season: BiomeSeason): number {
    const seasonFactor = season === "night" ? 0.85 : season === "dawn" ? 1 : season === "dusk" ? 0.95 : 1.05;
    return base.ambientParticles.speed * seasonFactor * (0.9 + metrics.avgHeat * 0.3);
  }

  private computeOverlayColor(base: typeof BIOME_REGISTRY[BiomeId], season: BiomeSeason): string {
    if (season === "night") {
      return `${base.accent}33`;
    }
    if (season === "dawn") {
      return "rgba(254,215,170,0.18)";
    }
    if (season === "dusk") {
      return "rgba(147,197,253,0.2)";
    }
    return `${base.accent}29`;
  }
}
