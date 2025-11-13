import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { BIOME_REGISTRY } from "./biomeRegistry";
import type { BiomeId, BiomeParameters } from "./types";

interface BiomeContextValue {
  biome: BiomeId;
  params: BiomeParameters;
  setBiome: (next: BiomeId) => void;
}

const BiomeContext = createContext<BiomeContextValue | undefined>(undefined);

const getStoredBiome = (): BiomeId => {
  if (typeof window === "undefined") return "mentor";
  const stored = window.localStorage.getItem("flowstate:biome");
  if (stored && stored in BIOME_REGISTRY) {
    return stored as BiomeId;
  }
  return "mentor";
};

export const BiomeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [biome, setBiome] = useState<BiomeId>(() => getStoredBiome());
  const params = useMemo(() => BIOME_REGISTRY[biome], [biome]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("flowstate:biome", biome);
    }
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.style.setProperty("--biome-bg", params.background);
      root.style.setProperty("--biome-accent", params.accent);
    }
  }, [biome, params]);

  return <BiomeContext.Provider value={{ biome, params, setBiome }}>{children}</BiomeContext.Provider>;
};

export const useBiomeState = (): BiomeContextValue => {
  const ctx = useContext(BiomeContext);
  if (!ctx) {
    throw new Error("useBiomeState must be used within a BiomeProvider");
  }
  return ctx;
};
