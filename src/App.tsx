import React, { useState } from "react";
import Card from "./components/Card";
import Column from "./components/Column";
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

type ColumnId = "todo" | "inprogress" | "done";
type CardType = { id: string; title: string };
type Columns = Record<ColumnId, CardType[]>;

export default function App() {
  const [columns, setColumns] = useState<Columns>({
    todo: [
      { id: "c1", title: "Design homepage layout" },
      { id: "c2", title: "Build authentication system" },
    ],
    inprogress: [
      { id: "c3", title: "Create dashboard components" },
      { id: "c4", title: "Write API documentation" },
    ],
    done: [
      { id: "c5", title: "Set up CI/CD pipeline" },
      { id: "c6", title: "Conduct user testing" },
    ],
  });

  const [activeCard, setActiveCard] = useState<CardType | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function titleFor(colId: ColumnId) {
    switch (colId) {
      case "todo":
        return "TO-DO";
      case "inprogress":
        return "IN PROGRESS";
      case "done":
        return "DONE";
      default:
        return colId;
    }
  }

  function findCard(cardId: string) {
    for (const col of Object.keys(columns) as ColumnId[]) {
      const idx = columns[col].findIndex((c) => c.id === cardId);
      if (idx !== -1) return { col, idx };
    }
    return null;
  }

  function onDragStart({ active }: any) {
    const where = findCard(active.id as string);
    if (!where) return;
    setActiveCard(columns[where.col][where.idx]);
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveCard(null);
    if (!over) return;

    const from = findCard(String(active.id));
    if (!from) return;

    const possibleColumns: ColumnId[] = ["todo", "inprogress", "done"];
    const overId = String(over.id);
    const toCol: ColumnId | undefined =
      (possibleColumns as string[]).includes(overId)
        ? (overId as ColumnId)
        : findCard(overId)?.col;

    if (!toCol) return;

    setColumns((prev) => {
      const next: Columns = {
        todo: [...prev.todo],
        inprogress: [...prev.inprogress],
        done: [...prev.done],
      };

      // Remove card from source column
      const [moved] = next[from.col].splice(from.idx, 1);

      // Insert card in new column (at end by default)
      let insertIndex = next[toCol].length;

      // If hovering a specific card, insert before it
      if (!possibleColumns.includes(overId)) {
        const overPos = next[toCol].findIndex((c) => c.id === overId);
        if (overPos !== -1) insertIndex = overPos;
      }

      next[toCol].splice(insertIndex, 0, moved);
      return next;
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="min-h-screen bg-space-700 text-ether-100 px-8 py-10">
        <header className="text-center mb-12">
          <h1 className="text-3xl font-extrabold bg-ether-gradient bg-clip-text text-transparent animate-pulseSoft tracking-wide">
            FLOWSTATE
          </h1>
          <p className="mt-1 text-ether-300">Your tasks, in motion.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {(["todo", "inprogress", "done"] as ColumnId[]).map((colId) => (
            <Column
              key={colId}
              id={colId}
              title={titleFor(colId)}
              cards={columns[colId]}
            />
          ))}
        </div>

        <DragOverlay>
          {activeCard ? (
            <Card
              id={activeCard.id}
              title={activeCard.title}
              className="shadow-2xl scale-[1.02]"
            />
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
}