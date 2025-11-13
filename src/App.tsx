// src/App.tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DndContext,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import Board from "./components/Board";
import Card from "./components/Card";
import TaskModal from "./components/TaskModal";
import GraphView from "./components/GraphView/GraphView";
import NoiseOverlay from "./components/NoiseOverlay";
import Wordmark from "./components/Wordmark";
import { useHotkeys } from "./hooks/useHotkeys";
import CommandPalette, { type Command } from "./components/CommandPalette";
import AskFlowPanel from "./components/AskFlowPanel";
import { ToastProvider, useToast } from "./components/Toast";
import { logEvent, setAnalyticsEnabled } from "./lib/analytics";
import { useLocalTasks, type Task, type TaskStatus } from "./hooks/useLocalTasks";
import IntentSurface from "./components/IntentSurface";
import GenesisForge from "./components/GenesisForge";
import StrangeLoopPanel from "./components/StrangeLoopPanel";
import CosmicEventBanner from "./components/CosmicEventBanner";
import { useObserverEngine } from "./engine/observer/hooks";
import { useStrangeLoop } from "./engine/strangeLoop";
import { useMeteorShower } from "./engine/events";
import { useJester } from "./engine/council";
import { BiomeProvider } from "./engine/biomes";

export type { Task } from "./hooks/useLocalTasks";

export type Status = TaskStatus;

type ViewMode = "board" | "graph";
type ToastVariant = "success" | "warn" | "error";
type CelestialKind = "sun" | "moon" | "asteroid";
type TetherPair = { sourceId: string; targetId: string };

function createBlankTask(status: Status): Task {
  return {
    id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: "",
    description: "",
    status,
  };
}

const initialTasks: Task[] = [
  { id: "t1", title: "Create dashboard components", status: "TO-DO" },
  { id: "t2", title: "Write API documentation", status: "TO-DO" },
  { id: "t3", title: "Build authentication system", status: "IN PROGRESS" },
  { id: "t4", title: "Set up CI/CD pipeline", status: "IN PROGRESS" },
  { id: "t5", title: "Design homepage layout", status: "DONE" },
];

const isTaskPayload = (item: unknown): item is Task => {
  return (
    Boolean(item) &&
    typeof item === "object" &&
    typeof (item as Task).id === "string" &&
    typeof (item as Task).title === "string" &&
    typeof (item as Task).status === "string"
  );
};

const sanitizeTasks = (data: unknown): Task[] | null => {
  if (!Array.isArray(data)) return null;
  const cleaned = data.filter(isTaskPayload);
  return cleaned.length ? cleaned : null;
};

export default function App() {
  return (
    <ToastProvider>
      <BiomeProvider>
        <div
          className="min-h-screen text-white transition-colors"
          style={{
            backgroundImage: "var(--biome-bg, linear-gradient(135deg,#050B18,#0B1220))",
          }}
        >
          <NoiseOverlay />
          <AppShell />
        </div>
      </BiomeProvider>
    </ToastProvider>
  );
}

