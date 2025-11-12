import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Task } from "../App";

export interface TaskCardProps {
  id: string;
  title: string;
  status: Task["status"];
  onClick?: () => void;
  onEdit?: () => void;
  onMarkDone?: () => void;
  onDelete?: () => void;
  onMove?: (next: Task["status"]) => void;
}

export default function TaskCard({
  id,
  title,
  status,
  onClick,
  onEdit,
  onMarkDone,
  onDelete,
  onMove,
}: TaskCardProps) {
  // accent based on column
  const accent =
    status === "TO-DO"
      ? "#22d3ee" // cyan-400
      : status === "IN PROGRESS"
      ? "#818cf8" // indigo-400
      : "#10b981"; // emerald-500

  const hasQuickActions = Boolean(onEdit || onMarkDone || onDelete || onMove);
  const moveButtonRef = useRef<HTMLButtonElement | null>(null);
  const moveMenuRef = useRef<HTMLDivElement | null>(null);
  const [isMoveMenuOpen, setMoveMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);

  const updateMenuPosition = useCallback(() => {
    const rect = moveButtonRef.current?.getBoundingClientRect();
    if (rect) {
      setMenuPosition({
        x: rect.left,
        y: rect.bottom + 8,
      });
    }
  }, []);

  useEffect(() => {
    if (!isMoveMenuOpen) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        moveMenuRef.current?.contains(target) ||
        moveButtonRef.current?.contains(target)
      ) {
        return;
      }
      setMoveMenuOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMoveMenuOpen(false);
      }
    };
    updateMenuPosition();
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isMoveMenuOpen, updateMenuPosition]);

  const statusOptions: Task["status"][] = ["TO-DO", "IN PROGRESS", "DONE"];

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });

  const dragMotionStyle = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0 : 1,
    border: `1px solid ${accent}33`,
    boxShadow: `0 0 0 rgba(0,0,0,0)`,
  };

  return (
    <motion.div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="group relative select-none rounded-xl bg-[#0f172a]/90 px-5 pt-5 pb-24 backdrop-blur-sm transition-all duration-200 ease-out hover:scale-[1.02]"
      layout
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 250, damping: 20 }}
      onClick={onClick}
      style={dragMotionStyle}
      whileHover={{
        scale: 1.02,
        boxShadow: `0 0 25px ${accent}44`,
      }}
    >
      <div className="relative z-10">
        <h4 className="mb-1 text-lg font-semibold">{title}</h4>
        <p className="text-xs uppercase tracking-wide text-slate-500">{status}</p>
      </div>

      {hasQuickActions ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-wrap justify-end gap-3 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/80 to-transparent px-5 pb-6 pt-6 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
          {onEdit ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onEdit();
              }}
              className="pointer-events-auto rounded-lg border border-white/20 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/80 transition hover:border-white/40 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              Edit
            </button>
          ) : null}
          {onMove ? (
            <div className="pointer-events-auto relative">
              <button
                type="button"
                ref={moveButtonRef}
                onClick={(event) => {
                  event.stopPropagation();
                  if (!isMoveMenuOpen) {
                    updateMenuPosition();
                  }
                  setMoveMenuOpen((prev) => !prev);
                }}
                className="rounded-lg border border-white/20 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/80 transition hover:border-white/40 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                Move
              </button>
              {typeof document !== "undefined" && menuPosition
                ? createPortal(
                    <AnimatePresence>
                      {isMoveMenuOpen ? (
                        <motion.div
                          ref={moveMenuRef}
                          initial={{ opacity: 0, scale: 0.95, y: 8 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 8 }}
                          transition={{ duration: 0.18, ease: "easeOut" }}
                          className="fixed z-50 min-w-[180px] rounded-2xl border border-white/10 bg-[#050B18]/95 p-2 shadow-2xl shadow-black/60 backdrop-blur"
                          style={{ left: menuPosition.x, top: menuPosition.y }}
                        >
                          {statusOptions.map((option) => {
                            const active = option === status;
                            return (
                              <button
                                key={option}
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setMoveMenuOpen(false);
                                  onMove(option);
                                }}
                                className={[
                                  "w-full rounded-xl px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide transition",
                                  active
                                    ? "bg-white/10 text-white"
                                    : "text-slate-300 hover:bg-white/10",
                                ].join(" ")}
                              >
                                {option}
                              </button>
                            );
                          })}
                        </motion.div>
                      ) : null}
                    </AnimatePresence>,
                    document.body
                  )
                : null}
            </div>
          ) : null}
          {onMarkDone && status !== "DONE" ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onMarkDone();
              }}
              className="pointer-events-auto rounded-lg border border-emerald-300/40 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-200 transition hover:border-emerald-200 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60"
            >
              Mark Done
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
              className="pointer-events-auto rounded-lg border border-rose-300/40 bg-rose-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-rose-200 transition hover:border-rose-200 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/60"
            >
              Delete
            </button>
          ) : null}
        </div>
      ) : null}
    </motion.div>
  );
}
