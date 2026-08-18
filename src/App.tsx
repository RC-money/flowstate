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
// Lazy: the graph stack (react-force-graph + d3) is ~two-thirds of the
// bundle and the app opens on the board -- pay for the galaxy when visited.
const GraphView = React.lazy(() => import("./components/GraphView/GraphView"));
import NoiseOverlay from "./components/NoiseOverlay";
import AmbientStars from "./components/AmbientStars";
import StatusBar from "./components/StatusBar";
import { useHotkeys } from "./hooks/useHotkeys";
import CommandPalette, { type Command } from "./components/CommandPalette";
import AskFlowPanel from "./components/AskFlowPanel";
import { ToastProvider, useToast } from "./components/Toast";
import { logEvent, setAnalyticsEnabled } from "./lib/analytics";
import { useLocalTasks, touchTask, type Task, type TaskStatus } from "./hooks/useLocalTasks";
import { stampCompletion } from "./lib/earnedStars";
import { appendLogEvent } from "./lib/taskLog";
import IntentSurface from "./components/IntentSurface";
import { useObserverEngine } from "./engine/observer/hooks";
import { useCosmicEvents } from "./engine/events";
import { useBiome } from "./engine/biomes";
import Observatory from "./components/Observatory";
import { useCelestialStructures } from "./hooks/useCelestialStructures";
import { BiomeProvider } from "./engine/biomes";

export type { Task } from "./hooks/useLocalTasks";

export type Status = TaskStatus;

type ViewMode = "board" | "graph";
type ToastVariant = "success" | "warn" | "error";

function createBlankTask(status: Status): Task {
  const now = Date.now();
  return {
    id: `t_${now}_${Math.random().toString(36).slice(2, 8)}`,
    title: "",
    description: "",
    status,
    createdAt: now,
    updatedAt: now,
  };
}

const seedTask = (
  id: string,
  title: string,
  status: Status,
  ageInDays: number
): Task => {
  const created = Date.now() - ageInDays * 86_400_000;
  return { id, title, status, createdAt: created, updatedAt: created };
};

// Staggered ages so the graph's temporal links and the decay curve have
// something real to read on a first run.
const initialTasks: Task[] = [
  seedTask("t1", "Create dashboard components", "TO-DO", 6),
  seedTask("t2", "Write API documentation", "TO-DO", 5),
  seedTask("t3", "Build authentication system", "IN PROGRESS", 4),
  seedTask("t4", "Set up CI/CD pipeline", "IN PROGRESS", 2),
  seedTask("t5", "Design homepage layout", "DONE", 1),
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
            backgroundImage: "var(--biome-bg, linear-gradient(180deg,#090a19,#05070f))",
          }}
        >
          <NoiseOverlay />
          <AmbientStars />
          <AppShell />
        </div>
      </BiomeProvider>
    </ToastProvider>
  );
}