function AppShell() {
  const { show } = useToast();
  const [tasks, setTasks] = useLocalTasks(initialTasks);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"new" | "edit">("new");
  const [draftTask, setDraftTask] = useState<Task | null>(null);
  const [focusedColumn, setFocusedColumn] = useState<Status | null>(null);
  const [view, setView] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "board";
    const stored = window.sessionStorage.getItem("flowstate:view");
    return stored === "graph" ? "graph" : "board";
  });
  const [showGraph, setShowGraph] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const lastAddSourceRef = useRef<"keyboard" | "click">("click");
  const { engine: observerEngine } = useObserverEngine({ tasks });
  const { question: strangeLoopQuestion, refresh: refreshStrangeLoop } = useStrangeLoop({
    engine: observerEngine,
  });

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ message: string; variant?: ToastVariant }>).detail;
      if (!detail?.message) return;
      show(detail.message, { variant: detail.variant });
    };
    window.addEventListener("flowstate:toast", handler as EventListener);
    return () => window.removeEventListener("flowstate:toast", handler as EventListener);
  }, [show]);

  useEffect(() => {
    const dev =
      typeof import.meta !== "undefined" &&
      Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV);
    if (dev) setAnalyticsEnabled(true);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const tasksById = useMemo(() => {
    const m: Record<string, Task> = {};
    for (const t of tasks) m[t.id] = t;
    return m;
  }, [tasks]);

  const pushToast = useCallback(
    (message: string, variant: ToastVariant = "success") => {
      show(message, { variant });
      logEvent({ type: "toast:show", variant });
    },
    [show]
  );
  const handleCreateTether = useCallback(
    (sourceId: string, targetId: string) => {
      if (sourceId === targetId) return;
      setTasks((prev) =>
        prev.map((task) => {
          if (task.id !== targetId) return task;
          const dependsOn = Array.isArray(task.dependsOn) ? task.dependsOn : [];
          if (dependsOn.includes(sourceId)) return task;
          return { ...task, dependsOn: [...dependsOn, sourceId] };
        })
      );
      pushToast("Cartographer: A new orbit is forming. Curious.", "success");
    },
    [pushToast, setTasks]
  );
  const { active: meteorActive, message: meteorMessage } = useMeteorShower({
    onMessage: (text) => pushToast(text, "warn"),
  });
  useJester({
    engine: observerEngine,
    tasks,
    setTasks,
    onChallenge: (task) => {
      const title = task.title || "this task";
      pushToast(`Jester: Is ${title} really your universe’s center? Prove it.`, "warn");
    },
  });

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setDraftTask(null);
  }, []);

  const handleEditTask = useCallback(
    (task: Task) => {
      const freshTask = tasksById[task.id] ?? task;
      setModalMode("edit");
      setDraftTask(freshTask);
      setActiveTask(freshTask);
      setFocusedColumn(freshTask.status);
      setIsModalOpen(true);
    },
    [tasksById]
  );

  const handleAddTask = useCallback(
    (status: Status, source: "keyboard" | "click" = "click") => {
      lastAddSourceRef.current = source;
      const nextDraft = createBlankTask(status);
      setModalMode("new");
      setDraftTask(nextDraft);
      setFocusedColumn(status);
      setIsModalOpen(true);
    },
    []
  );

  const handleCardClick = useCallback(
    (task: Task) => handleEditTask(task),
    [handleEditTask]
  );

  const handleOpenTaskById = useCallback(
    (taskId: string) => {
      const nextTask = tasksById[taskId];
      if (nextTask) handleEditTask(nextTask);
    },
    [tasksById, handleEditTask]
  );

  const handleMoveTask = useCallback(
    (taskId: string, nextStatus: Status, method: "drag" | "menu" | "hotkey" = "menu") => {
      const current = tasksById[taskId];
      if (!current || current.status === nextStatus) return;

      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId ? { ...task, status: nextStatus } : task
        )
      );
      setActiveTask((prev) =>
        prev && prev.id === taskId ? { ...prev, status: nextStatus } : prev
      );
      setDraftTask((prev) =>
        prev && prev.id === taskId ? { ...prev, status: nextStatus } : prev
      );
      setFocusedColumn(nextStatus);
      pushToast(`Moved to ${nextStatus}`, "success");
      logEvent({ type: "task:move", method });
    },
    [pushToast, tasksById]
  );

  const handleDeleteTask = useCallback(
    (taskId: string) => {
      setTasks((prev) => prev.filter((task) => task.id !== taskId));
      setActiveTask((prev) => (prev?.id === taskId ? null : prev));
      setDraftTask((prev) => (prev?.id === taskId ? null : prev));
      if (draftTask?.id === taskId) {
        closeModal();
      }
      pushToast("Task deleted", "warn");
      logEvent({ type: "task:delete" });
    },
    [closeModal, draftTask, pushToast]
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const active = event.active;
      const over = event.over;
      if (!active || !over) {
        setActiveId(null);
        return;
      }

      const overId = String(over.id);
      const possibleColumns: Status[] = ["TO-DO", "IN PROGRESS", "DONE"];
      if (possibleColumns.includes(overId as Status)) {
        handleMoveTask(String(active.id), overId as Status, "drag");
      }
      setActiveId(null);
    },
    [handleMoveTask]
  );

  const handleSaveTask = useCallback(
    (task: Task) => {
      setTasks((prev) => {
        if (modalMode === "new") {
          return [...prev, task];
        }
        return prev.map((t) => (t.id === task.id ? { ...t, ...task } : t));
      });
      setActiveTask(task);
      setFocusedColumn(task.status);
      if (modalMode === "new") {
        pushToast("Task created", "success");
        logEvent({ type: "task:add", source: lastAddSourceRef.current });
      } else {
        pushToast("Task updated", "success");
      }
      closeModal();
    },
    [modalMode, closeModal, pushToast]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem("flowstate:view", view);
  }, [view]);

  const handleExportTasks = useCallback(() => {
    try {
      const payload = JSON.stringify(tasks, null, 2);
      const blob = new Blob([payload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "flowstate-tasks.json";
      anchor.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 0);
      pushToast("Tasks exported", "success");
    } catch (error) {
      pushToast("Export failed", "error");
      console.error("Flowstate: export failed", error);
    }
  }, [pushToast, tasks]);

  const handleImportTasks = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          const cleaned = sanitizeTasks(parsed);
          if (cleaned) {
            setTasks(cleaned);
            pushToast("Tasks imported", "success");
            return;
          }
        } catch (error) {
          console.error("Flowstate: import failed", error);
        }
        pushToast("Import failed", "error");
      };
      reader.readAsText(file);
    },
    [pushToast]
  );

  const handleViewChange = (nextView: ViewMode) => {
    setView(nextView);
  };

  useHotkeys([
    {
      combo: "n",
      handler: () => handleAddTask(focusedColumn ?? "TO-DO", "keyboard"),
      enabled: !isModalOpen,
      preventDefault: true,
      stopPropagation: true,
    },
    {
      combo: "e",
      handler: () => {
        if (!activeTask) return;
        handleEditTask(activeTask);
      },
      enabled: Boolean(activeTask) && !isModalOpen,
      preventDefault: true,
      stopPropagation: true,
    },
    {
      combo: "g",
      handler: () => setShowGraph((prev) => !prev),
      enabled: !isModalOpen,
      preventDefault: true,
      stopPropagation: true,
    },
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleGraphToggle = () => setShowGraph((prev) => !prev);
    window.addEventListener("flowstate:toggle:graph", handleGraphToggle);
    return () => {
      window.removeEventListener("flowstate:toggle:graph", handleGraphToggle);
    };
  }, []);

  const commands: Command[] = useMemo(
    () => [
      {
        id: "cmd-new-task",
        label: "New Task",
        hint: "N",
        run: () => {
          logEvent({ type: "palette:run" });
          handleAddTask(focusedColumn ?? "TO-DO", "keyboard");
        },
      },
      {
        id: "cmd-ask-flow",
        label: "Ask Flow (AI panel)",
        run: () => {
          logEvent({ type: "palette:run" });
          setAskOpen(true);
        },
      },
    ],
    [focusedColumn, handleAddTask]
  );

  const handlePaletteOpen = useCallback(() => {
    setPaletteOpen((prev) => {
      if (!prev) {
        logEvent({ type: "palette:open" });
        return true;
      }
      return prev;
    });
  }, []);

  const handleGenesisCreate = useCallback(
    ({ title, kind }: { title: string; kind: CelestialKind }) => {
      const statusMap: Record<CelestialKind, Status> = {
        sun: "IN PROGRESS",
        moon: "DONE",
        asteroid: "TO-DO",
      };
      const status = statusMap[kind] ?? "TO-DO";
      const nextTask = { ...createBlankTask(status), title };
      setTasks((prev) => [...prev, nextTask]);
      pushToast(`Condensed a new ${kind.toUpperCase()}`, "success");
      logEvent({ type: "task:add", source: "click" });
    },
    [pushToast, setTasks]
  );

  return (
    <>
      {showGraph ? (
        <div className="pointer-events-none fixed inset-0 -z-10">
              <GraphView tasks={tasks} onOpenTask={handleOpenTaskById} onCreateTether={handleCreateTether} />
        </div>
      ) : null}
      <main className="mx-auto max-w-screen-2xl px-4 py-8 text-white">
        <header className="text-center space-y-4">
          <div className="flex flex-col items-center gap-3">
            <h1 className="sr-only">Flowstate</h1>
            <div className="hidden min-h-[64px] w-full items-center justify-center sm:flex">
              <Wordmark />
            </div>
            <div className="sm:hidden">
              <p className="text-3xl font-extrabold tracking-wide text-white">FLOWSTATE</p>
            </div>
            <p className="text-[#8aa0b8]">Your tasks, in motion.</p>
          </div>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={handlePaletteOpen}
            className="rounded-xl border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/90 transition hover:border-white/40 hover:bg-white/10"
          >
            ⌘K
          </button>
          <button
            type="button"
            onClick={() => setAskOpen(true)}
            className="rounded-xl border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/90 transition hover:border-white/40 hover:bg-white/10"
          >
            Ask Flow
          </button>
          <GenesisForge onGenesis={handleGenesisCreate} />
        </div>
            <div className="flex justify-center mt-6 mb-4">
              <div
                role="group"
                aria-label="Select view"
                className="inline-flex rounded-2xl border border-white/10 bg-white/5 p-1 backdrop-blur-sm"
            >
              {(["board", "graph"] as const).map((mode) => {
                const isActive = view === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => handleViewChange(mode)}
                    className={`px-5 py-2 text-sm font-semibold uppercase tracking-wide rounded-xl transition ${
                      isActive
                        ? "bg-white text-[#0B1220]"
                        : "text-[#8aa0b8] hover:text-white"
                    }`}
                  >
                    {mode === "board" ? "Board" : "Graph"}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={handleExportTasks}
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/90 transition hover:border-white/40 hover:bg-white/10"
              >
                <span className="text-base leading-none">⇣</span>
                Export JSON
              </button>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/90 transition hover:border-white/40 hover:bg-white/10">
                <span className="text-base leading-none">⇡</span>
                Import JSON
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={handleImportTasks}
                />
              </label>
            </div>
          </div>
        </header>

        <IntentSurface />
        <CosmicEventBanner
          active={meteorActive}
          message={meteorMessage ?? "Meteor shower in progress. Asteroids running hot."}
        />
        <StrangeLoopPanel question={strangeLoopQuestion} onRefresh={refreshStrangeLoop} />

        <div className="board-wrapper">
          {view === "board" ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <Board
                tasks={tasks}
                onCardClick={handleCardClick}
                onAdd={(status) => handleAddTask(status, "click")}
                onOpenTask={handleOpenTaskById}
                onMoveTask={(taskId, next) => handleMoveTask(taskId, next, "menu")}
                onDeleteTask={handleDeleteTask}
              />
              <DragOverlay
                dropAnimation={{ duration: 220, easing: "cubic-bezier(.2,.8,.2,1)" }}
              >
                {activeId ? (
                  <Card
                    id={activeId}
                    title={tasksById[activeId]?.title ?? ""}
                    status={tasksById[activeId]?.status ?? "TO-DO"}
                  />
                ) : null}
              </DragOverlay>
            </DndContext>
          ) : (
            <GraphView tasks={tasks} onOpenTask={handleOpenTaskById} />
          )}
        </div>
      </main>

      {isModalOpen ? (
        <TaskModal
          mode={modalMode}
          initialTask={draftTask ?? undefined}
          onSave={handleSaveTask}
          onClose={closeModal}
          onMove={(taskId, next) => handleMoveTask(taskId, next, "menu")}
          onMarkDone={(taskId) => handleMoveTask(taskId, "DONE", "menu")}
          onDelete={handleDeleteTask}
        />
      ) : null}

      <CommandPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        commands={commands}
        onGlobalOpen={handlePaletteOpen}
      />

      <AskFlowPanel open={askOpen} onClose={() => setAskOpen(false)} />
    </>
  );
}
