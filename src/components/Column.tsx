import React from "react";
import { useDroppable } from "@dnd-kit/core";
import type { Status, Task } from "../App";
import Card from "./Card";

type Props = {
  id: Status;           // "TO-DO" | "IN PROGRESS" | "DONE"
  title: string;
  cards: Task[];
  onCardClick: (t: Task) => void;
};

export default function Column({ id, title, cards, onCardClick }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id });

  const lineFrom =
    id === "TO-DO"
      ? "from-cyan-400/60"
      : id === "IN PROGRESS"
      ? "from-indigo-400/60"
      : "from-emerald-400/60";

  return (
    <section
      ref={setNodeRef}
      className={[
        "w-full",
        "rounded-2xl border border-white/10 bg-transparent",
        "p-5 transition-colors",
        isOver ? "bg-white/8" : "",
      ].join(" ")}
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
      </header>

      <div className="space-y-4">
        {cards.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onCardClick(t)}
            className="w-full text-left"
          >
            <Card id={t.id} title={t.title} status={t.status} />
          </button>
        ))}
      </div>
    </section>
  );
}