function AppShell() {
  const { show } = useToast();
  const { updateMetrics, metrics: biomeMetrics } = useBiome();
  const { tethers, constellations, addTether, setConstellations } = useCelestialStructures();
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
  const [observatoryOpen, setObservatoryOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const lastAddSourceRef = useRef<"keyboard" | "click">("click");
  const { engine: observerEngine } = useObserverEngine({ tasks });
  const visibleTasks = useMemo(
    () => tasks.filter((task) => !task.darkForest && task.etheredAt === undefined),
    [tasks]
  );
  const etherealTasks = useMemo(() => tasks.filter((task) => task.etheredAt !== undefined), [tasks]);
  const darkForestTasks = useMemo(() => tasks.filter((task) => task.darkForest), [tasks]);

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
      addTether(sourceId, targetId);
      pushToast("Cartographer: A new orbit is forming. Curious.", "success");
    },
    [addTether, pushToast]
  );
  useCosmicEvents({
    metrics: {
      avgHeat: biomeMetrics.avgHeat,
      avgEntropy: biomeMetrics.avgEntropy,
      tetherCount: tethers.length,
      constellationCount: constellations.length,
    },
  });

  useEffect(() => {
    if (!observerEngine?.getSnapshot) return;
    const snapshot = observerEngine.getSnapshot();
    const signals = Array.from(snapshot.signals?.values?.() ?? snapshot.signals.values());
    if (!signals.length) return;
    const totals = signals.reduce(
      (acc: { heat: number; entropy: number }, signal: { heat?: number; entropy?: number; taskId?: string }) => {
        acc.heat += signal.heat ?? 0.4;
        acc.entropy += signal.entropy ?? 0.4;
        return acc;
      },
      { heat: 0, entropy: 0 }
    );
    updateMetrics({
      avgHeat: totals.heat / signals.length,
      avgEntropy: totals.entropy / signals.length,
    });
  }, [observerEngine, tasks, updateMetrics]);

  useEffect(() => {
    if (!observerEngine?.ingestEvent) return;
    observerEngine.ingestEvent({
      type: "constellation_snapshot",
      timestamp: Date.now(),
      payload: { constellations },
    } as unknown as Parameters<typeof observerEngine.ingestEvent>[0]);
  }, [observerEngine, constellations]);



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

  const handleSendToEther = useCallback(
    (taskId: string) => {
      const task = tasksById[taskId];
      if (!task || task.status !== "DONE") return;
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? touchTask({ ...t, etheredAt: Date.now() }) : t))
      );
      appendLogEvent({ t: Date.now(), taskId, kind: "ethered", title: task.title });
      pushToast("It shines in the galaxy now.", "success");
    },
    [pushToast, setTasks, tasksById]
  );

  const handleRestoreFromDarkForest = useCallback(
    (taskId: string) => {
      setTasks((prev) =>
        prev.map((task) => (task.id === taskId ? touchTask({ ...task, darkForest: false }) : task))
      );
      appendLogEvent({ t: Date.now(), taskId, kind: "restored", title: tasksById[taskId]?.title });
      pushToast("Archivist: Brought back from the Dark Forest.", "success");
    },
    [pushToast, setTasks, tasksById]
  );

  const handleMoveTask = useCallback(
    (taskId: string, nextStatus: Status, method: "drag" | "menu" | "hotkey" = "menu") => {
      const current = tasksById[taskId];
      if (!current || current.status === nextStatus) return;

      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId
            ? touchTask(stampCompletion({ ...task, status: nextStatus }, nextStatus, Date.now()))
            : task
        )
      );
      setActiveTask((prev) =>
        prev && prev.id === taskId ? { ...prev, status: nextStatus } : prev
      );
      setDraftTask((prev) =>
        prev && prev.id === taskId ? { ...prev, status: nextStatus } : prev
      );
      setFocusedColumn(nextStatus);
      appendLogEvent({
        t: Date.now(),
        taskId,
        kind: nextStatus === "DONE" ? "completed" : "moved",
        from: current.status,
        to: nextStatus,
        title: current.title,
      });
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
      appendLogEvent({
        t: Date.now(),
        taskId,
        kind: "deleted",
        title: tasksById[taskId]?.title,
      });
      pushToast("Task deleted", "warn");
      logEvent({ type: "task:delete" });
    },
    [closeModal, draftTask, pushToast, tasksById]
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
        const stamped = stampCompletion(task, task.status, Date.now());
        if (modalMode === "new") {
          return [...prev, stamped];
        }
        return prev.map((t) =>
          t.id === task.id ? stampCompletion({ ...t, ...task }, task.status, Date.now()) : t
        );
      });
      setActiveTask(task);
      setFocusedColumn(task.status);
      if (modalMode === "new") {
        appendLogEvent({ t: Date.now(), taskId: task.id, kind: "created", to: task.status, title: task.title });
        pushToast("Task created", "success");
        logEvent({ type: "task:add", source: lastAddSourceRef.current });
      } else {
        const before = tasksById[task.id];
        appendLogEvent({
          t: Date.now(),
          taskId: task.id,
          kind: before && before.status !== task.status && task.status === "DONE" ? "completed" : "edited",
          from: before?.status,
          to: task.status,
          title: task.title,
        });
        pushToast("Task updated", "success");
      }
      closeModal();
    },
    [modalMode, closeModal, pushToast, tasksById]
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
        id: "cmd-observatory",
        label: "Open Observatory",
        hint: "O",
        run: () => {
          logEvent({ type: "palette:run" });
          setObservatoryOpen(true);
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
      ...(darkForestTasks.length
        ? [
            {
              id: "cmd-dark-forest-restore",
              label: `Restore ${darkForestTasks.length} task${darkForestTasks.length === 1 ? "" : "s"} from the Dark Forest`,
              run: () => {
                logEvent({ type: "palette:run" });
                darkForestTasks.forEach((task) => handleRestoreFromDarkForest(task.id));
              },
            },
          ]
        : []),
      {
        id: "cmd-export",
        label: "Export tasks as JSON",
        run: () => {
          logEvent({ type: "palette:run" });
          handleExportTasks();
        },
      },
      {
        id: "cmd-import",
        label: "Import tasks from JSON",
        run: () => {
          logEvent({ type: "palette:run" });
          importInputRef.current?.click();
        },
      },
    ],
    [focusedColumn, handleAddTask, handleExportTasks, darkForestTasks, handleRestoreFromDarkForest]
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



  return (
    <>
      {showGraph ? (
        <div className="pointer-events-none fixed inset-0 -z-10">
          <React.Suspense fallback={null}>
            <GraphView tasks={tasks} onOpenTask={handleOpenTaskById} onCreateTether={handleCreateTether} />
          </React.Suspense>
        </div>
      ) : null}
      <main className="relative z-10 mx-auto max-w-screen-2xl px-4 py-8 text-white">
        <header className="mb-7 text-center">
          <h1 className="sr-only">Flowstate</h1>
          <p
            aria-hidden="true"
            className="bg-gradient-to-br from-white via-[#c9d0ff] to-[#7c83ff] bg-clip-text text-4xl font-extrabold tracking-[0.16em] text-transparent sm:text-5xl"
            style={{ filter: "drop-shadow(0 0 26px rgba(124,131,255,0.4))" }}
          >
            FLOWSTATE
          </p>
          <p className="mt-2 text-[15px] text-[#9aa6c4]">Your tasks, in motion.</p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
            <div
              role="group"
              aria-label="Select view"
              className="inline-flex gap-1 rounded-2xl border border-[rgba(165,175,255,0.14)] bg-[rgba(9,10,25,0.5)] p-1 backdrop-blur-md"
            >
              {(["board", "graph"] as const).map((mode) => {
                const isActive = view === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => handleViewChange(mode)}
                    className={`rounded-xl px-5 py-2 font-mono text-[11.5px] font-semibold uppercase tracking-[0.09em] transition ${
                      isActive
                        ? "bg-gradient-to-br from-[#5b5cf0] to-[#7c83ff] text-white shadow-[0_0_22px_rgba(124,131,255,0.4)]"
                        : "text-[#9aa6c4] hover:text-white"
                    }`}
                  >
                    {mode === "board" ? "Board" : "Galaxy"}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handlePaletteOpen}
              className="rounded-xl border border-[rgba(165,175,255,0.14)] bg-[rgba(165,175,255,0.05)] px-3.5 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.09em] text-[#c9d0ff] transition hover:border-[rgba(165,175,255,0.4)] hover:bg-[rgba(165,175,255,0.12)] hover:text-white"
            >
              &#8984;K
            </button>

            <button
              type="button"
              onClick={() => setObservatoryOpen(true)}
              aria-expanded={observatoryOpen}
              className="rounded-xl border border-[rgba(165,175,255,0.14)] bg-[rgba(165,175,255,0.05)] px-3.5 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.09em] text-[#c9d0ff] transition hover:border-[rgba(165,175,255,0.4)] hover:bg-[rgba(165,175,255,0.12)] hover:text-white"
            >
              Settings
            </button>
          </div>
        </header>


        <div className="board-wrapper">
          {view === "board" ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <Board
                tasks={visibleTasks}
                onCardClick={handleCardClick}
                onAdd={(status) => handleAddTask(status, "click")}
                onOpenTask={handleOpenTaskById}
                onMoveTask={(taskId, next) => handleMoveTask(taskId, next, "menu")}
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
            <React.Suspense
              fallback={<div className="min-h-[360px] animate-pulse rounded-3xl border border-white/5 bg-white/[0.02]" />}
            >
              <GraphView
                tasks={visibleTasks}
                etherealTasks={etherealTasks}
                onOpenTask={handleOpenTaskById}
                onCreateTether={handleCreateTether}
                onConstellationsChange={setConstellations}
                tethers={tethers}
                constellations={constellations}
              />
            </React.Suspense>
          )}
        </div>


        <StatusBar tasks={visibleTasks} />
      </main>

      <input
        ref={importInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={handleImportTasks}
      />

      <Observatory open={observatoryOpen} onClose={() => setObservatoryOpen(false)}>
        <IntentSurface />
      </Observatory>

      {isModalOpen ? (
        <TaskModal
          mode={modalMode}
          initialTask={draftTask ?? undefined}
          onSave={handleSaveTask}
          onClose={closeModal}
          onMove={(taskId, next) => handleMoveTask(taskId, next, "menu")}
          onMarkDone={(taskId) => handleMoveTask(taskId, "DONE", "menu")}
          onDelete={handleDeleteTask}
          onEther={handleSendToEther}
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
