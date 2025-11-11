import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const mockAskFlow = async (prompt: string): Promise<string> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(
        `Flowstate draft: "${prompt.slice(0, 60)}"${
          prompt.length > 60 ? "…" : ""
        }\n– summarize blockers, surface dependencies, ship.`
      );
    }, 650);
  });
};

type AskFlowPanelProps = {
  open: boolean;
  onClose: () => void;
  askFlow?: (query: string) => Promise<string>;
};

const isAIEnabled = () =>
  typeof window !== "undefined" && (window as typeof window & {
    __FLOWSTATE_ENABLE_AI?: boolean;
  }).__FLOWSTATE_ENABLE_AI === true;

export default function AskFlowPanel({
  open,
  onClose,
  askFlow = mockAskFlow,
}: AskFlowPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  const aiEnabled = useMemo(isAIEnabled, [open]);

  const closePanel = useCallback(() => {
    setLoading(false);
    setError(null);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    lastFocusedRef.current = document.activeElement as HTMLElement | null;
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
    setPrompt("");
    setAnswer(null);
    setError(null);
  }, [open]);

  useEffect(() => {
    if (open) return;
    const last = lastFocusedRef.current;
    if (last) {
      last.focus();
      lastFocusedRef.current = null;
    }
  }, [open]);

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

  const handleSubmit = async () => {
    if (!prompt.trim() || !aiEnabled) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    try {
      const result = await askFlow(prompt.trim());
      setAnswer(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went sideways—try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      closePanel();
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="askflow-title"
        ref={dialogRef}
        className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#0B1220]/95 p-5 shadow-2xl shadow-black/60 focus:outline-none"
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
            <p className="text-xs text-slate-500">
              Draft summaries, surface blockers, simulate strategy.
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
        <div className="mt-4">
          <label
            htmlFor="askflow-input"
            className="text-xs font-semibold uppercase tracking-wide text-slate-400"
          >
            Prompt
          </label>
          <textarea
            ref={textareaRef}
            id="askflow-input"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            disabled={loading}
            rows={4}
            placeholder={
              aiEnabled
                ? "e.g., Summarize tasks blocked in IN PROGRESS."
                : "AI assist is paused. Flip the feature flag to enable."
            }
            className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-[#050B18]/90 p-3 text-sm text-[#E6EDF3] placeholder:text-slate-500 focus:border-white/30 focus:outline-none"
          />
          {!aiEnabled ? (
            <p className="mt-2 text-xs text-amber-300">
              Set <code>window.__FLOWSTATE_ENABLE_AI = true</code> to activate Flow.
            </p>
          ) : null}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!aiEnabled || loading || !prompt.trim()}
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200 transition disabled:cursor-not-allowed disabled:opacity-40 hover:border-white/40 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            {loading ? "Sending…" : "Send"}
          </button>
          <button
            type="button"
            onClick={() => {
              setPrompt("");
              setAnswer(null);
              setError(null);
              setLoading(false);
            }}
            className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:border-white/30 hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
          >
            Reset
          </button>
        </div>
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
          {!aiEnabled ? (
            <p className="text-slate-400">
              Flow assist is cooling off. Leave your prompt, and we’ll be ready when
              the feature flag flips.
            </p>
          ) : loading ? (
            <p className="animate-pulse text-slate-400">Synthesizing…</p>
          ) : error ? (
            <p className="text-rose-300">{error}</p>
          ) : answer ? (
            <pre className="whitespace-pre-wrap text-[#E6EDF3]">{answer}</pre>
          ) : (
            <p className="text-slate-400">Responses land here.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export { mockAskFlow };
