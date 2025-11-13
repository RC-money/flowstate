import type { BiomeParameters } from "./types";

export const BIOME_REGISTRY: Record<string, BiomeParameters> = {
  hunter: {
    id: "hunter",
    label: "I want to make progress",
    description: "High heat, decisive strikes, visible trails.",
    background: "linear-gradient(120deg, #0f172a 0%, #7c2d12 80%)",
    ambientParticles: { speed: 1.3, density: 1.2 },
    heatSensitivity: 0.85,
    clusterThreshold: 0.45,
    accent: "#FB923C",
  },
  mentor: {
    id: "mentor",
    label: "I need clarity",
    description: "Calm blue hues, slower motion, focus on order.",
    background: "linear-gradient(140deg, #0b1120 0%, #1e3a8a 70%)",
    ambientParticles: { speed: 0.7, density: 0.9 },
    heatSensitivity: 0.6,
    clusterThreshold: 0.65,
    accent: "#60A5FA",
  },
  archivist: {
    id: "archivist",
    label: "I’m overwhelmed",
    description: "Soft indigo glow, gentle drift, Dark Forest comfort.",
    background: "linear-gradient(150deg, #0a0c1a 0%, #312e81 75%)",
    ambientParticles: { speed: 0.45, density: 0.7 },
    heatSensitivity: 0.4,
    clusterThreshold: 0.8,
    accent: "#6366F1",
  },
};
