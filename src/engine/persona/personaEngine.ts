import type { ObserverInsight } from "../observer/types";
import type { Persona, PersonaContext, PersonaResponse } from "./types";

const pickInsight = (insights: ObserverInsight[], filter?: (insight: ObserverInsight) => boolean) => {
  const pool = filter ? insights.filter(filter) : insights;
  if (!pool.length) return null;
  return pool[0];
};

const MentorPersona: Persona = {
  id: "mentor",
  name: "Mentor",
  color: "#60A5FA",
  tone: "calm",
  speak(insight, context) {
    const focus = insight ?? pickInsight(context.insights);
    if (!focus) return null;
    return {
      persona: "mentor",
      color: this.color,
      tone: this.tone,
      message: focus.kind === "entropy-spike"
        ? "Ease the storm—name one next move and breathe."
        : "Stay steady. Choose the next step you can finish today.",
      insightId: focus.id,
      createdAt: Date.now(),
    };
  },
};

const HunterPersona: Persona = {
  id: "hunter",
  name: "Hunter",
  color: "#FB923C",
  tone: "sharp",
  speak(insight, context) {
    const focus =
      insight ??
      pickInsight(context.insights, (candidate) =>
        ["drift", "heat-neglect"].includes(candidate.kind)
      );
    if (!focus) return null;
    return {
      persona: "hunter",
      color: this.color,
      tone: this.tone,
      message:
        focus.kind === "heat-neglect"
          ? "That sun’s flaring. Hit it now before it scorches everything."
          : "Chase the drifting one before it escapes.",
      insightId: focus.id,
      createdAt: Date.now(),
    };
  },
};

const ArchivistPersona: Persona = {
  id: "archivist",
  name: "Archivist",
  color: "#6366F1",
  tone: "gentle",
  speak(insight, context) {
    const focus =
      insight ?? pickInsight(context.insights, (candidate) => candidate.kind === "entropy-spike");
    if (!focus) {
      return {
        persona: "archivist",
        color: this.color,
        tone: this.tone,
        message: "Let something rest in the Dark Forest so the living can breathe.",
        createdAt: Date.now(),
      };
    }
    return {
      persona: "archivist",
      color: this.color,
      tone: this.tone,
      message: "Gently retire the tasks you’ve outgrown. No guilt, just compost.",
      insightId: focus.id,
      createdAt: Date.now(),
    };
  },
};

const PERSONAS: Persona[] = [MentorPersona, HunterPersona, ArchivistPersona];

export const getPersonaVoice = (context: PersonaContext): PersonaResponse[] => {
  const responses: PersonaResponse[] = [];
  PERSONAS.forEach((persona) => {
    const primaryInsight = context.insights.find((insight) => !responses.some((resp) => resp.insightId === insight.id));
    const response = persona.speak(primaryInsight ?? null, context);
    if (response) {
      responses.push(response);
    }
  });
  return responses;
};
