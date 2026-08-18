import { useEffect, useRef } from "react";
import type { Task } from "../../hooks/useLocalTasks";
import type { ObserverEngineCore } from "../observer/observerEngine";

interface UseJesterOptions {
  engine: ObserverEngineCore | null;
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  onChallenge?: (task: Task) => void;
  entropyThreshold?: number;
  cooldownMs?: number;
}

const DEFAULT_THRESHOLD = 0.8;
const DEFAULT_COOLDOWN = 2 * 60 * 1000; // 2 minutes

export const useJester = ({
  engine,
  tasks,
  setTasks,
  onChallenge,
  entropyThreshold = DEFAULT_THRESHOLD,
  cooldownMs = DEFAULT_COOLDOWN,
}: UseJesterOptions): void => {
  const tasksRef = useRef(tasks);
  const lastChallengeRef = useRef(0);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    if (!engine || typeof window === "undefined") {
      return;
    }

    const checkEntropy = () => {
      const snapshot = engine.getSnapshot();
      const signals = Array.from(snapshot.signals.values());
      if (!signals.length) return;
      const avgEntropy = signals.reduce((sum, signal) => sum + signal.entropy, 0) / signals.length;
      if (avgEntropy <= entropyThreshold) return;
      const now = Date.now();
      if (now - lastChallengeRef.current < cooldownMs) return;

      const asteroids = tasksRef.current.filter((task) => task.status === "TO-DO");
      if (!asteroids.length) return;
      const chosen = asteroids[Math.floor(Math.random() * asteroids.length)];
      lastChallengeRef.current = now;
      setTasks((prev) =>
        prev.map((task) =>
          task.id === chosen.id ? { ...task, status: "IN PROGRESS" } : task
        )
      );
      onChallenge?.({ ...chosen, status: "IN PROGRESS" });
    };

    const intervalId = window.setInterval(checkEntropy, 10000);
    checkEntropy();
    return () => {
      window.clearInterval(intervalId);
    };
  }, [engine, setTasks, entropyThreshold, cooldownMs, onChallenge]);
};
