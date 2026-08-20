import { useEffect, useRef, useState } from "react";
import { createTaskStore, hydrateFromStore } from "../lib/storage";
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
  /** Epoch ms. Sent into the Ether: gone from the board, shining in the sky. */
  etheredAt?: number;
  /**
   * Which cluster (project) this task belongs to. Optional in the type because
   * every board saved before clusters existed is missing it; normalization
   * fills it in on load, so it is always present at runtime.
   */
  clusterId?: string;
}

/** Stamps a task as changed now. Use at every mutation site. */
export const touchTask = (task: Task, now: number = Date.now()): Task => ({
  ...task,
  updatedAt: now,
});

type Tasks = Task[];

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

export const coerceTasks = (payload: unknown): Tasks | null => {
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

/** What hydration found on disk, for callers that must not act before it lands. */
export interface HydrationInfo {
  ready: boolean;
  storedBoard: Tasks | null;
}

export const useLocalTasks = (
  initial: Tasks
): [Tasks, React.Dispatch<React.SetStateAction<Tasks>>, HydrationInfo] => {
  const [tasks, setTasks] = useState<Tasks>(initial);
  const [hydration, setHydration] = useState<HydrationInfo>({
    ready: false,
    storedBoard: null,
  });
  const storeRef = useRef(createTaskStore());
  const hydratedRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || hydratedRef.current) return;
    hydratedRef.current = true;
    hydrateFromStore(storeRef.current)
      .then(({ tasks: next, source }) => {
        if (next) {
          setTasks(next);
          console.log(`[flowstate] Tasks hydrated from ${source}`);
        }
        setHydration({ ready: true, storedBoard: next });
      })
      .catch((error) => {
        console.error("[flowstate] Hydration failed:", error);
        setHydration({ ready: true, storedBoard: null });
      });
  }, []);

  // Adopt changes made by the MCP server while the app is open. The store
  // filters the echo of our own writes, so this only fires for real outside
  // edits (see lib/storage/external.ts).
  useEffect(() => {
    const store = storeRef.current;
    if (!store.watch) return;
    let stop: (() => void) | null = null;
    let cancelled = false;
    store
      .watch((next) => {
        setTasks(next);
        window.dispatchEvent(
          new CustomEvent("flowstate:toast", {
            detail: { message: "Board updated from outside.", variant: "success" },
          })
        );
      })
      .then((unwatch) => {
        if (cancelled) unwatch();
        else stop = unwatch;
      })
      .catch((error) => {
        console.error("[flowstate] Watch failed:", error);
      });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  useEffect(() => {
    if (!hydratedRef.current || typeof window === "undefined") return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      storeRef.current.save(JSON.stringify(tasks)).catch((error) => {
        console.error("[flowstate] Failed to save tasks:", error);
      });
    }, 150);
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    };
  }, [tasks]);

  return [tasks, setTasks, hydration];
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
