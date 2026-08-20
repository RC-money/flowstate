import { useEffect, useRef, useState } from "react";
import type { Cluster } from "../lib/clusters/clusters";

interface ClusterSwitcherProps {
  clusters: Cluster[];
  activeId: string | null;
  /** Open tasks per cluster id, for the count on each pill. */
  counts: Record<string, number>;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  /** Whether the active cluster has earned its ending. */
  canEther: boolean;
  onEther: () => void;
}

/**
 * The fast door between clusters: pills, always visible, no ceremony.
 *
 * Switching happens dozens of times a day, so nothing here animates or gets in
 * the way. The slow, spatial door is the disc in the galaxy view.
 */
export const ClusterSwitcher = ({
  clusters,
  activeId,
  counts,
  onSelect,
  onCreate,
  canEther,
  onEther,
}: ClusterSwitcherProps) => {
  const [naming, setNaming] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (naming) inputRef.current?.focus();
  }, [naming]);

  const commit = () => {
    const name = draft.trim();
    if (name) onCreate(name);
    setDraft("");
    setNaming(false);
  };

  const activeName = clusters.find((cluster) => cluster.id === activeId)?.name;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <div
        role="group"
        aria-label="Select cluster"
        className="inline-flex flex-wrap items-center gap-1 rounded-2xl border border-[rgba(165,175,255,0.14)] bg-[rgba(9,10,25,0.5)] p-1 backdrop-blur-md"
      >
        {clusters.map((cluster, index) => {
          const isActive = cluster.id === activeId;
          const open = counts[cluster.id] ?? 0;
          return (
            <button
              key={cluster.id}
              type="button"
              aria-pressed={isActive}
              title={index < 9 ? `${cluster.name}  (⌘${index + 1})` : cluster.name}
              onClick={() => onSelect(cluster.id)}
              className={`flex items-center gap-2 rounded-xl px-4 py-1.5 font-mono text-[11.5px] font-semibold uppercase tracking-[0.09em] transition ${
                isActive
                  ? "bg-gradient-to-br from-[#5b5cf0] to-[#7c83ff] text-white shadow-[0_0_22px_rgba(124,131,255,0.4)]"
                  : "text-[#9aa6c4] hover:text-white"
              }`}
            >
              <span className="normal-case tracking-normal">{cluster.name}</span>
              {open > 0 ? (
                <span
                  className={isActive ? "text-white/70" : "text-[#6d7899]"}
                  aria-label={`${open} open`}
                >
                  {open}
                </span>
              ) : null}
            </button>
          );
        })}

        {naming ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter") commit();
              if (event.key === "Escape") {
                setDraft("");
                setNaming(false);
              }
            }}
            placeholder="Name it"
            aria-label="Name the new cluster"
            className="w-32 rounded-xl bg-[rgba(165,175,255,0.08)] px-3 py-1.5 text-[12px] text-white outline-none placeholder:text-[#6d7899]"
          />
        ) : (
          <button
            type="button"
            onClick={() => setNaming(true)}
            aria-label="New cluster"
            title="New cluster"
            className="rounded-xl px-3 py-1.5 font-mono text-[13px] font-semibold text-[#9aa6c4] transition hover:text-white"
          >
            +
          </button>
        )}
      </div>

      {canEther && activeName ? (
        <button
          type="button"
          onClick={onEther}
          className="rounded-xl border border-[rgba(165,175,255,0.14)] px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.09em] text-[#9aa6c4] transition hover:border-[rgba(165,175,255,0.35)] hover:text-white"
        >
          Send {activeName} to the ether
        </button>
      ) : null}
    </div>
  );
};

export default ClusterSwitcher;
