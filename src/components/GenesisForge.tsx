import React, { useCallback, useMemo, useState } from "react";
import { useBiomeState } from "../engine/biomes";

type CelestialKind = "sun" | "moon" | "asteroid";

export interface GenesisPayload {
  title: string;
  kind: CelestialKind;
}

interface GenesisForgeProps {
  onGenesis: (payload: GenesisPayload) => void;
}

const KIND_META: Record<CelestialKind, { label: string; description: string }> = {
  sun: { label: "Sun", description: "Core work. Demands heat and focus." },
  moon: { label: "Moon", description: "Cycles, reflections, follow-through." },
  asteroid: { label: "Asteroid", description: "Small matter, quick strike." },
};

const GenesisForge: React.FC<GenesisForgeProps> = ({ onGenesis }) => {
  const { params } = useBiomeState();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [kind, setKind] = useState<CelestialKind>("sun");

  const disabled = text.trim().length === 0;
  const accent = params.accent ?? "#FFFFFF";

  const handleSubmit = useCallback(() => {
    if (disabled) return;
    onGenesis({ title: text.trim(), kind });
    setText("");
    setKind("sun");
    setOpen(false);
  }, [disabled, onGenesis, text, kind]);

  const cloudStyle = useMemo(
    () => ({
      background: `radial-gradient(circle at 30% 20%, ${accent}22, transparent 55%), radial-gradient(circle at 80% 30%, #ffffff1f, transparent 60%), radial-gradient(circle at 50% 80%, ${accent}15, transparent 65%)`,
      animation: open ? "swirlNebula 18s linear infinite" : undefined,
    }),
    [accent, open]
  );

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
          <div className="relative w-full max-w-2xl overflow-hidden rounded-[32px] border border-white/10 bg-[#050914]/95 p-6 shadow-[0_40px_120px_rgba(0,0,0,0.6)]">
            <div
              className="absolute inset-0 pointer-events-none opacity-80 blur-3xl"
              style={cloudStyle}
              aria-hidden="true"
            />
            <div className="relative z-10 space-y-6 text-white">
              <header className="text-center space-y-2">
                <p className="text-xs uppercase tracking-[0.4em] text-white/60">Nebula Ritual</p>
                <h2 className="text-3xl font-semibold">What is this?</h2>
                <p className="text-sm text-white/70">
                  Whisper raw thought into the Nebula. Let the Shaper decide if it’s a Sun, Moon, or Asteroid.
                </p>
              </header>
              <div>
                <textarea
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder="Describe the matter…"
                  className="w-full rounded-2xl border border-white/15 bg-black/30 p-4 text-base text-white placeholder:text-white/40 focus:border-white/60 focus:outline-none"
                  rows={4}
                />
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {(Object.keys(KIND_META) as CelestialKind[]).map((option) => {
                  const isActive = option === kind;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setKind(option)}
                      className={[
                        "rounded-2xl border px-4 py-3 text-left transition hover:border-white/60",
                        isActive ? "border-white/70 bg-white/10" : "border-white/20 bg-black/20",
                      ].join(" ")}
                    >
                      <p className="text-xs uppercase tracking-[0.3em] text-white/60">{option}</p>
                      <p className="mt-2 text-lg font-semibold">{KIND_META[option].label}</p>
                      <p className="mt-1 text-sm text-white/70">{KIND_META[option].description}</p>
                    </button>
                  );
                })}
              </div>
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
                  onClick={() => setOpen(false)}
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
          50% { transform: rotate(180deg) scale(1.1); }
          100% { transform: rotate(360deg) scale(1); }
        }
      `}</style>
    </>
  );
};

export default GenesisForge;
