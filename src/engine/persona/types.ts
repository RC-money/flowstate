import type { ObserverInsight } from "../observer/types";

export type PersonaId = "mentor" | "hunter" | "archivist";

export interface PersonaResponse {
  persona: PersonaId;
  color: string;
  tone: "calm" | "sharp" | "gentle";
  message: string;
  insightId?: string;
  createdAt: number;
}

export interface PersonaContext {
  insights: ObserverInsight[];
}

export interface Persona {
  id: PersonaId;
  name: string;
  color: string;
  tone: PersonaResponse["tone"];
  speak(insight: ObserverInsight | null, context: PersonaContext): PersonaResponse | null;
}
