import { motion, useDragControls } from "motion/react";
import { useState } from "react";

interface TaskCardProps {
  id: string;
  title: string;
  status: "todo" | "inprogress" | "done";
  onClick?: () => void;
  onMove?: (id: string, newStatus: "todo" | "inprogress" | "done") => void;
  onReorder?: (dragId: string, targetId: string, status: string) => void;
}

export function TaskCard({
  id,
  title,
  status,
  onClick,
  onMove,
  onReorder,
}: TaskCardProps) {
  const controls = useDragControls();
  const [isDragging, setIsDragging] = useState(false);

  const color =
    status === "done"
      ? "text-emerald-300"
      : status === "inprogress"
      ? "text-sky-300"
      : "text-slate-200";

  const glowColor =
    status === "done"
      ? "rgba(16,185,129,0.25)"
      : status === "inprogress"
      ? "rgba(56,189,248,0.25)"
      : "rgba(148,163,184,0.2)";

  return (
    <motion.div
      layout
      drag
      dragElastic={0.25}
      dragMomentum={0.3}
      dragControls={controls}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={(event, info) => {
        setIsDragging(false);

        // Detect column drop
        const cols = document.querySelectorAll(".kanban-column");
        cols.forEach((col) => {
          const rect = col.getBoundingClientRect();
          if (
            info.point.x > rect.left &&
            info.point.x < rect.right &&
            info.point.y > rect.top &&
            info.point.y < rect.bottom
          ) {
            const newStatus = col.getAttribute("data-status") as
              | "todo"
              | "inprogress"
              | "done";
            if (newStatus && newStatus !== status) {
              onMove?.(id, newStatus);
            }
          }
        });
      }}
      whileHover={!isDragging ? { scale: 1.04, boxShadow: `0 0 30px ${glowColor}` } : {}}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className={`p-4 rounded-xl bg-space-500/60 shadow-soft ${
        isDragging ? "cursor-grabbing" : "cursor-grab"
      } transition-all duration-300 backdrop-blur-md border border-white/5`}
      onClick={() => {
        if (!isDragging && onClick) onClick();
      }}
    >
      <h3 className={`font-medium ${color}`}>{title}</h3>
    </motion.div>
  );
}