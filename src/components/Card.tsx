import React from "react";
import { useDraggable } from "@dnd-kit/core";
import type { Status } from "../App";

type Props = {
  id: string;
  title: string;
  status: Status;
};

export default function Card({ id, title, status }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id });

  const style: React.CSSProperties = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      className={[
        "rounded-xl border border-white/10 bg-white/5 px-5 py-4",
        "backdrop-blur-sm transition-shadow",
        isDragging ? "shadow-xl shadow-black/50" : "hover:shadow-md",
      ].join(" ")}
    >
      <p className="font-semibold">{title}</p>
      <p className="text-xs mt-2 uppercase tracking-wide text-white/50">{status}</p>
    </div>
  );
}