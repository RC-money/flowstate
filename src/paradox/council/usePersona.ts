import { useEffect, useState } from "react";
import { resolvePersona, type Persona, type PersonaInput } from "./personaEngine";

export const usePersona = (input: PersonaInput): Persona => {
  const [persona, setPersona] = useState<Persona>(() => resolvePersona(input));
  useEffect(() => {
    setPersona(resolvePersona(input));
  }, [input.avgHeat, input.avgEntropy, input.darkForestCount, input.userIntent, input.timeOfDay, input.recentInsights]);
  return persona;
};

export type { Persona } from "./personaEngine";
