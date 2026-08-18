import React from "react";
import type { Task } from "../hooks/useLocalTasks";

/** The artifact's footer line: system counts plus the hotkey legend. */
const StatusBar: React.FC<{ tasks: Task[] }> = ({ tasks }) => {
  const done = tasks.filter((task) => task.status === "DONE").length;
  const doing = tasks.filter((task) => task.status === "IN PROGRESS").length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  return (
    <p className="mt-9 flex flex-wrap justify-center gap-x-6 gap-y-1 font-mono text-[10.5px] uppercase tracking-[0.09em] text-[#6b7799]">
      <span>
        <b className="font-semibold text-[#a5afff]">{tasks.length}</b> bodies in system
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
