import React from "react";
import { BIOME_REGISTRY, useBiomeState } from "../engine/biomes";

const IntentSurface: React.FC = () => {
  const { biome, params, setBiome } = useBiomeState();

  return (
    <section
      className="relative mb-8 rounded-3xl border border-white/10 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.45)] transition-all"
      style={{
        backgroundImage: params.background,
      }}
    >
      <div className="absolute inset-0 overflow-hidden rounded-3xl">
        <div
          className="absolute inset-0 opacity-40 blur-3xl transition-transform"
          style={{
            background: `radial-gradient(circle at 20% 20%, rgba(255,255,255,0.15), transparent 60%)`,
            transform: `scale(${0.95 + params.ambientParticles.speed * 0.05})`,
          }}
          aria-hidden="true"
        />
      </div>
      <div className="relative z-10 text-center text-slate-100">
        <p className="text-sm uppercase tracking-[0.3em] text-white/70">Intent Surface</p>
        <h2 className="mt-2 text-2xl font-semibold">
          Let the galaxy feel the way you feel.
        </h2>
        <p className="mt-1 text-sm text-white/70">
          Choose a ritual. The universe will shift its heat, drift, and clustering to match.
        </p>
      </div>
      <div className="relative z-10 mt-6 grid gap-4 text-left md:grid-cols-3">
        {Object.values(BIOME_REGISTRY).map((option) => {
          const isActive = option.id === biome;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setBiome(option.id)}
              className={[
                "group flex h-full flex-col justify-between rounded-2xl border px-5 py-6 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/80",
                isActive
                  ? "border-white/70 bg-white/15 text-white shadow-inner shadow-white/15"
                  : "border-white/20 bg-black/20 text-slate-200 hover:border-white/50 hover:bg-black/30",
              ].join(" ")}
            >
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-white/60">{option.id}</p>
                <h3 className="mt-3 text-xl font-semibold">{option.label}</h3>
                <p className="mt-2 text-sm text-white/80">{option.description}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-3 text-xs text-white/70">
                <span className="rounded-full border border-white/30 px-3 py-1">
                  Heat sensitivity: {(option.heatSensitivity * 100).toFixed(0)}%
                </span>
                <span className="rounded-full border border-white/30 px-3 py-1">
                  Cluster threshold: {(option.clusterThreshold * 100).toFixed(0)}%
                </span>
                <span className="rounded-full border border-white/30 px-3 py-1">
                  Particles: {(option.ambientParticles.speed * 100).toFixed(0)}%
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default IntentSurface;
