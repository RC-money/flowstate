import React from "react";
import Column from "./Column";
import type { Status, Task } from "../App";

interface BoardProps {
  tasks: Task[];
  onCardClick: (task: Task) => void;
  onAdd?: (status: Status) => void;
}

export default function Board({ tasks, onCardClick, onAdd }: BoardProps) {
  const columns = [
    { id: "TO-DO", title: "TO-DO" },
    { id: "IN PROGRESS", title: "IN PROGRESS" },
    { id: "DONE", title: "DONE" },
  ] as const;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto px-4 md:px-6 items-start">
      {columns.map((col) => (
        <Column
          key={col.id}
          id={col.id}
          title={col.title}
          cards={tasks.filter((t) => t.status === col.id)}
          onCardClick={onCardClick}
          onAdd={onAdd}
        />
      ))}
    </div>
  );
}
