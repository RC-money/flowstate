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
  titleById?: Record<string, string>;
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
  titleById,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id });

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.defaultPrevented) return;
    if (event.key.toLowerCase() === "n" && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      onAdd?.(id);
    }
  };

  const accent =
    id === "TO-DO" ? "#47a3f3" : id === "IN PROGRESS" ? "#f7b84b" : "#4ade80";

  return (
    <section
      ref={setNodeRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={[
        "w-full",
        "rounded-[20px] border border-[rgba(165,175,255,0.07)] bg-transparent",
        "p-4 pb-5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7c83ff]/60",
        isOver ? "border-[rgba(165,175,255,0.34)] bg-[rgba(124,131,255,0.09)]" : "",
      ].join(" ")}
      data-focused="false"
      onFocus={(event) => {
        event.currentTarget.dataset.focused = "true";
      }}
      onBlur={(event) => {
        event.currentTarget.dataset.focused = "false";
      }}
    >
      <header className="mb-3.5">
        <h3
          className="font-mono text-xs font-bold uppercase tracking-[0.16em]"
          style={{ color: accent }}
        >
          {title}
        </h3>
        <div
          className="mt-2 h-[3px] w-28 rounded"
          style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }}
        />
        <p className="mt-1.5 font-mono text-[11px] tabular-nums text-[#6b7799]">
          {cards.length} {cards.length === 1 ? "task" : "tasks"}
        </p>
        <button
          type="button"
          onClick={() => onAdd?.(id)}
          aria-label={`Add task to ${title}`}
          className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[rgba(165,175,255,0.14)] bg-[rgba(165,175,255,0.05)] px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.09em] text-[#c9d0ff] transition hover:border-[rgba(165,175,255,0.4)] hover:bg-[rgba(165,175,255,0.12)] hover:text-white"
        >
          + New task
          <span
            aria-hidden="true"
            className="rounded-md border border-[rgba(165,175,255,0.2)] px-1.5 py-0.5 text-[9.5px] text-[#6b7799]"
          >
            N
          </span>
        </button>
      </header>

      <div className="space-y-3.5">
        {cards.map((t) => (
          <Card
            key={t.id}
            id={t.id}
            title={t.title}
            status={t.status}
            dueDate={t.dueDate}
            description={t.description}
            tags={t.tags}
            depTitles={(t.dependsOn ?? [])
              .map((depId) => titleById?.[depId])
              .filter((x): x is string => Boolean(x))}
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
