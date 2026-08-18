import React, { useRef, useState, useCallback } from "react";
import Column from "./Column";
import type { Status, Task } from "../App";
import { useBoardHotkeys } from "../hooks/useBoardHotkeys";

interface BoardProps {
  tasks: Task[];
  onCardClick: (task: Task) => void;
  onAdd?: (status: Status) => void;
  onOpenTask?: (taskId: string) => void;
  onMoveTask?: (taskId: string, next: Status) => void;
  onDeleteTask?: (taskId: string) => void;
  onAddTask?: () => void;
}

export default function Board({
  tasks,
  onCardClick,
  onAdd,
  onOpenTask,
  onMoveTask,
  onDeleteTask,
  onAddTask,
}: BoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const handleCardSelection = useCallback(
    (task: Task) => {
      setSelectedCardId(task.id);
      onCardClick(task);
    },
    [onCardClick]
  );

  const handleStatusHotkey = useCallback(
    (status: Status) => {
      if (!selectedCardId) return;
      onMoveTask?.(selectedCardId, status);
       
      console.info("Move", selectedCardId, "to", status);
      window.dispatchEvent(
        new CustomEvent("flowstate:toast", {
          detail: { message: `Moved to ${status}`, variant: "success" },
        })
      );
    },
    [onMoveTask, selectedCardId]
  );

  useBoardHotkeys(boardRef as React.RefObject<HTMLElement>, {
    onNew: () => {
      if (onAddTask) {
        onAddTask();
      } else {
        onAdd?.("TO-DO");
      }
    },
    onSetStatus: handleStatusHotkey,
  });

  const columns = [
    { id: "TO-DO", title: "TO-DO" },
    { id: "IN PROGRESS", title: "IN PROGRESS" },
    { id: "DONE", title: "DONE" },
  ] as const;

  return (
    <div
      ref={boardRef}
      className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto px-4 md:px-6 items-start"
    >
      {columns.map((col) => (
        <Column
          key={col.id}
          id={col.id}
          title={col.title}
          cards={tasks.filter((t) => t.status === col.id)}
          onCardClick={handleCardSelection}
          onAdd={onAdd}
          openTask={onOpenTask}
          moveTask={onMoveTask}
          deleteTask={onDeleteTask}
        />
      ))}
    </div>
  );
}
