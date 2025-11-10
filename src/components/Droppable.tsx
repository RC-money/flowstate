// src/components/Droppable.tsx
import React from "react";
import { useDroppable } from "@dnd-kit/core";

export default function Droppable({
  id,
  children,
  className = "",
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`${className} transition-all duration-300 ${
        isOver
          ? "ring-2 ring-ether-400/60 ring-offset-2 ring-offset-space-700"
          : ""
      }`}
    >
      {children}
    </div>
  );
}
