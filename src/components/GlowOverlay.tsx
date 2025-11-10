import React from "react";

export default function GlowOverlay() {
  return (
    <div className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-indigo-700/10 to-transparent blur-3xl pointer-events-none" />
  );
}
