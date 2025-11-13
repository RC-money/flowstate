import React, { useMemo, useState } from "react";
import { useBiome } from "../engine/biomes";

export type CelestialKind = "sun" | "moon" | "asteroid" | "comet" | "gas-giant";

export interface GenesisPayload {
  title: string;
  description: string;
  kind: CelestialKind;
  position: { x: number; y: number };
}

interface GenesisForgeProps {
  onGenesis: (payload: GenesisPayload) => void;
}

const KIND_META: Record<CelestialKind, { label: string; description: string }> = {
  sun: { label: "Sun", description: "Core mission. High gravity, high heat." },
  moon: { label: "Moon", description: "Cycles, reviews, reflective rituals." },
  asteroid: { label: "Asteroid", description: "Quick strike, low mass, easy win." },
  comet: { label: "Comet", description: "Exploratory arc, fades unless guided." },
  "gas-giant": { label: "Gas Giant", description: "Massive program, layered and slow." },
};

const CLARIFY_OPTIONS: CelestialKind[] = ["sun", "moon", "asteroid"];

const actionVerbs = ["ship", "launch", "deliver", "architect", "build", "deploy", "rewrite", "design"];
const reflectiveWords = ["review", "reflect", "journal", "learn", "study", "draft summary", "retro"];
const exploratoryWords = ["experiment", "explore", "map", "prototype", "spike"];

const analyzeNebula = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) {
    return { kind: "asteroid" as CelestialKind, confidence: 0, needsClarification: true, reasons: [] };
  }
  const wordCount = trimmed.split(/\s+/).length;
  const charCount = trimmed.length;
  const sentenceCount = (trimmed.match(/[.!?]/g) ?? []).length || 1;

  const scores: Record<CelestialKind, number> = {
    sun: 0.2,
    moon: 0.2,
    asteroid: 0.2,
    comet: 0.2,
    "gas-giant": 0.2,
  };

  if (wordCount > 160 || charCount > 900) {
    scores["gas-giant"] += 0.4;
  }
  if (sentenceCount > 5) {
    scores["gas-giant"] += 0.2;
  }
  if (wordCount < 25) {
    scores.asteroid += 0.5;
  }
  if (actionVerbs.some((verb) => trimmed.toLowerCase().includes(verb))) {
    scores.sun += 0.35;
  }
  if (reflectiveWords.some((word) => trimmed.toLowerCase().includes(word))) {
    scores.moon += 0.35;
  }
  if (exploratoryWords.some((word) => trimmed.toLowerCase().includes(word))) {
    scores.comet += 0.35;
  }
  if (trimmed.includes("?")) {
    scores.moon += 0.1;
  }

  const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]) as Array<[CelestialKind, number]>;
  const [bestKind, bestScore] = entries[0];
  const secondScore = entries[1]?.[1] ?? 0;
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  const confidence = bestScore / total;
  const needsClarification = confidence < 0.4 || Math.abs(bestScore - secondScore) < 0.1;
  return {
    kind: bestKind,
    confidence,
    needsClarification,
  };
};

const deriveTitle = (text: string): string => {
  const trimmed = text.trim();
  if (!trimmed) return "Untitled Nebula";
  const firstSentence = trimmed.split(/\n+/)[0].split(/[.!?]/)[0];
  return firstSentence.slice(0, 80).trim() || "Untitled Nebula";
};

const generatePosition = (kind: CelestialKind): { x: number; y: number } => {
  const radiusBase = {
    sun: 80,
    moon: 200,
    asteroid: 260,
    comet: 320,
    "gas-giant": 140,
  }[kind];
  const radius = radiusBase + Math.random() * 60;
  const angle = Math.random() * Math.PI * 2;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
};

