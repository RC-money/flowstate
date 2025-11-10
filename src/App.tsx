// src/App.tsx
import React, { useState } from "react";
import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import Board from "./components/Board";
import FlowBackground from "./components/FlowBackground";
import GlowOverlay from "./components/GlowOverlay";
import NoiseOverlay from "./components/NoiseOverlay";
import TaskModal from "./components/TaskModal";

export interface Task {
  id: string;
  title: string;
  status: "TO-DO" | "IN PROGRESS" | "DONE";
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([
    { id: "1", title: "Design homepage layout", status: "TO-DO" },
    { id: "2", title: "Build authentication system", status: "TO-DO" },
    { id: "3", title: "Create dashboard components", status: "IN PROGRESS" },
    { id: "4", title: "Write API documentation", status: "IN PROGRESS" },
    { id: "5", title: "Set up CI/CD pipeline", status: "DONE" },
  ]);

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Handle drag and drop updates
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    setTasks((prev) =>
      prev.map((task) =>
        task.id === active.id
          ? { ...task, status: over.id.toUpperCase() as Task["status"] }
          : task
      )
    );
  };

  // Open and close modal
  const handleCardClick = (task: Task) => setSelectedTask(task);
  const handleCloseModal = () => setSelectedTask(null);

  // Move task between statuses
  const handleMove = (id: string, newStatus: Task["status"]) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t))
    );
    setSelectedTask(null);
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-[#0f172a] to-[#020617] overflow-hidden text-white">
      <FlowBackground />
      <GlowOverlay />
      <NoiseOverlay />

      <div className="relative z-10 p-10">
        <h1 className="text-4xl font-bold text-center mb-10 tracking-tight text-ether-300">
          FLOWSTATE
        </h1>
        <p className="text-center text-slate-400 mb-12">
          Your tasks, in motion.
        </p>

        <DndContext onDragEnd={handleDragEnd}>
          <Board tasks={tasks} onCardClick={handleCardClick} />
        </DndContext>

        <TaskModal
          task={selectedTask}
          onClose={handleCloseModal}
          onMove={handleMove}
        />
      </div>
    </div>
  );
}
