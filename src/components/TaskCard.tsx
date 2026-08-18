import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Task } from "../App";
import { dueState, formatDueLabel, DUE_TONES } from "../lib/taskDates";

export interface TaskCardProps {
  id: string;
  title: string;
  status: Task["status"];
  dueDate?: string;
  description?: string;
  tags?: string[];
  depTitles?: string[];
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
  dueDate,
  description,
  tags,
  depTitles,
  onClick,
  onEdit,
  onMarkDone,
  onDelete,
  onMove,
}: TaskCardProps) {
  // accent based on column
  const accent =
    status === "TO-DO" ? "#47a3f3" : status === "IN PROGRESS" ? "#f7b84b" : "#4ade80";

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

  // A completed task is never late, so it reads as plain regardless of its date.
  const due = status === "DONE" ? "none" : dueState(dueDate, new Date());

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });

  const dragMotionStyle = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0 : 1,
    border: "1px solid rgba(165,175,255,0.14)",
    boxShadow: "0 0 0 rgba(0,0,0,0)",
  };

  return (
    <motion.div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="group relative select-none rounded-[15px] bg-[rgba(18,20,43,0.66)] px-4 pb-4 pt-3.5 backdrop-blur-md transition-all duration-200 ease-out"
      layout
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 250, damping: 20 }}
      onClick={onClick}
      style={dragMotionStyle}
      whileHover={{
        y: -2,
        boxShadow: `0 12px 30px rgba(5,7,15,0.6), 0 0 30px rgba(124,131,255,0.4)`,
      }}
    >
      <span
        aria-hidden="true"
        className={[
          "absolute right-3.5 top-3.5 h-[7px] w-[7px] rounded-full",
          status === "IN PROGRESS" ? "animate-pulse" : "",
        ].join(" ")}
        style={{ background: accent, boxShadow: `0 0 12px ${accent}` }}
      />
      <div className="relative z-10 pr-5">
        <h4 className="text-[15.5px] font-medium leading-snug text-[#e5e8ff]">{title}</h4>
        {description ? (
          <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-snug text-[#9aa6c4]">{description}</p>
        ) : null}
        {(tags?.length || depTitles?.length || due !== "none") ? (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {due !== "none" ? (
              <span
                className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${DUE_TONES[due]}`}
              >
                {formatDueLabel(dueDate, new Date())}
              </span>
            ) : null}
            {(tags ?? []).map((tag) => (
              <span
                key={tag}
                className="rounded-md border border-[rgba(165,175,255,0.16)] bg-[rgba(124,131,255,0.13)] px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.07em] text-[#a5afff]"
              >
                {tag}
              </span>
            ))}
            {(depTitles ?? []).map((dep) => (
              <span
                key={dep}
                className="rounded-md border border-[rgba(165,175,255,0.16)] bg-[rgba(124,131,255,0.13)] px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.07em] text-[#a5afff]"
              >
                &#8627; {dep.length > 18 ? `${dep.slice(0, 18)}…` : dep}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {hasQuickActions ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-wrap justify-end gap-3 rounded-b-[15px] bg-gradient-to-t from-[#12142b] via-[#12142b]/85 to-transparent px-4 pb-4 pt-8 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
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
