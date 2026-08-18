import React from "react";
import { motion } from "framer-motion";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Task } from "../App";
import { dueState, formatDueLabel, DUE_TONES } from "../lib/taskDates";

export interface TaskCardProps {
  id: string;
  title: string;
  status: Task["status"];
  dueDate?: string;
  description?: string;
  tags?: string[];
  depTitles?: string[];
  onClick?: () => void;
}

export default function TaskCard({
  id,
  title,
  status,
  dueDate,
  description,
  tags,
  depTitles,
  onClick,
}: TaskCardProps) {
  // accent based on column
  const accent =
    status === "TO-DO" ? "#47a3f3" : status === "IN PROGRESS" ? "#f7b84b" : "#4ade80";


  // A completed task is never late, so it reads as plain regardless of its date.
  const due = status === "DONE" ? "none" : dueState(dueDate, new Date());

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });

  const dragMotionStyle = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0 : 1,
    border: "1px solid rgba(165,175,255,0.14)",
    boxShadow: "0 0 0 rgba(0,0,0,0)",
  };

  return (
    <motion.div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="group relative select-none rounded-[15px] bg-[rgba(18,20,43,0.66)] px-4 pb-4 pt-3.5 backdrop-blur-md transition-all duration-200 ease-out"
      layout
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 250, damping: 20 }}
      onClick={onClick}
      style={dragMotionStyle}
      whileHover={{
        y: -2,
        boxShadow: `0 12px 30px rgba(5,7,15,0.6), 0 0 30px rgba(124,131,255,0.4)`,
      }}
    >
      <span
        aria-hidden="true"
        className={[
          "absolute right-3.5 top-3.5 h-[7px] w-[7px] rounded-full",
          status === "IN PROGRESS" ? "animate-pulse" : "",
        ].join(" ")}
        style={{ background: accent, boxShadow: `0 0 12px ${accent}` }}
      />
      <div className="relative z-10 pr-5">
        <h4 className="text-[15.5px] font-medium leading-snug text-[#e5e8ff]">{title}</h4>
        {description ? (
          <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-snug text-[#9aa6c4]">{description}</p>
        ) : null}
        {(tags?.length || depTitles?.length || due !== "none") ? (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {due !== "none" ? (
              <span
                className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${DUE_TONES[due]}`}
              >
                {formatDueLabel(dueDate, new Date())}
              </span>
            ) : null}
            {(tags ?? []).map((tag) => (
              <span
                key={tag}
                className="rounded-md border border-[rgba(165,175,255,0.16)] bg-[rgba(124,131,255,0.13)] px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.07em] text-[#a5afff]"
              >
                {tag}
              </span>
            ))}
            {(depTitles ?? []).map((dep) => (
              <span
                key={dep}
                className="rounded-md border border-[rgba(165,175,255,0.16)] bg-[rgba(124,131,255,0.13)] px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.07em] text-[#a5afff]"
              >
                &#8627; {dep.length > 18 ? `${dep.slice(0, 18)}…` : dep}
              </span>
            ))}
          </div>
        ) : null}
      </div>

    </motion.div>
  );
}
