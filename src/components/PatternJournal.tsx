import React, { useMemo, useState } from "react";
import type { ReflectionEntry } from "../hooks/useReflectionJournal";
import type { Constellation } from "../types/celestial";
import type { Persona } from "../paradox/council";

interface PatternJournalProps {
  reflections: ReflectionEntry[];
  personas: Persona[];
  constellations: Constellation[];
}

const PatternJournal: React.FC<PatternJournalProps> = ({ reflections, personas, constellations }) => {
  const [personaFilter, setPersonaFilter] = useState<string>("all");
  const [constellationFilter, setConstellationFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return reflections.filter((entry) => {
      if (personaFilter !== "all" && entry.personaId !== personaFilter) return false;
      if (
        constellationFilter !== "all" &&
        !entry.constellationIds?.includes(constellationFilter)
      ) {
        return false;
      }
      return true;
    });
  }, [reflections, personaFilter, constellationFilter]);

  const personaOptions = useMemo(
    () => personas.map((persona) => ({ value: persona.id, label: persona.name })),
    [personas]
  );
  const constellationOptions = useMemo(
    () =>
      constellations.map((constellation) => ({
        value: constellation.id,
        label: constellation.name ?? constellation.suggestedName,
      })),
    [constellations]
  );

  return (
    <section className="mt-6 rounded-3xl border border-white/10 bg-[#050a18]/80 p-5 text-white shadow-inner shadow-black/40">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-white/60">Pattern Journal</p>
          <p className="text-lg font-semibold">Reflections & Strange Loop replies</p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-white/70">
          <select
            value={personaFilter}
            onChange={(event) => setPersonaFilter(event.target.value)}
            className="rounded-full border border-white/20 bg-black/30 px-3 py-1 uppercase tracking-[0.3em]"
          >
            <option value="all">All Personas</option>
            {personaOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={constellationFilter}
            onChange={(event) => setConstellationFilter(event.target.value)}
            className="rounded-full border border-white/20 bg-black/30 px-3 py-1 uppercase tracking-[0.3em]"
          >
            <option value="all">All Constellations</option>
            {constellationOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </header>
      <div className="mt-4 space-y-4">
        {filtered.length === 0 ? (
          <p className="text-sm text-white/60">No reflections in this filter.</p>
        ) : (
          filtered.map((entry) => (
            <div
              key={entry.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm"
            >
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-white/50">
                <span>{entry.personaId}</span>
                <span>{new Date(entry.createdAt).toLocaleString()}</span>
              </div>
              <p className="mt-2 text-white/80">{entry.question}</p>
              <p className="mt-2 rounded-xl border border-white/10 bg-black/30 p-3 text-white">
                {entry.response || "No response recorded."}
              </p>
              {entry.constellationIds?.length ? (
                <p className="mt-1 text-xs text-white/50">
                  Constellations:{" "}
                  {entry.constellationIds
                    .map(
                      (id) =>
                        constellations.find((constellation) => constellation.id === id)?.name ??
                        id
                    )
                    .join(", ")}
                </p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
};

export default PatternJournal;
