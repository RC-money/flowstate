// src/components/Column.tsx
import React from "react";
import Droppable from "./Droppable";
import TaskCard from "./TaskCard";
import type { Task } from "../App";

interface ColumnProps {
  id: string;
  title: string;
  cards: Task[];
  onCardClick: (task: Task) => void;
}

export default function Column({ id, title, cards, onCardClick }: ColumnProps) {
  const color =
    title === "TO-DO"
      ? "text-cyan-400"
      : title === "IN PROGRESS"
      ? "text-indigo-400"
      : "text-emerald-400";
  const bar =
    title === "TO-DO"
      ? "bg-cyan-400"
      : title === "IN PROGRESS"
      ? "bg-indigo-400"
      : "bg-emerald-400";

  return (
    <Droppable id={id} className="flex flex-col bg-[#0F172A]/40 rounded-2xl p-6 border border-white/10 backdrop-blur-xl">
      <h3 className={`text-lg font-semibold mb-3 ${color}`}>{title}</h3>
      <div className={`h-[3px] w-1/2 rounded-full mb-5 ${bar}`} />
      <div className="space-y-3">
        {cards.map((card) => (
          <TaskCard
            key={card.id}
            id={card.id}
            title={card.title}
            status={card.status}
            onClick={() => onCardClick(card)}
          />
        ))}
      </div>
    </Droppable>
  );
}
