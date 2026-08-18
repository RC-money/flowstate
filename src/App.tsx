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
import { useHotkeys } from "./hooks/useHotkeys";
import CommandPalette, { type Command } from "./components/CommandPalette";
import AskFlowPanel from "./components/AskFlowPanel";
import { ToastProvider, useToast } from "./components/Toast";
import { logEvent, setAnalyticsEnabled } from "./lib/analytics";
import { useLocalTasks, touchTask, type Task, type TaskStatus } from "./hooks/useLocalTasks";
import { stampCompletion } from "./lib/earnedStars";
import { decayLevel, DARK_FOREST_THRESHOLD } from "./lib/orbitalDecay";
import IntentSurface from "./components/IntentSurface";
import GenesisForge, { type GenesisPayload } from "./components/GenesisForge";
import StrangeLoopPanel from "./components/StrangeLoopPanel";
import CosmicEventBanner from "./components/CosmicEventBanner";
import DarkForestPanel from "./components/DarkForestPanel";
import PatternJournal from "./components/PatternJournal";
import { useObserverEngine } from "./engine/observer/hooks";
import { useStrangeLoop } from "./engine/strangeLoop";
import { useCosmicEvents } from "./engine/events";
import { useJester } from "./engine/council";
import { useBiome } from "./engine/biomes";
import PersonaPanel from "./components/PersonaPanel";
import SignalLine from "./components/SignalLine";
import Observatory from "./components/Observatory";
import { PERSONA_ROSTER, usePersona } from "./paradox/council";
import { useReflectionJournal } from "./hooks/useReflectionJournal";
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

