import { useCallback, useEffect, useRef, useState } from "react";
import type { PersonaId } from "../paradox/council";

export interface ReflectionEntry {
  id: string;
  questionId: string;
  question: string;
  response: string;
  personaId: PersonaId | "universe";
  relatedTaskIds: string[];
  constellationIds: string[];
  createdAt: number;
}

export interface ReflectionStats {
  byPersona: Record<string, number>;
  total: number;
}

const STORAGE_KEY = "flowstate:v1:reflections";

export const useReflectionJournal = () => {
  const [entries, setEntries] = useState<ReflectionEntry[]>([]);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || hydratedRef.current) return;
    hydratedRef.current = true;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setEntries(parsed);
      }
    } catch (error) {
      console.error("[flowstate] Failed to load reflections", error);
    }
  }, []);

  useEffect(() => {
    if (!hydratedRef.current || typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }, [entries]);

  const addReflection = useCallback(
    (entry: Omit<ReflectionEntry, "id" | "createdAt">) => {
      setEntries((prev) => [
        {
          ...entry,
          id: `reflection-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          createdAt: Date.now(),
        },
        ...prev,
      ]);
    },
    []
  );

  const getStats = useCallback((): ReflectionStats => {
    return entries.reduce(
      (acc, entry) => {
        acc.total += 1;
        acc.byPersona[entry.personaId] = (acc.byPersona[entry.personaId] ?? 0) + 1;
        return acc;
      },
      { total: 0, byPersona: {} as Record<string, number> }
    );
  }, [entries]);

  return {
    reflections: entries,
    addReflection,
    getStats,
  };
};
