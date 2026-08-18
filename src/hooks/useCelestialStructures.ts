import { useCallback, useEffect, useRef, useState } from "react";
import type { Constellation, Tether } from "../types/celestial";
import { mergeConstellations } from "../engine/constellations/merge";

type StructuresState = {
  tethers: Tether[];
  constellations: Constellation[];
};

const STORAGE_KEY = "flowstate:v1:structures";

const defaultState: StructuresState = {
  tethers: [],
  constellations: [],
};

const coerce = (payload: unknown): StructuresState | null => {
  if (!payload || typeof payload !== "object") return null;
  const candidate = payload as Partial<StructuresState>;
  if (!Array.isArray(candidate.tethers) || !Array.isArray(candidate.constellations)) {
    return null;
  }
  return {
    tethers: candidate.tethers,
    constellations: candidate.constellations,
  };
};

export const useCelestialStructures = () => {
  const [state, setState] = useState<StructuresState>(defaultState);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || hydratedRef.current) return;
    hydratedRef.current = true;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const next = coerce(parsed);
      if (next) {
        setState(next);
      }
    } catch (error) {
      console.error("[flowstate] Failed to parse celestial structures", error);
    }
  }, []);

  useEffect(() => {
    if (!hydratedRef.current || typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const addTether = useCallback((sourceId: string, targetId: string) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    setState((prev) => {
      const exists = prev.tethers.some(
        (tether) =>
          (tether.sourceId === sourceId && tether.targetId === targetId) ||
          (tether.sourceId === targetId && tether.targetId === sourceId)
      );
      if (exists) return prev;
      const newTether: Tether = {
        id: `tether-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        sourceId,
        targetId,
        createdAt: Date.now(),
        strength: 1,
      };
      return { ...prev, tethers: [...prev.tethers, newTether] };
    });
  }, []);

  const removeTether = useCallback((tetherId: string) => {
    setState((prev) => ({
      ...prev,
      tethers: prev.tethers.filter((tether) => tether.id !== tetherId),
    }));
  }, []);

  const setConstellations = useCallback((constellations: Constellation[]) => {
    // Merge so user-given names and ages survive re-analysis.
    setState((prev) => ({
      ...prev,
      constellations: mergeConstellations(prev.constellations, constellations),
    }));
  }, []);

  const renameConstellation = useCallback((constellationId: string, name: string) => {
    setState((prev) => ({
      ...prev,
      constellations: prev.constellations.map((c) =>
        c.id === constellationId ? { ...c, name: name.trim() || undefined } : c
      ),
    }));
  }, []);

  return {
    tethers: state.tethers,
    constellations: state.constellations,
    addTether,
    removeTether,
    setConstellations,
    renameConstellation,
  };
};
