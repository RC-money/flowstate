import React, { useState } from "react";
import type { Constellation } from "../types/celestial";

interface ConstellationRosterProps {
  constellations: Constellation[];
  onRename(constellationId: string, name: string): void;
}

/**
 * Constellations are projects the galaxy discovered rather than folders the
 * user declared: tether tasks together and a cluster of three or more becomes
 * one. This roster is where a discovery gets a real name.
 */
const ConstellationRoster: React.FC<ConstellationRosterProps> = ({ constellations, onRename }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  if (!constellations.length) return null;

  const commit = (id: string) => {
    onRename(id, draft);
    setEditingId(null);
    setDraft("");
  };

  return (
    <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5 text-white">
      <p className="text-xs uppercase tracking-[0.4em] text-white/60">Constellations</p>
      <p className="mt-1 text-sm text-white/60">
        Clusters the galaxy found on its own. Name the ones that matter.
      </p>
      <ul className="mt-4 space-y-3">
        {constellations.map((constellation) => {
          const label = constellation.name ?? constellation.suggestedName;
          const isEditing = editingId === constellation.id;
          return (
            <li
              key={constellation.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
            >
              {isEditing ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") commit(constellation.id);
                    if (event.key === "Escape") setEditingId(null);
                  }}
                  onBlur={() => commit(constellation.id)}
                  placeholder={constellation.suggestedName}
                  aria-label="Constellation name"
                  className="min-w-0 flex-1 rounded-lg border border-white/20 bg-black/40 px-2 py-1 text-sm text-white focus:border-cyan-400 focus:outline-none"
                />
              ) : (
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {label}
                    {!constellation.name ? (
                      <span className="ml-2 text-[10px] uppercase tracking-wide text-white/40">
                        suggested
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-white/50">
                    {constellation.memberIds.length} bodies · {constellation.kind}
                  </p>
                </div>
              )}
              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(constellation.id);
                    setDraft(constellation.name ?? "");
                  }}
                  className="rounded-lg border border-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/70 transition hover:border-white/40 hover:text-white"
                >
                  {constellation.name ? "Rename" : "Name it"}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default ConstellationRoster;
