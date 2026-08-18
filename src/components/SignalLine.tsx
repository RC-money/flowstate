import React from "react";
import type { Persona } from "../paradox/council";

interface SignalLineProps {
  persona: Persona;
  event: { label: string; message: string } | null;
  onOpenObservatory?: () => void;
}

/**
 * The persona and cosmic-event panels used 262px across two blocks before the
 * board came into view. Ambient state deserves a line, not a section -- this is
 * the whole of it, and the detail lives in the Observatory.
 */
const SignalLine: React.FC<SignalLineProps> = ({ persona, event, onOpenObservatory }) => (
  <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
    <span
      className="inline-flex h-5 w-5 flex-none items-center justify-center rounded-full text-[10px] font-bold"
      style={{ background: `${persona.color}22`, color: persona.color }}
      aria-hidden="true"
    >
      {persona.iconKey.slice(0, 1).toUpperCase()}
    </span>

    <button
      type="button"
      onClick={onOpenObservatory}
      className="text-left text-white/85 transition hover:text-white"
    >
      <span className="font-medium">{persona.name}</span>
      <span className="mx-2 text-white/25" aria-hidden="true">
        ·
      </span>
      <span className="text-white/65">{persona.questionTemplates[0]}</span>
    </button>

    {event ? (
      <span className="inline-flex items-center gap-2 rounded-full border border-amber-200/35 bg-amber-400/10 px-3 py-0.5 text-xs text-amber-100">
        <span className="inline-block h-1.5 w-1.5 flex-none rounded-full bg-amber-300" aria-hidden="true" />
        {event.label}
      </span>
    ) : null}
  </div>
);

export default SignalLine;
