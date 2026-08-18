import { useMemo } from "react";
import { resolvePersona, type Persona, type PersonaInput } from "./personaEngine";

export const usePersona = (input: PersonaInput): Persona => {
  // recentInsights arrives as a freshly-mapped array on every render of App, so
  // depending on its identity re-ran this on every render. Only the insight
  // kinds are actually read by the persona rules, so a joined signature is both
  // stable and sufficient.
  const insightKey = input.recentInsights.map((insight) => insight.kind).join("|");

  // resolvePersona is pure, so this derives during render instead of scheduling
  // a second pass through an effect.
  return useMemo(
    () => resolvePersona(input),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      input.avgHeat,
      input.avgEntropy,
      input.darkForestCount,
      input.userIntent,
      input.timeOfDay,
      insightKey,
    ]
  );
};

export type { Persona } from "./personaEngine";
