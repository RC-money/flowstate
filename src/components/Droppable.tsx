// src/components/Droppable.tsx
import React from "react";
import { useDroppable } from "@dnd-kit/core";

export default function Droppable({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id });

  return (
    <div ref={setNodeRef} className="p-2">
      {children}
    </div>
  );
}
