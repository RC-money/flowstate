import React from "react";
import type { Task } from "../hooks/useLocalTasks";
import { isTerminal, type Column } from "../lib/columns/columns";

interface StatusBarProps {
  tasks: Task[];
  /** This board's own columns. Its last one is what "complete" means. */
  columns: Column[];
  clusterName: string;
  /** The name is the way back to the map, now that the pills are gone. */
  onOpenAndromeda: () => void;
}

/**
 * The footer line: which cluster you are standing in, what is in it, and the
 * hotkey legend.
 *
 * Counting reads the board's own columns rather than the old three statuses --
 * finished means the last column, and in motion means anything past the first
 * that has not reached it.
 */
const StatusBar: React.FC<StatusBarProps> = ({
  tasks,
  columns,
  clusterName,
  onOpenAndromeda,
}) => {
  const first = columns[0]?.id;
  const done = tasks.filter((task) => isTerminal(columns, task.status)).length;
  const doing = tasks.filter(
    (task) => task.status !== first && !isTerminal(columns, task.status)
  ).length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  return (
    <p className="mt-9 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 font-mono text-[10.5px] uppercase tracking-[0.09em] text-[#6b7799]">
      <button
        type="button"
        onClick={onOpenAndromeda}
        title="Open Andromeda"
        className="font-semibold uppercase tracking-[0.09em] text-[#a5afff] transition hover:text-white"
      >
        {clusterName}
      </button>
      <span>
        <b className="font-semibold text-[#a5afff]">{tasks.length}</b> bodies in cluster
      </span>
      <span>
        <b className="font-semibold text-[#a5afff]">{doing}</b> in motion
      </span>
      <span>
        <b className="font-semibold text-[#a5afff]">{pct}%</b> complete
      </span>
      <span>N new &middot; G galaxy &middot; &#8984;K commands</span>
    </p>
  );
};

export default StatusBar;
