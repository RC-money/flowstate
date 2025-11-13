import React from "react";
import type { Persona } from "../paradox/council";

interface PersonaPanelProps {
  persona: Persona;
}

const PersonaPanel: React.FC<PersonaPanelProps> = ({ persona }) => (
  <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4 text-white shadow-lg shadow-black/40">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full text-xl font-bold"
          style={{ background: `${persona.color}22`, color: persona.color }}
        >
          {persona.iconKey.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-white/60">
            Active Persona
          </p>
          <p className="text-lg font-semibold">{persona.name}</p>
        </div>
      </div>
      <span className="text-xs uppercase tracking-[0.4em] text-white/50">{persona.tone}</span>
    </div>
    <p className="mt-3 text-sm text-white/80">{persona.rationale}</p>
    <p className="mt-4 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm">
      {persona.questionTemplates[0]}
    </p>
  </div>
);

export default PersonaPanel;
