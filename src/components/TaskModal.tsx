import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Task } from "../App";
import { addSubtask, removeSubtask, toggleSubtask, type Subtask } from "../lib/subtasks";
import { isTerminal, terminalColumnId, type Column } from "../lib/columns/columns";

type RichTask = Task & { description?: string };

interface TaskModalProps {
  mode: "new" | "edit";
  initialTask?: RichTask | null;
  onSave: (task: RichTask) => void;
  onClose: () => void;
  onMove?: (taskId: string, next: Task["status"]) => void;
  onMarkDone?: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
  onEther?: (taskId: string) => void;
  /** The board this task lives on. Its last column is the finish line. */
  columns: Column[];
}

const defaultStatus: Task["status"] = "TO-DO";

export default function TaskModal({
  mode,
  initialTask,
  onSave,
  onClose,
  onMove,
  onMarkDone,
  onDelete,
  onEther,
  columns,
}: TaskModalProps) {
  const [title, setTitle] = useState(initialTask?.title ?? "");
  const [description, setDescription] = useState(initialTask?.description ?? "");
  const [status, setStatus] = useState<Task["status"]>(
    initialTask?.status ?? defaultStatus
  );
  // "Finished" is reaching the last column, whatever this board calls it.
  const finishLine = terminalColumnId(columns);
  const isFinished = isTerminal(columns, status);
  const [dueDate, setDueDate] = useState(initialTask?.dueDate ?? "");
  const [tagsDraft, setTagsDraft] = useState((initialTask?.tags ?? []).join(", "));
  const [subtasks, setSubtasks] = useState<Subtask[]>(initialTask?.subtasks ?? []);
  const [subtaskDraft, setSubtaskDraft] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTitle(initialTask?.title ?? "");
    setDescription(initialTask?.description ?? "");
    setStatus(initialTask?.status ?? defaultStatus);
    setDueDate(initialTask?.dueDate ?? "");
    setTagsDraft((initialTask?.tags ?? []).join(", "));
    setSubtasks(initialTask?.subtasks ?? []);
    setSubtaskDraft("");
  }, [initialTask, mode]);

  useEffect(() => {
    titleInputRef.current?.focus();
    titleInputRef.current?.select();
  }, [initialTask, mode]);

  const saveDisabled = !title.trim();

  const modeLabel = useMemo(
    () => (mode === "edit" ? "Edit task" : "New task"),
    [mode]
  );

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saveDisabled) return;

    const now = Date.now();
    const payload: RichTask = {
      id:
        initialTask?.id ??
        (typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `task-${Date.now()}`),
      status,
      title: title.trim(),
      description: description.trim(),
      createdAt: initialTask?.createdAt ?? now,
      updatedAt: now,
      // Always present, so clearing the field actually clears it -- App merges
      // edits with {...existing, ...payload}, and an omitted key would preserve
      // the old date instead of removing it.
      dueDate: dueDate || undefined,
      subtasks: subtasks.length ? subtasks : undefined,
      tags: (() => {
        const parsed = Array.from(
          new Set(
            tagsDraft
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean)
          )
        );
        return parsed.length ? parsed : undefined;
      })(),
    };

    onSave(payload);
    onClose();
  };

  const handleFormKeyDown = (event: React.KeyboardEvent<HTMLFormElement>) => {
    const isTextarea = (event.target as HTMLElement | null)?.tagName === "TEXTAREA";
    if (event.key === "Enter" && !event.shiftKey && !isTextarea) {
      event.preventDefault();
      event.currentTarget.requestSubmit();
    }
  };

  const handleMoveStatus = (next: Task["status"]) => {
    setStatus(next);
    if (initialTask?.id && onMove) {
      onMove(initialTask.id, next);
    }
  };

  const handleMarkDone = () => {
    if (!finishLine) return;
    setStatus(finishLine);
    if (initialTask?.id) {
      onMarkDone?.(initialTask.id);
      onMove?.(initialTask.id, finishLine);
    }
  };

  const handleDelete = () => {
    if (!initialTask?.id || !onDelete) return;
    if (window.confirm("Delete this task? This cannot be undone.")) {
      onDelete(initialTask.id);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${modeLabel} modal`}
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/70 backdrop-blur-md transition-opacity"
        aria-label="Close task modal"
        onClick={onClose}
      />
      <form
        onSubmit={handleSubmit}
        onKeyDown={handleFormKeyDown}
        className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#111933]/95 p-6 shadow-2xl shadow-indigo-950/40"
      >
        <div className="space-y-3">
          <header>
            <p className="text-sm uppercase tracking-widest text-slate-400">
              {mode === "edit" ? "Update task" : "Create task"}
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">{modeLabel}</h2>
          </header>

          <label className="block text-sm font-medium text-slate-200">
            Title
            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-base text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              placeholder="What needs attention?"
              required
            />
          </label>

          <label className="block text-sm font-medium text-slate-200">
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-2 min-h-[64px] w-full resize-y rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-base text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              placeholder="Add context, acceptance criteria, or links"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-200">
              Tags
              <input
                type="text"
                value={tagsDraft}
                onChange={(event) => setTagsDraft(event.target.value)}
                placeholder="design, api"
                autoComplete="off"
                title="Comma separated — shared tags pull tasks together"
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-base text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              />
            </label>

            <label className="block text-sm font-medium text-slate-200">
              Due date
              <span className="ml-2 text-xs font-normal text-slate-500">optional</span>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-base text-white [color-scheme:dark] focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                />
                {dueDate ? (
                  <button
                    type="button"
                    onClick={() => setDueDate("")}
                    className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:border-white/30 hover:text-white"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            </label>
          </div>

          <div className="block text-sm font-medium text-slate-200">
            Subtasks
            <span className="ml-2 text-xs font-normal text-slate-500">
              {subtasks.length
                ? `${subtasks.filter((s) => s.done).length} of ${subtasks.length} lit`
                : "each one becomes a star"}
            </span>
            {subtasks.length ? (
              <ul className="mt-2 space-y-1.5">
                {subtasks.map((subtask) => (
                  <li key={subtask.id} className="flex items-center gap-2.5">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={subtask.done}
                      aria-label={`${subtask.done ? "Reopen" : "Complete"} ${subtask.title}`}
                      onClick={() => setSubtasks((prev) => toggleSubtask(prev, subtask.id, Date.now()))}
                      className={[
                        "text-base leading-none transition",
                        subtask.done
                          ? "text-[#f7e28b] [text-shadow:0_0_8px_rgba(247,226,139,0.8)]"
                          : "text-[#3d425f] hover:text-[#6b7799]",
                      ].join(" ")}
                    >
                      &#9733;
                    </button>
                    <span
                      className={[
                        "flex-1 text-sm",
                        subtask.done ? "text-slate-500 line-through" : "text-slate-200",
                      ].join(" ")}
                    >
                      {subtask.title}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${subtask.title}`}
                      onClick={() => setSubtasks((prev) => removeSubtask(prev, subtask.id))}
                      className="text-xs text-slate-600 transition hover:text-rose-300"
                    >
                      &#10005;
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={subtaskDraft}
                onChange={(event) => setSubtaskDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    setSubtasks((prev) => addSubtask(prev, subtaskDraft));
                    setSubtaskDraft("");
                  }
                }}
                placeholder="Add a subtask"
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              />
              <button
                type="button"
                onClick={() => {
                  setSubtasks((prev) => addSubtask(prev, subtaskDraft));
                  setSubtaskDraft("");
                }}
                className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:border-white/30 hover:text-white"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Move to
              </span>
              <div
                role="group"
                aria-label="Move task"
                className="inline-flex rounded-xl bg-white/5 p-1"
              >
                {columns.map((column) => {
                  const isActive = status === column.id;
                  return (
                    <button
                      key={column.id}
                      type="button"
                      onClick={() => handleMoveStatus(column.id)}
                      aria-pressed={isActive}
                      className={[
                        "px-4 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition",
                        isActive
                          ? "bg-white text-[#0B1220]"
                          : "text-slate-300 hover:text-white",
                      ].join(" ")}
                    >
                      {column.name}
                    </button>
                  );
                })}
              </div>
            </div>
            {mode === "edit" ? (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {isFinished && initialTask?.id && onEther ? (
                <button
                  type="button"
                  onClick={() => {
                    onEther(initialTask.id);
                    onClose();
                  }}
                  className="rounded-xl border border-[#c9d0ff]/40 bg-gradient-to-r from-[#5b5cf0]/20 to-[#a5afff]/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[#c9d0ff] transition hover:border-[#c9d0ff]/80 hover:text-white"
                >
                  &#10024; Send into the Ether
                </button>
              ) : null}
              {!isFinished ? (
                <button
                  type="button"
                  className="rounded-xl border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:border-white/40 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={handleMarkDone}
                >
                  Mark done
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleDelete}
                disabled={!initialTask?.id || !onDelete}
                className="rounded-xl border border-red-400/30 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-red-300 transition hover:border-red-300 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Delete
              </button>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-base font-medium text-slate-100 transition hover:bg-white/10 sm:w-auto"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="w-full rounded-xl bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-400 px-6 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-indigo-500/30 transition hover:opacity-90 sm:w-auto"
              disabled={saveDisabled}
            >
              Save
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
