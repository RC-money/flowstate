import React from "react";
import noise from "@/assets/noise.png";

export default function NoiseOverlay() {
  return (
    <div
      className="absolute inset-0 pointer-events-none opacity-[0.04] mix-blend-overlay"
      style={{
        backgroundImage: `url(${noise})`,
      }}
    />
  );
}
