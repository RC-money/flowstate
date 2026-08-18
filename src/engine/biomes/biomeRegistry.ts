import type { BiomeParameters } from "./types";

export const BIOME_REGISTRY: Record<string, BiomeParameters> = {
  hunter: {
    id: "hunter",
    label: "I want to make progress",
    description: "High heat, decisive strikes, visible trails.",
    background: "radial-gradient(1100px 620px at 22% -6%, rgba(251,146,60,0.14), transparent 62%), radial-gradient(900px 560px at 88% 8%, rgba(124,58,18,0.10), transparent 60%), linear-gradient(180deg, #07080f 0%, #05070f 100%)",
    ambientParticles: { speed: 1.3, density: 1.2 },
    heatSensitivity: 0.85,
    clusterThreshold: 0.45,
    accent: "#FB923C",
  },
  mentor: {
    id: "mentor",
    label: "I need clarity",
    description: "Calm blue hues, slower motion, focus on order.",
    background: "radial-gradient(1100px 620px at 22% -6%, rgba(91,92,240,0.18), transparent 62%), radial-gradient(900px 560px at 88% 8%, rgba(71,163,243,0.10), transparent 60%), linear-gradient(180deg, #090a19 0%, #05070f 100%)",
    ambientParticles: { speed: 0.7, density: 0.9 },
    heatSensitivity: 0.6,
    clusterThreshold: 0.65,
    accent: "#60A5FA",
  },
  archivist: {
    id: "archivist",
    label: "I’m overwhelmed",
    description: "Soft indigo glow, gentle drift, Dark Forest comfort.",
    background: "radial-gradient(1100px 620px at 22% -6%, rgba(99,102,241,0.16), transparent 62%), radial-gradient(700px 500px at 50% 108%, rgba(124,131,255,0.10), transparent 65%), linear-gradient(180deg, #08091a 0%, #05070f 100%)",
    ambientParticles: { speed: 0.45, density: 0.7 },
    heatSensitivity: 0.4,
    clusterThreshold: 0.8,
    accent: "#6366F1",
  },
};
