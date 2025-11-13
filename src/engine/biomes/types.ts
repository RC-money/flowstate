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
