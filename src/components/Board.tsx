import React, { useState, useEffect } from "react";
import Column from "./Column";
import {
  DndContext,
  closestCenter,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import Card from "./Card";

type ColumnId = "todo" | "inprogress" | "done";
type Task = { id: string; title: string };
type Columns = Record<ColumnId, Task[]>;

export default function Board() {
  const [columns, setColumns] = useState<Columns>({
    todo: [
      { id: "1", title: "Design homepage layout" },
      { id: "2", title: "Build authentication system" },
    ],
    inprogress: [
      { id: "3", title: "Create dashboard components" },
      { id: "4", title: "Write API documentation" },
    ],
    done: [
      { id: "5", title: "Set up CI/CD pipeline" },
      { id: "6", title: "Conduct user testing" },
    ],
  });

  const [activeCard, setActiveCard] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // helpful debug log
  useEffect(() => {
    console.log("✅ Board rendered with columns:", columns);
  }, [columns]);

  const findCard = (id: string) => {
    for (const col of Object.keys(columns) as ColumnId[]) {
      const index = columns[col].findIndex((c) => c.id === id);
      if (index !== -1) return { col, index };
    }
    return null;
  };

  const onDragStart = ({ active }: any) => {
    const found = findCard(active.id);
    if (found) setActiveCard(columns[found.col][found.index]);
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);
    if (!over) return;

    const from = findCard(String(active.id));
    const to = findCard(String(over.id));
    if (!from) return;

    const targetCol =
      to?.col ||
      (["todo", "inprogress", "done"].includes(over.id)
        ? (over.id as ColumnId)
        : from.col);

    setColumns((prev) => {
      const next = { ...prev };
      const [moved] = next[from.col].splice(from.index, 1);
      if (targetCol) next[targetCol].push(moved);
      return next;
    });
  };

  const titleFor = (col: ColumnId) =>
    col === "todo" ? "TO-DO" : col === "inprogress" ? "IN PROGRESS" : "DONE";

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {(["todo", "inprogress", "done"] as ColumnId[]).map((col) => (
          <Column key={col} id={col} title={titleFor(col)} cards={columns[col]} />
        ))}
      </div>

      <DragOverlay>
        {activeCard && (
          <Card id={activeCard.id} title={activeCard.title} className="scale-105" />
        )}
      </DragOverlay>
    </DndContext>
  );
}
