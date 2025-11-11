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
        "backdrop-blur-sm transform transition-transform transition-shadow duration-200",
        "shadow-[0_0_25px_rgba(59,130,246,0.15)]",
        isDragging
          ? "shadow-[0_0_35px_rgba(59,130,246,0.35)] scale-[1.02]"
          : "hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[0_0_35px_rgba(59,130,246,0.3)] hover:border-white/20",
        isDragging ? "opacity-0" : "",
      ].join(" ")}
    >
      <p className="font-semibold">{title}</p>
      <p className="text-xs mt-2 uppercase tracking-wide text-white/50">{status}</p>
    </div>
  );
}
