import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Task } from "../App";

type RichTask = Task & { description?: string };

interface TaskModalProps {
  mode: "new" | "edit";
  initialTask?: RichTask | null;
  onSave: (task: RichTask) => void;
  onClose: () => void;
}

const defaultStatus: Task["status"] = "TO-DO";

export default function TaskModal({
  mode,
  initialTask,
  onSave,
  onClose,
}: TaskModalProps) {
  const [title, setTitle] = useState(initialTask?.title ?? "");
  const [description, setDescription] = useState(initialTask?.description ?? "");
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTitle(initialTask?.title ?? "");
    setDescription(initialTask?.description ?? "");
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

    const payload: RichTask = {
      id:
        initialTask?.id ??
        (typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `task-${Date.now()}`),
      status: initialTask?.status ?? defaultStatus,
      title: title.trim(),
      description: description.trim(),
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
        className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#111933]/95 p-8 shadow-2xl shadow-indigo-950/40"
      >
        <div className="space-y-6">
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
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              placeholder="What needs attention?"
              required
            />
          </label>

          <label className="block text-sm font-medium text-slate-200">
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-2 min-h-[120px] w-full resize-y rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              placeholder="Add context, acceptance criteria, or links"
            />
          </label>
        </div>

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base font-medium text-slate-100 transition hover:bg-white/10 sm:w-auto"
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
      </form>
    </div>
  );
}
