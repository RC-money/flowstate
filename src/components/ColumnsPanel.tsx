import { useEffect, useState } from "react";
import type { Column } from "../lib/columns/columns";
import { MAX_COLUMNS, columnPalette } from "../lib/columns/palette";

interface ColumnsPanelProps {
  /** The active cluster's columns, in board order. */
  columns: Column[];
  clusterName: string;
  onAdd: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, position: number) => void;
  onClose: () => void;
}

/**
 * One place to shape a board, reached by a single palette entry.
 *
 * The alternative was two palette commands per column, which reads fine at
 * three and is unusable at fifty. Here the list is the thing you scan, and the
 * colour beside each row is the one the board and the galaxy actually use.
 */
export default function ColumnsPanel({
  columns,
  clusterName,
  onAdd,
  onRename,
  onRemove,
  onMove,
  onClose,
}: ColumnsPanelProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !renamingId && !adding) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, renamingId, adding]);

  const commitRename = () => {
    if (renamingId) onRename(renamingId, draft);
    setRenamingId(null);
    setDraft("");
  };

  const commitAdd = () => {
    const name = newName.trim();
    if (name) onAdd(name);
    setNewName("");
    setAdding(false);
  };

  return (
    <div
      className="fixed inset-0 z-[9997] flex justify-end bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <aside
        role="dialog"
        aria-label="Columns"
        onClick={(event) => event.stopPropagation()}
        className="flex w-[340px] flex-col border-l border-[rgba(165,175,255,0.12)] bg-[#0B1220]/96"
      >
        <header className="border-b border-[rgba(165,175,255,0.1)] px-5 py-4">
          <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-300">
            Columns
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {clusterName} &middot; {columns.length} of {MAX_COLUMNS}. The last one is
            the finish line.
          </p>
        </header>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {columns.map((column, index) => {
            const { hues } = columnPalette(index);
            const isLast = index === columns.length - 1;
            return (
              <div
                key={column.id}
                className="mb-1 rounded-xl px-3 py-2 transition hover:bg-white/[0.04]"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{
                      background:
                        hues.length > 1
                          ? `linear-gradient(135deg, ${hues.join(", ")})`
                          : hues[0],
                    }}
                  />
                  {renamingId === column.id ? (
                    <input
                      autoFocus
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") commitRename();
                        if (event.key === "Escape") setRenamingId(null);
                      }}
                      aria-label={`Rename ${column.name}`}
                      className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setDraft(column.name);
                        setRenamingId(column.id);
                      }}
                      className="min-w-0 flex-1 truncate text-left text-sm text-[#e7ebff]"
                      title="Rename"
                    >
                      {column.name}
                    </button>
                  )}
                  {isLast ? (
                    <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.1em] text-[#4d587a]">
                      Finish
                    </span>
                  ) : null}
                </div>

                <div className="mt-1 flex gap-3 pl-[22px]">
                  <button
                    type="button"
                    onClick={() => onMove(column.id, index - 1)}
                    disabled={index === 0}
                    aria-label={`Move ${column.name} earlier`}
                    className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-[#4d587a] transition hover:text-[#c9d0ff] disabled:opacity-30 disabled:hover:text-[#4d587a]"
                  >
                    &uarr; Earlier
                  </button>
                  <button
                    type="button"
                    onClick={() => onMove(column.id, index + 1)}
                    disabled={isLast}
                    aria-label={`Move ${column.name} later`}
                    className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-[#4d587a] transition hover:text-[#c9d0ff] disabled:opacity-30 disabled:hover:text-[#4d587a]"
                  >
                    &darr; Later
                  </button>
                  {columns.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => onRemove(column.id)}
                      aria-label={`Remove ${column.name}`}
                      className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-[#4d587a] transition hover:text-[#ff9a9a]"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        <footer className="border-t border-[rgba(165,175,255,0.1)] p-3">
          {adding ? (
            <input
              autoFocus
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onBlur={commitAdd}
              onKeyDown={(event) => {
                if (event.key === "Enter") commitAdd();
                if (event.key === "Escape") {
                  setNewName("");
                  setAdding(false);
                }
              }}
              placeholder="Name it"
              aria-label="Name the new column"
              className="w-full rounded-xl border border-[rgba(165,175,255,0.2)] bg-[rgba(165,175,255,0.06)] px-3 py-2 text-sm text-white outline-none placeholder:text-[#6b7799]"
            />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              disabled={columns.length >= MAX_COLUMNS}
              className="w-full rounded-xl border border-dashed border-[rgba(165,175,255,0.16)] px-3 py-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.09em] text-[#9aa6c4] transition hover:border-[rgba(165,175,255,0.4)] hover:text-white disabled:opacity-40"
            >
              + New column
            </button>
          )}
        </footer>
      </aside>
    </div>
  );
}
