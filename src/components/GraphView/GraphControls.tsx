import React from "react";

type ClusterMode = "none" | "column" | "tag";

export interface GraphControlPrefs {
  clusterMode: ClusterMode;
  showTemporal: boolean;
}

interface GraphControlsProps {
  prefs?: GraphControlPrefs;
  onChange: (partial: Partial<GraphControlPrefs>) => void;
  strongForce: number;
  chargeForce: number;
  onStrongForceChange(value: number): void;
  onChargeForceChange(value: number): void;
  onReset(): void;
  onToggleFreeze(): void;
  isFrozen?: boolean;
}

const modeLabels: Record<ClusterMode, string> = {
  none: "None",
  column: "Column",
  tag: "Tag",
};

const GraphControls: React.FC<GraphControlsProps> = ({
  prefs,
  onChange,
  strongForce,
  chargeForce,
  onStrongForceChange,
  onChargeForceChange,
  onReset,
  onToggleFreeze,
  isFrozen = false,
}) => {
  const { clusterMode = "none", showTemporal = false } = prefs ?? {};

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-100">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-300">
          Cluster
        </span>
        <div
          role="group"
          aria-label="Cluster mode"
          className="inline-flex rounded-xl bg-white/5 p-1"
        >
          {(Object.keys(modeLabels) as ClusterMode[]).map((mode) => {
            const isActive = clusterMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => onChange({ clusterMode: mode })}
                aria-pressed={isActive}
                className={[
                  "px-4 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition",
                  isActive
                    ? "bg-white text-[#0B1220]"
                    : "text-slate-300 hover:text-white",
                ].join(" ")}
              >
                {modeLabels[mode]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-300">
          Temporal Links
        </span>
        <button
          type="button"
          onClick={() => onChange({ showTemporal: !showTemporal })}
          aria-pressed={showTemporal}
          className={[
            "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide transition",
            showTemporal
              ? "border-white/40 bg-white/20 text-white"
              : "border-white/10 text-slate-300 hover:border-white/30 hover:text-white",
          ].join(" ")}
        >
          {showTemporal ? "On" : "Off"}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Strong Force",
            value: strongForce,
            min: -120,
            max: -20,
            step: 5,
            onChange: onStrongForceChange,
          },
          {
            label: "Charge Force",
            value: chargeForce,
            min: -140,
            max: -10,
            step: 5,
            onChange: onChargeForceChange,
          },
        ].map((control) => (
          <label
            key={control.label}
            className="flex flex-col gap-2 rounded-xl border border-white/10 bg-[#0F172A]/40 p-3 text-xs font-semibold uppercase tracking-wide text-slate-300"
          >
            {control.label}
            <input
              type="range"
              min={control.min}
              max={control.max}
              step={control.step}
              value={control.value}
              onChange={(event) => control.onChange(Number(event.currentTarget.value))}
              className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-white"
            />
            <span className="text-right text-[10px] text-slate-400">{control.value}</span>
          </label>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          onClick={onReset}
          className="rounded-xl border border-white/20 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white transition hover:border-white/40 hover:bg-white/10"
        >
          Reset Layout
        </button>
        <button
          type="button"
          onClick={onToggleFreeze}
          className="rounded-xl border border-white/20 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white transition hover:border-white/40 hover:bg-white/10"
        >
          {isFrozen ? "Unfreeze" : "Freeze"}
        </button>
      </div>
    </div>
  );
};

export default GraphControls;
