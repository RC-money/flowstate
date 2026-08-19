import type { Task } from "../../hooks/useLocalTasks";
import { decideHydration, type Hydration } from "./hydrate";
import { shouldAdoptExternalChange } from "./external";

export { decideHydration } from "./hydrate";
export { shouldAdoptExternalChange } from "./external";
export type { Hydration } from "./hydrate";
export type { ExternalChange } from "./external";

/**
 * Where the board lives. Two implementations: the browser keeps localStorage,
 * the Tauri app keeps a JSON file in its app-data directory. Everything above
 * this interface is identical in both worlds.
 */
export interface TaskStore {
  load(): Promise<string | null>;
  save(serialized: string): Promise<void>;
  /**
   * Calls back when the board changes underneath us -- the MCP server writing
   * while the app is open. Returns an unsubscribe. Absent where nothing else
   * can touch the data (the browser owns its own localStorage).
   */
  watch?(onExternal: (tasks: Task[]) => void): Promise<() => void>;
}

const LEGACY_KEY = "flowstate:v1:tasks";
const FILE_NAME = "tasks.json";

const localStorageStore = (): TaskStore => ({
  async load() {
    return window.localStorage.getItem(LEGACY_KEY);
  },
  async save(serialized) {
    window.localStorage.setItem(LEGACY_KEY, serialized);
  },
});

/** What we last wrote, so the watcher can tell our echo from a real change. */
let lastWritten: string | null = null;

/** Lazily imports the Tauri fs plugin so browser builds never load it. */
const tauriFileStore = (): TaskStore => {
  const fs = () => import("@tauri-apps/plugin-fs");
  return {
    async load() {
      const { readTextFile, exists, BaseDirectory } = await fs();
      if (!(await exists(FILE_NAME, { baseDir: BaseDirectory.AppData }))) return null;
      return readTextFile(FILE_NAME, { baseDir: BaseDirectory.AppData });
    },
    async save(serialized) {
      const { writeTextFile, mkdir, BaseDirectory } = await fs();
      await mkdir("", { baseDir: BaseDirectory.AppData, recursive: true }).catch(() => {});
      lastWritten = serialized;
      await writeTextFile(FILE_NAME, serialized, { baseDir: BaseDirectory.AppData });
    },
    async watch(onExternal) {
      // Debounced: one save emits several filesystem events.
      const { watch, readTextFile, exists, BaseDirectory } = await fs();
      const unwatch = await watch(
        FILE_NAME,
        async () => {
          try {
            if (!(await exists(FILE_NAME, { baseDir: BaseDirectory.AppData }))) return;
            const raw = await readTextFile(FILE_NAME, { baseDir: BaseDirectory.AppData });
            const change = shouldAdoptExternalChange(raw, lastWritten);
            if (change.adopt && change.tasks) onExternal(change.tasks);
          } catch (error) {
            console.error("[flowstate] Watch read failed:", error);
          }
        },
        { baseDir: BaseDirectory.AppData, delayMs: 150 }
      );
      return unwatch;
    },
  };
};

export const isTauri = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const createTaskStore = (): TaskStore =>
  isTauri() ? tauriFileStore() : localStorageStore();

/**
 * Loads the board through the store, falling back to legacy localStorage for
 * the one-time migration into the Tauri file. When legacy data is adopted it
 * is written to the file immediately, so the next launch reads "file".
 */
export const hydrateFromStore = async (store: TaskStore): Promise<Hydration> => {
  const fileRaw = await store.load().catch(() => null);
  const legacyRaw =
    typeof window !== "undefined" ? window.localStorage.getItem(LEGACY_KEY) : null;
  const hydration = decideHydration(fileRaw, legacyRaw);
  if (hydration.source === "file" && fileRaw !== null) lastWritten = fileRaw;
  if (hydration.source === "legacy" && hydration.tasks) {
    await store.save(JSON.stringify(hydration.tasks)).catch((error) => {
      console.error("[flowstate] Legacy migration write failed:", error);
    });
  }
  return hydration;
};

export type { Task };
