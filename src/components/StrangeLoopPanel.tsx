import React from "react";
import type { StrangeLoopQuestion } from "../engine/strangeLoop";

interface StrangeLoopPanelProps {
  question: StrangeLoopQuestion | null;
  personaName?: string;
  onRefresh?: () => void;
  onReflect?: (response: string) => void;
}

const StrangeLoopPanel: React.FC<StrangeLoopPanelProps> = ({ question, personaName, onRefresh, onReflect }) => {
  const [reflection, setReflection] = React.useState("");
  if (!question) {
    return null;
  }
  const handleSubmit = () => {
    if (!reflection.trim()) return;
    onReflect?.(reflection.trim());
    setReflection("");
  };
  return (
    <div className="mt-6 rounded-3xl border border-white/15 bg-white/5 px-6 py-5 text-white shadow-[0_25px_80px_rgba(0,0,0,0.45)] backdrop-blur">
      <p className="text-xs uppercase tracking-[0.4em] text-white/60">Strange Loop</p>
      <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-lg font-semibold">{question.message}</p>
          <p className="mt-1 text-sm text-white/70">
            {personaName ? `${personaName} is listening.` : "The universe is watching your orbit."}
          </p>
        </div>
        {onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            className="self-start rounded-full border border-white/30 px-5 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/70 hover:text-white"
          >
            Ask Again
          </button>
        ) : null}
      </div>
      {onReflect ? (
        <div className="mt-4">
          <textarea
            value={reflection}
            onChange={(event) => setReflection(event.target.value)}
            rows={3}
            placeholder="Answer the Strange Loop…"
            className="w-full rounded-2xl border border-white/15 bg-black/30 p-3 text-sm text-white placeholder:text-white/40 focus:border-white/60 focus:outline-none"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!reflection.trim()}
              className="rounded-full border border-white/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition disabled:cursor-not-allowed disabled:border-white/10 disabled:text-white/30 hover:border-white/60"
            >
              Log Reflection
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default StrangeLoopPanel;