const GenesisForge: React.FC<GenesisForgeProps> = ({ onGenesis }) => {
  const { tokens } = useBiome();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [clarifyingKind, setClarifyingKind] = useState<CelestialKind | null>(null);
  const [description, setDescription] = useState("");
  const analysis = useMemo(() => analyzeNebula(text), [text]);
  const resolvedKind = clarifyingKind ?? analysis.kind;
  const disabled = !text.trim() || (analysis.needsClarification && !clarifyingKind);

  const handleSubmit = () => {
    if (disabled) return;
    const title = deriveTitle(text);
    onGenesis({
      title,
      description: description || text.trim(),
      kind: resolvedKind,
      position: generatePosition(resolvedKind),
    });
    setText("");
    setDescription("");
    setClarifyingKind(null);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-white/20 px-6 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:border-white/60 hover:bg-white/10"
      >
        Genesis
      </button>
      {open ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 backdrop-blur">
          <div className="relative w-full max-w-3xl overflow-hidden rounded-[32px] border border-white/10 bg-[#050914]/95 p-6 shadow-[0_40px_120px_rgba(0,0,0,0.6)]">
            <div
              className="absolute inset-0 pointer-events-none opacity-80 blur-3xl"
              style={{
                background: `radial-gradient(circle at 30% 20%, ${tokens.accent}22, transparent 55%), radial-gradient(circle at 80% 30%, #ffffff12, transparent 60%)`,
                animation: "swirlNebula 18s linear infinite",
              }}
              aria-hidden="true"
            />
            <div className="relative z-10 space-y-6 text-white">
              <header className="text-center space-y-2">
                <p className="text-xs uppercase tracking-[0.4em] text-white/60">Genesis Forge</p>
                <h2 className="text-3xl font-semibold">Nebula Condensation</h2>
                <p className="text-sm text-white/70">
                  Dump raw thought. The Shaper will guess the celestial form. Choose wisely if you disagree.
                </p>
              </header>
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Describe the matter. No structure, just the storm."
                className="w-full rounded-2xl border border-white/15 bg-black/30 p-4 text-base text-white placeholder:text-white/40 focus:border-white/60 focus:outline-none"
                rows={5}
              />
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Optional notes or acceptance criteria."
                className="w-full rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-white placeholder:text-white/30 focus:border-white/60 focus:outline-none"
                rows={3}
              />
              <div className="grid gap-3 md:grid-cols-5">
                {(Object.keys(KIND_META) as CelestialKind[]).map((option) => {
                  const isActive = option === resolvedKind;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setClarifyingKind(option)}
                      className={[
                        "rounded-2xl border px-3 py-3 text-left transition hover:border-white/60",
                        isActive ? "border-white/70 bg-white/10" : "border-white/20 bg-black/20",
                      ].join(" ")}
                    >
                      <p className="text-xs uppercase tracking-[0.3em] text-white/50">{option}</p>
                      <p className="mt-2 text-lg font-semibold">{KIND_META[option].label}</p>
                      <p className="mt-1 text-xs text-white/70">{KIND_META[option].description}</p>
                    </button>
                  );
                })}
              </div>
              {analysis.needsClarification && !clarifyingKind ? (
                <div className="rounded-2xl border border-amber-200/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  <p className="text-xs uppercase tracking-[0.3em]">Clarify</p>
                  <p className="mt-1">
                    Is this a core mission, a quick hit, or a subtask? Select Sun, Comet, Moon, or Asteroid above.
                  </p>
                </div>
              ) : null}
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={disabled}
                  className="rounded-full border border-white/40 px-8 py-3 text-xs font-semibold uppercase tracking-[0.4em] transition disabled:cursor-not-allowed disabled:border-white/10 disabled:text-white/30"
                >
                  Condense
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setClarifyingKind(null);
                  }}
                  className="text-xs uppercase tracking-[0.3em] text-white/60 hover:text-white"
                >
                  close
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <style>{`
        @keyframes swirlNebula {
          0% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(180deg) scale(1.05); }
          100% { transform: rotate(360deg) scale(1); }
        }
      `}</style>
    </>
  );
};

export default GenesisForge;
