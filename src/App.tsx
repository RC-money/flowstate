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
import MeteorShower from "./components/MeteorShower";
import StatusBar from "./components/StatusBar";
import { useHotkeys } from "./hooks/useHotkeys";
import { useAmbientAudio } from "./hooks/useAmbientAudio";
import orbit1Url from "./assets/orbit1.mp3";
import orbit2Url from "./assets/orbit2.mp3";

const MUSIC_TRACKS: MusicTrack[] = [
  {
    id: "orbit-1",
    label: "Orbit I",
    src: orbit1Url,
    melody: ["G4", "A4", "C5", "D5", "E5", "D5", "C5", "A4"],
  },
  {
    id: "orbit-2",
    label: "Orbit II",
    src: orbit2Url,
    melody: ["E5", "D5", "C5", "A4", "C5", "D5", "E5", "G5"],
  },
];
import CommandPalette, { type Command } from "./components/CommandPalette";
import AskFlowPanel from "./components/AskFlowPanel";
import Welcome from "./components/Welcome";
import { shouldShowWelcome } from "./lib/storage/firstRun";
import { ToastProvider, useToast } from "./components/Toast";
import { logEvent, setAnalyticsEnabled } from "./lib/analytics";
import { useLocalTasks, touchTask, type Task, type TaskStatus } from "./hooks/useLocalTasks";
import {
  canEther,
  etherCluster,
  liveClusters,
  makeCluster,
  nextActiveClusterId,
  tasksInCluster,
} from "./lib/clusters/clusters";
import ClusterSwitcher from "./components/ClusterSwitcher";
import {
  DEFAULT_COLUMNS,
  addColumn,
  isTerminal,
  removeColumn,
  renameColumn,
  terminalColumnId,
  type Column,
} from "./lib/columns/columns";
import { stampCompletion } from "./lib/earnedStars";
import { appendLogEvent } from "./lib/taskLog";
import IntentSurface from "./components/IntentSurface";
import MusicPanel, { type MusicTrack } from "./components/MusicPanel";
import { useObserverEngine } from "./engine/observer/hooks";
import { useCosmicEvents } from "./engine/events";
import { useBiome } from "./engine/biomes";
import Observatory from "./components/Observatory";
import CelestialPanel from "./components/CelestialPanel";
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
const WELCOME_KEY = "flowstate:v1:welcomed";
const CLUSTER_KEY = "flowstate:cluster";

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
          <MeteorShower />
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
  const [tasks, setTasks, hydration, clusters, setClusters] = useLocalTasks(initialTasks);
  const [activeClusterId, setActiveClusterId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.sessionStorage.getItem(CLUSTER_KEY);
  });
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
  const [dismissedWelcome, setDismissedWelcome] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(WELCOME_KEY) !== null;
  });
  // Waits for hydration: deciding before the stored board loads would show
  // "start with empty space" over real work.
  const showWelcome =
    hydration.ready &&
    shouldShowWelcome({ welcomed: dismissedWelcome, storedBoard: hydration.storedBoard });
  const handleWelcomeChoice = useCallback(
    (startEmpty: boolean) => {
      window.localStorage.setItem(WELCOME_KEY, "1");
      setDismissedWelcome(true);
      if (startEmpty) setTasks([]);
    },
    [setTasks]
  );
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const lastAddSourceRef = useRef<"keyboard" | "click">("click");
  const { engine: observerEngine } = useObserverEngine({ tasks });
  const liveClusterList = useMemo(() => liveClusters(clusters), [clusters]);
  // One cluster at a time. Everything below reads the board through this, so a
  // task in another project never leaks onto the columns or into a count.
  const clusterTasks = useMemo(
    () => (activeClusterId ? tasksInCluster(tasks, activeClusterId) : tasks),
    [tasks, activeClusterId]
  );
  const visibleTasks = useMemo(
    () => clusterTasks.filter((task) => !task.darkForest && task.etheredAt === undefined),
    [clusterTasks]
  );
  const openCountsByCluster = useMemo(() => {
    const counts: Record<string, number> = {};
    tasks.forEach((task) => {
      if (task.darkForest || task.etheredAt !== undefined || task.status === "DONE") return;
      const id = task.clusterId;
      if (!id) return;
      counts[id] = (counts[id] ?? 0) + 1;
    });
    return counts;
  }, [tasks]);
  const activeCluster = useMemo(
    () => liveClusterList.find((cluster) => cluster.id === activeClusterId) ?? null,
    [liveClusterList, activeClusterId]
  );
  // The board's own columns. Its last one is the finish line.
  const activeColumns = useMemo(
    () => activeCluster?.columns ?? DEFAULT_COLUMNS,
    [activeCluster]
  );
  const activeCanEther = useMemo(
    () => (activeCluster ? canEther(tasks, activeCluster) : false),
    [tasks, activeCluster]
  );
  const etherealTasks = useMemo(
    () => clusterTasks.filter((task) => task.etheredAt !== undefined),
    [clusterTasks]
  );
  const darkForestTasks = useMemo(
    () => clusterTasks.filter((task) => task.darkForest),
    [clusterTasks]
  );

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
      if (!task || !isTerminal(activeColumns, task.status)) return;
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
            ? touchTask(
                stampCompletion(
                  { ...task, status: nextStatus },
                  nextStatus,
                  Date.now(),
                  activeColumns
                )
              )
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
        kind: isTerminal(activeColumns, nextStatus) ? "completed" : "moved",
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
      // Drop targets are this board's own columns, however many it has.
      if (activeColumns.some((column) => column.id === overId)) {
        handleMoveTask(String(active.id), overId as Status, "drag");
      }
      setActiveId(null);
    },
    [handleMoveTask, activeColumns]
  );

  const handleSaveTask = useCallback(
    (task: Task) => {
      setTasks((prev) => {
        const stamped = stampCompletion(task, task.status, Date.now(), activeColumns);
        if (modalMode === "new") {
          return [...prev, { ...stamped, clusterId: activeClusterId ?? stamped.clusterId }];
        }
        return prev.map((t) =>
          t.id === task.id
            ? stampCompletion({ ...t, ...task }, task.status, Date.now(), activeColumns)
            : t
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
          kind:
            before && before.status !== task.status && isTerminal(activeColumns, task.status)
              ? "completed"
              : "edited",
          from: before?.status,
          to: task.status,
          title: task.title,
        });
        pushToast("Task updated", "success");
      }
      closeModal();
    },
    [modalMode, closeModal, pushToast, tasksById, activeClusterId, activeColumns]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem("flowstate:view", view);
  }, [view]);

  // The active cluster has to survive hydration, an outside edit, and its own
  // ethering. Reconciling against the cluster list covers all three: it keeps
  // the current one while it is live and falls to the oldest otherwise.
  useEffect(() => {
    setActiveClusterId((prev) => nextActiveClusterId(clusters, prev));
  }, [clusters]);

  useEffect(() => {
    if (typeof window === "undefined" || !activeClusterId) return;
    window.sessionStorage.setItem(CLUSTER_KEY, activeClusterId);
  }, [activeClusterId]);

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

  const handleCreateCluster = useCallback(
    (name: string) => {
      const now = Date.now();
      const cluster = makeCluster(name, now, `c_${now}_${Math.random().toString(36).slice(2, 8)}`);
      setClusters((prev) => [...prev, cluster]);
      setActiveClusterId(cluster.id);
      pushToast(`"${cluster.name}" is forming.`, "success");
    },
    [pushToast, setClusters]
  );

  const handleEtherCluster = useCallback(() => {
    if (!activeClusterId) return;
    const cluster = clusters.find((entry) => entry.id === activeClusterId);
    // Guarded here as well as in the UI: nothing should be able to end a
    // project that still has work in it.
    if (!cluster || !canEther(tasks, cluster)) return;
    setClusters((prev) => etherCluster(prev, activeClusterId, Date.now()));
    pushToast(`"${cluster.name}" is a galaxy now.`, "success");
  }, [activeClusterId, clusters, tasks, pushToast, setClusters]);

  /** Every column edit lands on the active cluster and nowhere else. */
  const editColumns = useCallback(
    (change: (columns: Column[]) => Column[]) => {
      if (!activeClusterId) return;
      setClusters((prev) =>
        prev.map((cluster) =>
          cluster.id === activeClusterId
            ? { ...cluster, columns: change(cluster.columns) }
            : cluster
        )
      );
    },
    [activeClusterId, setClusters]
  );

  const handleAddColumn = useCallback(
    (name: string) => {
      editColumns((columns) =>
        addColumn(columns, name, () => `col_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`)
      );
    },
    [editColumns]
  );

  const handleRenameColumn = useCallback(
    (columnId: string, name: string) => {
      editColumns((columns) => renameColumn(columns, columnId, name));
    },
    [editColumns]
  );

  /**
   * Removing a column has to say where its cards go, or they vanish from the
   * board while still sitting in the file. They fall back to the first column.
   */
  const handleRemoveColumn = useCallback(
    (columnId: string) => {
      const remaining = removeColumn(activeColumns, columnId);
      if (remaining === activeColumns) return;
      const landing = remaining[0].id;
      setTasks((prev) =>
        prev.map((task) =>
          task.clusterId === activeClusterId && task.status === columnId
            ? touchTask({ ...task, status: landing }, Date.now())
            : task
        )
      );
      editColumns(() => remaining);
    },
    [activeColumns, activeClusterId, editColumns, setTasks]
  );

  const handleViewChange = (nextView: ViewMode) => {
    setView(nextView);
  };

  // Cmd-1..9 jumps straight to a cluster. The pills carry the same numbers, so
  // the shortcut is discoverable rather than folklore.
  const clusterHotkeys = useMemo(
    () =>
      liveClusterList.slice(0, 9).map((cluster, index) => ({
        combo: `mod+${index + 1}`,
        handler: () => setActiveClusterId(cluster.id),
        enabled: !isModalOpen,
        preventDefault: true,
        stopPropagation: true,
      })),
    [liveClusterList, isModalOpen]
  );

  useHotkeys([
    ...clusterHotkeys,
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
    // Every palette entry answers to a key. The hook ignores keystrokes typed
    // into inputs, so these stay out of the way of the palette's own search.
    {
      combo: "o",
      handler: () => setObservatoryOpen(true),
      enabled: !isModalOpen,
      preventDefault: true,
      stopPropagation: true,
    },
    {
      combo: "a",
      handler: () => setAskOpen(true),
      enabled: !isModalOpen,
      preventDefault: true,
      stopPropagation: true,
    },
    {
      combo: "x",
      handler: () => handleExportTasks(),
      enabled: !isModalOpen,
      preventDefault: true,
      stopPropagation: true,
    },
    {
      combo: "i",
      handler: () => importInputRef.current?.click(),
      enabled: !isModalOpen,
      preventDefault: true,
      stopPropagation: true,
    },
    {
      combo: "r",
      handler: () => {
        darkForestTasks.forEach((task) => handleRestoreFromDarkForest(task.id));
      },
      enabled: !isModalOpen && darkForestTasks.length > 0,
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

  const { playingSrc, shuffle, toggle: toggleOrbit, toggleShuffle } = useAmbientAudio(
    MUSIC_TRACKS.map((track) => track.src)
  );

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
        label: "Ask Flow (board commands)",
        hint: "A",
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
              hint: "R",
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
        hint: "X",
        run: () => {
          logEvent({ type: "palette:run" });
          handleExportTasks();
        },
      },
      {
        id: "cmd-import",
        label: "Import tasks from JSON",
        hint: "I",
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
            <GraphView
              tasks={clusterTasks}
              onOpenTask={handleOpenTaskById}
              onCreateTether={handleCreateTether}
            />
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

          <div className="mt-3">
            <ClusterSwitcher
              clusters={liveClusterList}
              activeId={activeClusterId}
              counts={openCountsByCluster}
              onSelect={setActiveClusterId}
              onCreate={handleCreateCluster}
              canEther={activeCanEther}
              onEther={handleEtherCluster}
            />
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
                columns={activeColumns}
                onCardClick={handleCardClick}
                onAdd={(status) => handleAddTask(status, "click")}
                onOpenTask={handleOpenTaskById}
                onMoveTask={(taskId, next) => handleMoveTask(taskId, next, "menu")}
                onAddColumn={handleAddColumn}
                onRenameColumn={handleRenameColumn}
                onRemoveColumn={handleRemoveColumn}
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
        <MusicPanel
          tracks={MUSIC_TRACKS}
          playingSrc={playingSrc}
          shuffle={shuffle}
          onToggle={toggleOrbit}
          onToggleShuffle={toggleShuffle}
        />
        <CelestialPanel />
        <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Your data
          </p>
          <p className="mt-1.5 text-xs text-slate-500">
            Everything lives on this machine. Export is a plain JSON file — it is
            the whole board.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleExportTasks}
              className="rounded-xl border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200 transition hover:border-white/40 hover:bg-white/10"
            >
              Export JSON
            </button>
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:border-white/30 hover:bg-white/5"
            >
              Import
            </button>
          </div>
        </section>
      </Observatory>

      {isModalOpen ? (
        <TaskModal
          mode={modalMode}
          initialTask={draftTask ?? undefined}
          columns={activeColumns}
          onSave={handleSaveTask}
          onClose={closeModal}
          onMove={(taskId, next) => handleMoveTask(taskId, next, "menu")}
          onMarkDone={(taskId) => {
            const finishLine = terminalColumnId(activeColumns);
            if (finishLine) handleMoveTask(taskId, finishLine, "menu");
          }}
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

      <AskFlowPanel
        open={askOpen}
        onClose={() => setAskOpen(false)}
        tasks={tasks}
        onApply={setTasks}
        clusters={clusters}
        activeClusterId={activeClusterId}
        onSwitchCluster={setActiveClusterId}
      />
      {showWelcome ? <Welcome onChoose={handleWelcomeChoice} /> : null}
    </>
  );
}
