import React from "react";

interface CosmicEventBannerProps {
  active: boolean;
  message: string;
}

const CosmicEventBanner: React.FC<CosmicEventBannerProps> = ({ active, message }) => {
  if (!active) return null;
  return (
    <div className="mt-4 rounded-3xl border border-amber-200/40 bg-gradient-to-r from-amber-500/20 to-pink-500/10 px-6 py-4 text-amber-100 shadow-[0_20px_60px_rgba(251,146,60,0.25)] backdrop-blur">
      <p className="text-xs uppercase tracking-[0.45em] text-amber-100/80">Cosmic Event</p>
      <div className="mt-2 flex flex-col gap-2 text-sm md:flex-row md:items-center md:justify-between">
        <p className="text-base font-semibold">{message}</p>
        <p className="text-xs text-amber-100/70">Meteor Shower • Asteroids running hot for 90s</p>
      </div>
    </div>
  );
};

export default CosmicEventBanner;
