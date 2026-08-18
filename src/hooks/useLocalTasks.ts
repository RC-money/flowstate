import { useEffect, useRef, useState } from "react";
import { normalizeDates } from "../lib/taskDates";
import { normalizeSubtasks, type Subtask } from "../lib/subtasks";

export type TaskStatus = "TO-DO" | "IN PROGRESS" | "DONE";
export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  description?: string;
  tags?: string[];
  notes?: string;
  dependsOn?: string[];
  darkForest?: boolean;
  orbitSeed?: { x: number; y: number };
  /** Epoch ms. Backfilled on load for tasks saved before dates existed. */
  createdAt: number;
  /** Epoch ms. Drives the graph's temporal links and orbital decay. */
  updatedAt: number;
  /** Calendar day as "YYYY-MM-DD", deliberately not a timestamp. */
  dueDate?: string;
  /** Epoch ms, stamped on entering DONE. Earns the task's star in the sky. */
  completedAt?: number;
  /** Checklist inside the parent -- never board cards. Stars on the card. */
  subtasks?: Subtask[];
}

/** Stamps a task as changed now. Use at every mutation site. */
export const touchTask = (task: Task, now: number = Date.now()): Task => ({
  ...task,
  updatedAt: now,
});

type Tasks = Task[];

const STORAGE_KEY = "flowstate:v1:tasks";

const isTask = (candidate: unknown): candidate is Task => {
  return (
    Boolean(candidate) &&
    typeof candidate === "object" &&
    typeof (candidate as Task).id === "string" &&
    typeof (candidate as Task).title === "string" &&
    typeof (candidate as Task).status === "string" &&
    ((candidate as Task).status === "TO-DO" ||
      (candidate as Task).status === "IN PROGRESS" ||
      (candidate as Task).status === "DONE")
  );
};

const coerceTasks = (payload: unknown): Tasks | null => {
  if (!Array.isArray(payload)) return null;
  const now = Date.now();
  const next: Task[] = [];
  for (const item of payload) {
    if (!isTask(item)) {
      return null;
    }
    // Repairs rather than rejects: every board saved before dates existed is
    // missing these fields, and rejecting would silently reset the user's data.
    const subtasks = normalizeSubtasks((item as Task).subtasks);
    next.push({
      ...item,
      ...normalizeDates(item, now),
      ...(subtasks?.length ? { subtasks } : {}),
    });
  }
  return next;
};

export const useLocalTasks = (
  initial: Tasks
): [Tasks, React.Dispatch<React.SetStateAction<Tasks>>] => {
  const [tasks, setTasks] = useState<Tasks>(initial);
  const hydratedRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || hydratedRef.current) return;
    hydratedRef.current = true;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const next = coerceTasks(parsed);
      if (next) {
        setTasks(next);
        console.log("[flowstate] Tasks hydrated from localStorage");
      } else {
        console.error("[flowstate] Invalid tasks in localStorage; ignoring.");
      }
    } catch (error) {
      console.error("[flowstate] Failed to parse tasks:", error);
    }
  }, []);

  useEffect(() => {
    if (!hydratedRef.current || typeof window === "undefined") return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      } catch (error) {
        console.error("[flowstate] Failed to save tasks:", error);
      }
    }, 150);
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    };
  }, [tasks]);

  return [tasks, setTasks];
};

export const exportTasks = (tasks: Tasks): string => {
  try {
    return JSON.stringify(tasks, null, 2);
  } catch (error) {
    console.error("[flowstate] exportTasks failed:", error);
    return "[]";
  }
};

export const importTasks = (raw: string): Tasks | null => {
  try {
    const parsed = JSON.parse(raw);
    const normalized = coerceTasks(parsed);
    if (!normalized) {
      console.error("[flowstate] importTasks rejected payload.");
    }
    return normalized;
  } catch (error) {
    console.error("[flowstate] importTasks failed:", error);
    return null;
  }
};
