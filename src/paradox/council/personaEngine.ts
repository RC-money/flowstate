export type PersonaId =
  | "mentor"
  | "hunter"
  | "cartographer"
  | "archivist"
  | "wormhole"
  | "shaper"
  | "jester";

export interface Persona {
  id: PersonaId;
  name: string;
  iconKey: string;
  color: string;
  tone: "calm" | "sharp" | "analytical" | "gentle" | "chaotic" | "mystic";
  rationale: string;
  questionTemplates: string[];
}

export const PERSONA_ROSTER: Record<PersonaId, Omit<Persona, "rationale" | "questionTemplates">> = {
  mentor: { id: "mentor", name: "The Mentor", iconKey: "compass", color: "#60A5FA", tone: "calm" },
  hunter: { id: "hunter", name: "The Hunter", iconKey: "flare", color: "#FB923C", tone: "sharp" },
  cartographer: { id: "cartographer", name: "The Cartographer", iconKey: "map", color: "#A855F7", tone: "analytical" },
  archivist: { id: "archivist", name: "The Archivist", iconKey: "moon", color: "#6366F1", tone: "gentle" },
  wormhole: { id: "wormhole", name: "The Wormhole", iconKey: "wormhole", color: "#EC4899", tone: "chaotic" },
  shaper: { id: "shaper", name: "The Shaper", iconKey: "nebula", color: "#14B8A6", tone: "mystic" },
  jester: { id: "jester", name: "The Jester", iconKey: "jester", color: "#EAB308", tone: "chaotic" },
};

export interface PersonaInput {
  avgHeat: number;
  avgEntropy: number;
  darkForestCount: number;
  recentInsights: Array<{ kind: string; taskIds?: string[] }>;
  timeOfDay: "dawn" | "day" | "dusk" | "night";
  userIntent: "progress" | "clarity" | "lost" | "overwhelm";
}

const PERSONA_RULES: Array<(input: PersonaInput) => Persona | null> = [
  (input) => {
    if (input.avgEntropy > 0.78) {
      return {
        ...PERSONA_ROSTER.jester,
        rationale: "Entropy is suffocating the galaxy—shock therapy required.",
        questionTemplates: ["Is this really your universe’s center? Prove it."],
      };
    }
    return null;
  },
  (input) => {
    if (input.darkForestCount > 4 || input.userIntent === "overwhelm") {
      return {
        ...PERSONA_ROSTER.archivist,
        rationale: "Dark Forest is swelling—time to let go with grace.",
        questionTemplates: ["What deserves to rest in the Dark Forest tonight?"],
      };
    }
    return null;
  },
  (input) => {
    if (input.avgHeat > 0.6 && input.userIntent === "progress") {
      return {
        ...PERSONA_ROSTER.hunter,
        rationale: "Heat spikes detected—strike while suns are blazing.",
        questionTemplates: ["Which burning sun will you finish before it cools?"],
      };
    }
    return null;
  },
  (input) => {
    if (input.avgEntropy < 0.4 && input.avgHeat < 0.45 && input.timeOfDay === "dawn") {
      return {
        ...PERSONA_ROSTER.mentor,
        rationale: "The galaxy is quiet—perfect moment for clarity and compassion.",
        questionTemplates: ["What rhythm keeps you steady this morning?"],
      };
    }
    return null;
  },
  (input) => {
    if (input.recentInsights.some((insight) => insight.kind === "drift")) {
      return {
        ...PERSONA_ROSTER.cartographer,
        rationale: "Orbit drift detected—re-map the constellations.",
        questionTemplates: ["A new orbit is forming. How will you chart it?"],
      };
    }
    return null;
  },
  (input) => {
    if (input.userIntent === "clarity") {
      return {
        ...PERSONA_ROSTER.shaper,
        rationale: "You’re crafting new matter—let the Shaper guide the ritual.",
        questionTemplates: ["What form does this Nebula want to take? Sun or Moon?"],
      };
    }
    return null;
  },
  () => ({
    ...PERSONA_ROSTER.wormhole,
    rationale: "Default fallback: twist the view to find a shortcut.",
    questionTemplates: ["What if this task was solved somewhere else already?"],
  }),
];

export const resolvePersona = (input: PersonaInput): Persona => {
  for (const rule of PERSONA_RULES) {
    const persona = rule(input);
    if (persona) return persona;
  }
  return PERSONA_RULES[PERSONA_RULES.length - 1](input)!;
};
