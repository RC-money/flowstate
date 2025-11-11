// src/App.tsx
import React, { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import Board from "./components/Board";
import Card from "./components/Card";
import TaskModal from "./components/TaskModal";

// Types exported for Column/Board typing
export type Status = "TO-DO" | "IN PROGRESS" | "DONE";
export type Task = {
  id: string;
  title: string;
  status: Status;
};

const initialTasks: Task[] = [
  { id: "t1", title: "Create dashboard components", status: "TO-DO" },
  { id: "t2", title: "Write API documentation", status: "TO-DO" },
  { id: "t3", title: "Build authentication system", status: "IN PROGRESS" },
  { id: "t4", title: "Set up CI/CD pipeline", status: "IN PROGRESS" },
  { id: "t5", title: "Design homepage layout", status: "DONE" },
];

export default function App() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const tasksById = useMemo(() => {
    const m: Record<string, Task> = {};
    for (const t of tasks) m[t.id] = t;
    return m;
  }, [tasks]);

  const handleCardClick = (task: Task) => setSelectedTask(task);
  const handleCloseModal = () => setSelectedTask(null);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const active = event.active;
    const over = event.over;
    if (!active || !over) {
      setActiveId(null);
      return;
    }

    // If dropped over a column, its id will be one of the Status values
    const overId = String(over.id);
    const possibleColumns: Status[] = ["TO-DO", "IN PROGRESS", "DONE"];
    if (possibleColumns.includes(overId as Status)) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === String(active.id) ? { ...t, status: overId as Status } : t
        )
      );
    }
    setActiveId(null);
  };

  const handleMove = (id: string, newStatus: Status) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t))
    );
    setSelectedTask(null);
  };

  return (
    <main className="min-h-screen bg-[#0B1220] text-white">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <h1 className="text-center text-4xl font-extrabold tracking-wide">FLOWSTATE</h1>
        <p className="text-center mt-3 text-[#8aa0b8]">Your tasks, in motion.</p>

        <div className="mt-10">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            {/* The three droppable columns are inside Board */}
            <Board tasks={tasks} onCardClick={handleCardClick} />

            {/* Floating card while dragging for smooth visuals */}
            <DragOverlay
              dropAnimation={{ duration: 220, easing: "cubic-bezier(.2,.8,.2,1)" }}
            >
              {activeId ? (
                <Card
                  id={activeId}
                  title={tasksById[activeId]?.title ?? ""}
                  status={tasksById[activeId]?.status ?? "TO-DO"}
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>
      <TaskModal task={selectedTask} onClose={handleCloseModal} onMove={handleMove} />
    </main>
  );
}
