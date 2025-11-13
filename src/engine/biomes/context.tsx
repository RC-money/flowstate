import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { BiomeManager } from "./manager";
import type { BiomeMetrics, BiomeTokens, UserIntent } from "./types";

interface BiomeContextValue {
  tokens: BiomeTokens;
  intent: UserIntent;
  metrics: BiomeMetrics;
  setIntent: (intent: UserIntent) => void;
  updateMetrics: (next: Partial<BiomeMetrics>) => void;
}

const DEFAULT_METRICS: BiomeMetrics = {
  avgHeat: 0.4,
  avgEntropy: 0.4,
};

const DEFAULT_INTENT: UserIntent = "clarity";

const BiomeContext = createContext<BiomeContextValue | undefined>(undefined);

const restoreIntent = (): UserIntent => {
  if (typeof window === "undefined") return DEFAULT_INTENT;
  const stored = window.localStorage.getItem("flowstate:biome-intent");
  if (stored === "progress" || stored === "clarity" || stored === "lost" || stored === "overwhelm") {
    return stored;
  }
  return DEFAULT_INTENT;
};

export const BiomeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const managerRef = useRef(new BiomeManager());
  const [intent, setIntent] = useState<UserIntent>(() => restoreIntent());
  const [metrics, setMetrics] = useState<BiomeMetrics>(DEFAULT_METRICS);
  const tokens = useMemo(
    () => managerRef.current.compute({ intent, metrics, timestamp: Date.now() }),
    [intent, metrics]
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("flowstate:biome-intent", intent);
    }
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.style.setProperty("--biome-bg", tokens.background);
      root.style.setProperty("--biome-accent", tokens.accent);
      root.style.setProperty("--biome-overlay", tokens.overlay);
    }
  }, [intent, tokens]);

  const updateMetrics = (partial: Partial<BiomeMetrics>) => {
    setMetrics((prev) => ({ ...prev, ...partial }));
  };

  return (
    <BiomeContext.Provider value={{ tokens, intent, metrics, setIntent, updateMetrics }}>
      {children}
    </BiomeContext.Provider>
  );
};

export const useBiome = (): BiomeContextValue => {
  const ctx = useContext(BiomeContext);
  if (!ctx) {
    throw new Error("useBiome must be used within a BiomeProvider");
  }
  return ctx;
};
