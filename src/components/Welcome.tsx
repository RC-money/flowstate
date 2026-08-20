import React from "react";

interface WelcomeProps {
  onChoose: (startEmpty: boolean) => void;
}

/**
 * Shown exactly once, on first launch. The galaxy metaphor is the product;
 * nobody should have to discover it by accident three days in.
 */
const Welcome: React.FC<WelcomeProps> = ({ onChoose }) => (
  <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-[#03040c]/80 p-4 backdrop-blur-md">
    <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0B1220]/95 p-8 shadow-2xl shadow-black/60">
      <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-indigo-300">
        Welcome to Flowstate
      </p>
      <h2 className="mt-3 text-2xl font-semibold text-white">
        Your work is a galaxy.
      </h2>
      <ul className="mt-5 space-y-3 text-sm text-slate-300">
        <li>
          <span className="text-white">Tasks are planets.</span> Finish one and it
          becomes a star in your sky — permanently.
        </li>
        <li>
          <span className="text-white">Neglect dims things gently.</span> Untouched
          planets fade instead of shouting at you.
        </li>
        <li>
          <span className="text-white">Setting something aside is honest rest.</span>{" "}
          Admitting "not now" moves a task there. Nothing is ever deleted for you.
        </li>
        <li>
          <span className="text-white">It's only you here.</span> No accounts, no
          sync, no one watching. Your board lives on this machine.
        </li>
      </ul>
      <div className="mt-7 flex gap-3">
        <button
          type="button"
          onClick={() => onChoose(false)}
          className="rounded-xl border border-indigo-400/40 bg-indigo-500/20 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-indigo-200 transition hover:border-indigo-300/60 hover:bg-indigo-500/30"
        >
          Explore a sample galaxy
        </button>
        <button
          type="button"
          onClick={() => onChoose(true)}
          className="rounded-xl border border-white/15 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:border-white/40 hover:bg-white/5"
        >
          Start with empty space
        </button>
      </div>
    </div>
  </div>
);

export default Welcome;
