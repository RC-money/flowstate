import React from "react";
import { useDroppable } from "@dnd-kit/core";
import type { Status, Task } from "../App";
import Card from "./Card";

type Props = {
  id: Status;           // "TO-DO" | "IN PROGRESS" | "DONE"
  title: string;
  cards: Task[];
  onCardClick: (t: Task) => void;
  onAdd?: (status: Status) => void;
  openTask?: (taskId: string) => void;
  moveTask?: (taskId: string, next: Status) => void;
  deleteTask?: (taskId: string) => void;
};

export default function Column({
  id,
  title,
  cards,
  onCardClick,
  onAdd,
  openTask,
  moveTask,
  deleteTask,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id });

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.defaultPrevented) return;
    if (event.key.toLowerCase() === "n" && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      onAdd?.(id);
    }
  };

  const lineFrom =
    id === "TO-DO"
      ? "from-cyan-400/60"
      : id === "IN PROGRESS"
      ? "from-indigo-400/60"
      : "from-emerald-400/60";

  return (
    <section
      ref={setNodeRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={[
        "w-full",
        "rounded-2xl border border-white/10 bg-transparent",
        "p-5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60",
        "data-[focused=true]:border-cyan-400/40 data-[focused=true]:bg-white/5",
        isOver ? "bg-white/8" : "",
      ].join(" ")}
      data-focused="false"
      onFocus={(event) => {
        event.currentTarget.dataset.focused = "true";
      }}
      onBlur={(event) => {
        event.currentTarget.dataset.focused = "false";
      }}
    >
      <header className="mb-4">
        <h3
          className={[
            "text-sm font-bold uppercase tracking-wider",
            id === "TO-DO" ? "text-cyan-300" : id === "IN PROGRESS" ? "text-indigo-300" : "text-emerald-300",
          ].join(" ")}
        >
          {title}
        </h3>
        <div className={`mt-2 h-[3px] w-32 rounded bg-gradient-to-r ${lineFrom} to-transparent`} />
        <button
          type="button"
          onClick={() => onAdd?.(id)}
          aria-label={`Add task to ${title}`}
          className="mt-3 inline-flex items-center gap-1 rounded-xl border border-white/5 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/10"
        >
          <span className="text-base leading-none">+</span>
          New task
          <span
            aria-hidden="true"
            className="ml-2 rounded-md border border-white/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-300"
          >
            N
          </span>
        </button>
      </header>

      <div className="space-y-4">
        {cards.map((t) => (
          <Card
            key={t.id}
            id={t.id}
            title={t.title}
            status={t.status}
            dueDate={t.dueDate}
            onClick={() => {
              onCardClick(t);
              openTask?.(t.id);
            }}
            onEdit={() => openTask?.(t.id)}
            onMarkDone={() => moveTask?.(t.id, "DONE")}
            onDelete={() => deleteTask?.(t.id)}
            onMove={(next) => moveTask?.(t.id, next)}
          />
        ))}
      </div>
    </section>
  );
}
