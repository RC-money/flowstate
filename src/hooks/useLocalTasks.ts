import { useEffect, useRef, useState } from "react";

export type TaskStatus = "TO-DO" | "IN PROGRESS" | "DONE";
export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  tags?: string[];
  notes?: string;
}

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
  const next: Task[] = [];
  for (const item of payload) {
    if (!isTask(item)) {
      return null;
    }
    next.push(item);
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
