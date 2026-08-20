import React, { useCallback, useEffect, useRef, useState } from "react";
import { execute, type CommandResult } from "../lib/commands";
import type { Task } from "../hooks/useLocalTasks";
import type { Cluster } from "../lib/clusters/clusters";
import { useToast } from "./Toast";

interface AskFlowPanelProps {
  open: boolean;
  onClose: () => void;
  tasks: Task[];
  onApply: (next: Task[]) => void;
  clusters: Cluster[];
  activeClusterId: string | null;
  onSwitchCluster: (id: string) => void;
}

/**
 * The four things worth learning, phrased the way someone would actually say
 * them. Clicking one runs it, which teaches the grammar faster than any
 * sentence explaining the grammar.
 */
const EXAMPLES = [
  "what's open",
  "what's rotting",
  "add pay the invoice",
  "move the auth thing to done",
] as const;

/**
 * Plain-English commands over the board: "move the auth thing to done",
 * "what's rotting". Same parse -> resolve -> run path the MCP server uses,
 * so anything it can do is board-only and always refusable/undoable.
 */
export default function AskFlowPanel({
  open,
  onClose,
  tasks,
  onApply,
  clusters,
  activeClusterId,
  onSwitchCluster,
}: AskFlowPanelProps) {
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

  const runExample = (example: string) => {
    setPrompt(example);
    submit(example);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    submit(prompt);
  };

  const submit = (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    const outcome = execute(text, tasks, Date.now(), {
      clusters,
      ...(activeClusterId ? { activeClusterId } : {}),
    });
    setResult(outcome);
    if (outcome.undo) {
      onApply(outcome.tasks);
      setUndoBoard(outcome.undo);
      show(outcome.message, { variant: "success" });
    }
    // "switch to gardening" changes nothing on the board, so it reports the
    // cluster to show rather than a new task list.
    if (outcome.activeClusterId) {
      onSwitchCluster(outcome.activeClusterId);
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
          <div>
            <p
              id="askflow-title"
              className="text-sm font-semibold uppercase tracking-wide text-slate-300"
            >
              Ask Flow
            </p>
            {/* Says what it is before anyone types a question at it. The name
                promises a conversation; this is a parser with five verbs, and
                letting someone find that out by being refused is a bad way to
                meet a feature. */}
            <p className="mt-1 text-xs text-slate-500">
              Tell the board what to do, in your own words. Runs on this
              machine — no model, no waiting.
            </p>
          </div>
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

        {/* Real commands, one click away. The fastest way to learn what this
            understands is to watch it work once. */}
        {!result ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => runExample(example)}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-slate-400 transition hover:border-white/25 hover:text-white"
              >
                {example}
              </button>
            ))}
          </div>
        ) : null}

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
            It can move, add and list tasks, and set them aside in the Dark
            Forest. It cannot reach your colours, your galaxy or your journal —
            those are yours alone. Everything it does can be undone.
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
