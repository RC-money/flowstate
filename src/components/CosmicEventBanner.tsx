import React from "react";

interface CosmicEventBannerProps {
  event: { label: string; message: string } | null;
  alertsEnabled: boolean;
  onToggleAlerts?: () => void;
}

const CosmicEventBanner: React.FC<CosmicEventBannerProps> = ({ event, alertsEnabled, onToggleAlerts }) => {
  if (!event) return null;
  return (
    <div className="mt-4 rounded-3xl border border-amber-200/40 bg-gradient-to-r from-amber-500/20 to-pink-500/10 px-6 py-4 text-amber-100 shadow-[0_20px_60px_rgba(251,146,60,0.25)] backdrop-blur">
      <p className="text-xs uppercase tracking-[0.45em] text-amber-100/80">Cosmic Event</p>
      <div className="mt-2 flex flex-col gap-2 text-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-amber-100/70">{event.label}</p>
          <p className="text-base font-semibold">{event.message}</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-amber-100/70">
          <span>Universe weather shift</span>
          {onToggleAlerts ? (
            <button
              type="button"
              onClick={onToggleAlerts}
              className={[
                "rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] transition",
                alertsEnabled
                  ? "border-amber-200/70 text-amber-50"
                  : "border-amber-200/30 text-amber-200/60",
              ].join(" ")}
            >
              {alertsEnabled ? "Alerts On" : "Alerts Off"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default CosmicEventBanner;
