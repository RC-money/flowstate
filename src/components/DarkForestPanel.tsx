import React from "react";
import type { Task } from "../hooks/useLocalTasks";

interface DarkForestPanelProps {
  candidates: Task[];
  archived: Task[];
  onArchive(taskId: string): void;
  onRestore(taskId: string): void;
}

const DarkForestPanel: React.FC<DarkForestPanelProps> = ({
  candidates,
  archived,
  onArchive,
  onRestore,
}) => {
  return (
    <section className="mt-6 rounded-3xl border border-white/10 bg-[#060a17]/80 p-5 text-white shadow-inner shadow-black/40">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-white/60">Dark Forest</p>
          <p className="text-lg font-semibold">Entropy Sanctuary</p>
        </div>
        <span className="rounded-full border border-white/15 px-3 py-1 text-xs tracking-[0.3em] text-white/60">
          {archived.length} at rest
        </span>
      </header>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-white/60">Candidates</p>
          {candidates.length === 0 ? (
            <p className="mt-3 text-sm text-white/50">No high-entropy tasks. Keep flowing.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {candidates.map((task) => (
                <li
                  key={task.id}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
                >
                  <span>{task.title || task.id}</span>
                  <button
                    type="button"
                    onClick={() => onArchive(task.id)}
                    className="rounded-full border border-white/25 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60"
                  >
                    Send In
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-white/60">Resting Tasks</p>
          {archived.length === 0 ? (
            <p className="mt-3 text-sm text-white/50">Dark Forest is empty.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {archived.map((task) => (
                <li
                  key={task.id}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
                >
                  <span>{task.title || task.id}</span>
                  <button
                    type="button"
                    onClick={() => onRestore(task.id)}
                    className="rounded-full border border-white/25 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white/70 transition hover:border-white/60"
                  >
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
};

export default DarkForestPanel;
