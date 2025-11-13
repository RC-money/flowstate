export type BiomeId = "hunter" | "mentor" | "archivist";

export interface BiomeParameters {
  id: BiomeId;
  label: string;
  description: string;
  background: string;
  ambientParticles: {
    speed: number;
    density: number;
  };
  heatSensitivity: number;
  clusterThreshold: number;
  accent: string;
}

export type UserIntent = "progress" | "clarity" | "lost" | "overwhelm";

export interface BiomeMetrics {
  avgHeat: number;
  avgEntropy: number;
  intensity?: number;
}

export type BiomeSeason = "dawn" | "day" | "dusk" | "night";

export interface BiomeTokens extends BiomeParameters {
  season: BiomeSeason;
  particleSpeed: number;
  particleDensity: number;
  trailStrength: number;
  labelVisibility: "hidden" | "focus" | "all";
  overlay: string;
}