const getTimeOfDay = (): "dawn" | "day" | "dusk" | "night" => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 10) return "dawn";
  if (hour >= 10 && hour < 17) return "day";
  if (hour >= 17 && hour < 21) return "dusk";
  return "night";
};

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
  const { updateMetrics, intent: biomeIntent, metrics: biomeMetrics } = useBiome();
  const { tethers, constellations, addTether, setConstellations } = useCelestialStructures();
  const { reflections, addReflection } = useReflectionJournal();
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
  const { engine: observerEngine, insights: observerInsights } = useObserverEngine({ tasks });
  const [entropyLookup, setEntropyLookup] = useState<Record<string, number>>({});
  const visibleTasks = useMemo(() => tasks.filter((task) => !task.darkForest), [tasks]);
  const darkForestTasks = useMemo(() => tasks.filter((task) => task.darkForest), [tasks]);
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
  const darkForestCandidates = useMemo(() => {
    const now = Date.now();
    return visibleTasks.filter(
      (task) =>
        (entropyLookup[task.id] ?? 0) > 0.8 ||
        // Orbital decay: long-neglected unfinished work is offered to the
        // Dark Forest -- suggested, never auto-archived.
        (task.status !== "DONE" && decayLevel(task.updatedAt, now) >= DARK_FOREST_THRESHOLD)
    );
  }, [visibleTasks, entropyLookup]);

  const hasDarkForestSignal = darkForestCandidates.length > 0 || darkForestTasks.length > 0;

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
  const {
    activeEvent,
    alertsEnabled: cosmicAlertsEnabled,
    toggleAlerts,
  } = useCosmicEvents({
    metrics: {
      avgHeat: biomeMetrics.avgHeat,
      avgEntropy: biomeMetrics.avgEntropy,
      tetherCount: tethers.length,
      constellationCount: constellations.length,
    },
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
    const lookup: Record<string, number> = {};
    signals.forEach((signal: { taskId?: string; entropy?: number }) => {
      if (signal.taskId) {
        lookup[signal.taskId] = signal.entropy ?? 0;
      }
    });
    setEntropyLookup(lookup);
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

  const darkForestCount = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.status === "TO-DO" &&
          (task.tags?.includes("dark-forest") || task.title.toLowerCase().includes("[df]"))
      ).length,
    [tasks]
  );

  const persona = usePersona({
    avgHeat: biomeMetrics.avgHeat,
    avgEntropy: biomeMetrics.avgEntropy,
    darkForestCount,
    recentInsights: observerInsights.map((insight) => ({ kind: insight.kind, taskIds: insight.taskIds })),
    timeOfDay: getTimeOfDay(),
    userIntent: biomeIntent,
  });
  useEffect(() => {
    if (activeEvent && cosmicAlertsEnabled) {
      pushToast(activeEvent.message, "warn");
    }
  }, [activeEvent, cosmicAlertsEnabled, pushToast]);
  const handleReflectionSubmit = useCallback(
    (response: string) => {
      if (!strangeLoopQuestion) return;
      const relatedConstellations = constellations
        .filter((constellation) => strangeLoopQuestion.taskId && constellation.memberIds.includes(strangeLoopQuestion.taskId))
        .map((constellation) => constellation.id);
      addReflection({
        questionId: strangeLoopQuestion.id,
        question: strangeLoopQuestion.message,
        response,
        personaId: persona.id,
        relatedTaskIds: strangeLoopQuestion.taskId ? [strangeLoopQuestion.taskId] : [],
        constellationIds: relatedConstellations,
      });
      refreshStrangeLoop();
    },
    [strangeLoopQuestion, constellations, addReflection, persona.id, refreshStrangeLoop]
  );

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

  const handleSendToDarkForest = useCallback(
    (taskId: string) => {
      setTasks((prev) =>
        prev.map((task) => (task.id === taskId ? touchTask({ ...task, darkForest: true }) : task))
      );
      pushToast("Archivist: Let it rest in the Dark Forest.", "success");
    },
    [pushToast, setTasks]
  );

  const handleRestoreFromDarkForest = useCallback(
    (taskId: string) => {
      setTasks((prev) =>
        prev.map((task) => (task.id === taskId ? touchTask({ ...task, darkForest: false }) : task))
      );
      pushToast("Archivist: Brought back from the Dark Forest.", "success");
    },
    [pushToast, setTasks]
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
    [focusedColumn, handleAddTask, handleExportTasks]
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
    ({ title, description, kind, position }: GenesisPayload) => {
      const statusMap: Record<GenesisPayload["kind"], Status> = {
        sun: "IN PROGRESS",
        moon: "DONE",
        asteroid: "TO-DO",
        comet: "TO-DO",
        "gas-giant": "IN PROGRESS",
      };
      const status = statusMap[kind] ?? "TO-DO";
      const nextTask = {
        ...createBlankTask(status),
        title,
        description,
        orbitSeed: position,
      };
      setTasks((prev) => [...prev, nextTask]);
      pushToast(`Condensed a new ${kind.toUpperCase()}`, "success");
      logEvent({ type: "task:add", source: "click" });
    },
    [pushToast, setTasks]
  );

  // Only counts signals that are genuinely waiting on the user, so the badge
  // never nags about an empty drawer.
  const observatorySignals =
    darkForestCandidates.length + (strangeLoopQuestion ? 1 : 0) + (activeEvent ? 1 : 0);

  return (
    <>
      {showGraph ? (
        <div className="pointer-events-none fixed inset-0 -z-10">
          <React.Suspense fallback={null}>
            <GraphView tasks={tasks} onOpenTask={handleOpenTaskById} onCreateTether={handleCreateTether} />
          </React.Suspense>
        </div>
      ) : null}
      <main className="mx-auto max-w-screen-2xl px-4 py-8 text-white">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-baseline gap-4">
            <h1 className="sr-only">Flowstate</h1>
            <p
              aria-hidden="true"
              className="text-2xl font-extrabold tracking-[0.18em] text-white"
            >
              FLOWSTATE
            </p>
            <p className="hidden text-sm text-[#8aa0b8] sm:block">Your tasks, in motion.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
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
                    className={`rounded-xl px-4 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                      isActive ? "bg-white text-[#0B1220]" : "text-[#8aa0b8] hover:text-white"
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
              className="rounded-xl border border-white/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white/90 transition hover:border-white/40 hover:bg-white/10"
            >
              &#8984;K
            </button>

            <button
              type="button"
              onClick={() => setObservatoryOpen(true)}
              aria-expanded={observatoryOpen}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white/90 transition hover:border-white/40 hover:bg-white/10"
            >
              <span aria-hidden="true">&#9737;</span>
              Observatory
              {observatorySignals > 0 ? (
                <span className="rounded-full bg-white/15 px-1.5 text-[10px] tabular-nums">
                  {observatorySignals}
                </span>
              ) : null}
            </button>
          </div>
        </header>

        <SignalLine
          persona={persona}
          event={activeEvent}
          onOpenObservatory={() => setObservatoryOpen(true)}
        />

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
            <React.Suspense
              fallback={<div className="min-h-[360px] animate-pulse rounded-3xl border border-white/5 bg-white/[0.02]" />}
            >
              <GraphView
                tasks={visibleTasks}
                onOpenTask={handleOpenTaskById}
                onCreateTether={handleCreateTether}
                onConstellationsChange={setConstellations}
                tethers={tethers}
                constellations={constellations}
              />
            </React.Suspense>
          )}
        </div>
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
        <div className="mt-4">
          <GenesisForge onGenesis={handleGenesisCreate} />
        </div>
        <CosmicEventBanner
          event={activeEvent}
          alertsEnabled={cosmicAlertsEnabled}
          onToggleAlerts={toggleAlerts}
        />
        <StrangeLoopPanel
          question={strangeLoopQuestion}
          personaName={persona.name}
          onRefresh={refreshStrangeLoop}
          onReflect={handleReflectionSubmit}
        />
        <PersonaPanel persona={persona} />
        {hasDarkForestSignal ? (
          <DarkForestPanel
            candidates={darkForestCandidates}
            archived={darkForestTasks}
            onArchive={handleSendToDarkForest}
            onRestore={handleRestoreFromDarkForest}
          />
        ) : null}
        {reflections.length ? (
          <PatternJournal
            reflections={reflections}
            personas={Object.values(PERSONA_ROSTER).map((personaMeta) => ({
              ...personaMeta,
              rationale: "",
              questionTemplates: [],
            }))}
            constellations={constellations}
          />
        ) : null}
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
