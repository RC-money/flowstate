import React, { useCallback, useEffect, useRef, useState } from "react";
import { execute, type CommandResult } from "../lib/commands";
import type { Task } from "../hooks/useLocalTasks";
import { useToast } from "./Toast";

interface AskFlowPanelProps {
  open: boolean;
  onClose: () => void;
  tasks: Task[];
  onApply: (next: Task[]) => void;
}

/**
 * Plain-English commands over the board: "move the auth thing to done",
 * "what's rotting". Same parse -> resolve -> run path the MCP server uses,
 * so anything it can do is board-only and always refusable/undoable.
 */
export default function AskFlowPanel({ open, onClose, tasks, onApply }: AskFlowPanelProps) {
  const { show } = useToast();
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<CommandResult | null>(null);
  const [undoBoard, setUndoBoard] = useState<Task[] | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setPrompt("");
      setResult(null);
      inputRef.current?.focus();
    }
  }, [open]);

  const closePanel = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePanel();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, closePanel]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const text = prompt.trim();
    if (!text) return;
    const outcome = execute(text, tasks, Date.now());
    setResult(outcome);
    if (outcome.undo) {
      onApply(outcome.tasks);
      setUndoBoard(outcome.undo);
      show(outcome.message, { variant: "success" });
    }
    setPrompt("");
  };

  const handleUndo = () => {
    if (!undoBoard) return;
    onApply(undoBoard);
    setUndoBoard(null);
    setResult(null);
    show("Reverted.", { variant: "success" });
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/60 pt-[18vh] backdrop-blur-sm p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) closePanel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="askflow-title"
        className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#0B1220]/95 p-5 shadow-2xl shadow-black/60"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p
            id="askflow-title"
            className="text-sm font-semibold uppercase tracking-wide text-slate-300"
          >
            Ask Flow
          </p>
          <button
            type="button"
            onClick={closePanel}
            className="rounded-xl border border-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-200 transition hover:border-white/40 hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4">
          <input
            ref={inputRef}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              // Explicit: implicit form submission is skipped by some
              // drivers/webviews, and this input is the whole feature.
              if (event.key === "Enter") handleSubmit(event);
            }}
            placeholder='Try "what&apos;s open" or "move the auth thing to done"'
            className="w-full rounded-2xl border border-white/10 bg-[#050B18]/90 p-3 text-sm text-[#E6EDF3] placeholder:text-slate-500 focus:border-white/30 focus:outline-none"
          />
        </form>

        {result ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
            <p>{result.message}</p>
            {result.listed?.length ? (
              <ul className="mt-3 space-y-1.5">
                {result.listed.map((task) => (
                  <li key={task.id} className="flex items-baseline gap-2 text-slate-300">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      {task.status}
                    </span>
                    {task.title}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 text-xs text-slate-500">
            Board commands only — move, list, rest, restore, add. Colors, the
            galaxy, and your journal are yours alone.
          </p>
        )}

        {undoBoard ? (
          <button
            type="button"
            onClick={handleUndo}
            className="mt-3 rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:border-white/30 hover:bg-white/5"
          >
            Undo last change
          </button>
        ) : null}
      </div>
    </div>
  );
}
