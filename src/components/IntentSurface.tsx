import React from "react";
import { BIOME_REGISTRY, useBiome } from "../engine/biomes";

type ColorOption = {
  intent: "progress" | "clarity" | "lost" | "overwhelm";
  biomeId: keyof typeof BIOME_REGISTRY;
  name: string;
  swatches: [string, string, string];
};

// A color picker shows colors. The old intent framing ("I'm overwhelmed",
// heat-sensitivity percentages) was the last remnant of the retired
// confessional system -- the biome ids underneath are unchanged.
const OPTIONS: ColorOption[] = [
  { intent: "progress", biomeId: "hunter", name: "Ember", swatches: ["#fb923c", "#7c2d12", "#05070f"] },
  { intent: "clarity", biomeId: "mentor", name: "Ocean", swatches: ["#60a5fa", "#5b5cf0", "#090a19"] },
  { intent: "overwhelm", biomeId: "archivist", name: "Violet", swatches: ["#a5afff", "#6366f1", "#08091a"] },
];

const IntentSurface: React.FC = () => {
  const { intent, setIntent } = useBiome();

  return (
    <section className="mt-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/50">Colors</p>
      <div className="mt-3 grid gap-2.5">
        {OPTIONS.map((option) => {
          const isActive = option.intent === intent;
          const accent = BIOME_REGISTRY[option.biomeId].accent;
          return (
            <button
              key={option.intent}
              type="button"
              onClick={() => setIntent(option.intent)}
              aria-pressed={isActive}
              className={[
                "flex items-center justify-between gap-4 rounded-2xl border px-4 py-3.5 text-left transition",
                isActive
                  ? "border-white/50 bg-white/10"
                  : "border-white/10 bg-black/20 hover:border-white/30",
              ].join(" ")}
            >
              <span className="flex items-center gap-3">
                <span className="flex" aria-hidden="true">
                  {option.swatches.map((color, i) => (
                    <span
                      key={color}
                      className="h-6 w-6 rounded-full border border-white/20"
                      style={{ background: color, marginLeft: i === 0 ? 0 : -8 }}
                    />
                  ))}
                </span>
                <span className="text-sm font-semibold text-white">{option.name}</span>
              </span>
              {isActive ? (
                <span
                  className="font-mono text-[10px] uppercase tracking-wide"
                  style={{ color: accent }}
                >
                  Active
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default IntentSurface;
