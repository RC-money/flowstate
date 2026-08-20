#!/usr/bin/env tsx
/**
 * Flowstate MCP server -- the user's own AI, invited to the board.
 *
 * Exposes exactly the Command vocabulary from src/lib/commands and nothing
 * else. Styling, layout, biomes, the Intent Surface, and the Pattern Journal
 * are unreachable by construction: there is no tool for them, so no model can
 * touch them. That absence is the gate (see CLAUDE.md).
 *
 * Reads and writes the same tasks.json the desktop app uses. Last write wins;
 * the app re-reads on launch.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { run } from "../src/lib/commands";
import type { Command } from "../src/lib/commands";
import { normalizeBoard, type Board } from "../src/lib/clusters/board";
import { liveClusters, nextActiveClusterId } from "../src/lib/clusters/clusters";
import type { Task } from "../src/hooks/useLocalTasks";

const dataFile = (): string => {
  if (process.env.FLOWSTATE_DATA) return process.env.FLOWSTATE_DATA;
  const home = homedir();
  switch (process.platform) {
    case "darwin":
      return join(home, "Library", "Application Support", "com.flowstate.app", "tasks.json");
    case "win32":
      return join(process.env.APPDATA ?? join(home, "AppData", "Roaming"), "com.flowstate.app", "tasks.json");
    default:
      return join(process.env.XDG_DATA_HOME ?? join(home, ".local", "share"), "com.flowstate.app", "tasks.json");
  }
};

const FILE = dataFile();

/**
 * The whole board, in whichever shape the file is written in.
 *
 * `normalizeBoard` accepts both the bare array every pre-clusters board used
 * and the `{ clusters, tasks }` object the app writes now, so an older file is
 * read rather than mistaken for an empty board.
 */
interface Loaded {
  board: Board;
  /**
   * The file is there but could not be read as a board. Distinct from "no file
   * yet", and the difference decides whether writing is safe: a half-written
   * save is a normal thing to catch mid-write, and its bytes are still the
   * user's data. Treating that as an empty board and saving over it destroys
   * work that was one retry away from being fine.
   */
  damaged: boolean;
}

const loadBoard = async (): Promise<Loaded> => {
  let raw: string;
  try {
    raw = await readFile(FILE, "utf8");
  } catch {
    // No file yet. A first write is expected to create one.
    return { board: { clusters: [], tasks: [] }, damaged: false };
  }
  let board: Board | null = null;
  try {
    board = normalizeBoard(JSON.parse(raw), Date.now());
  } catch {
    board = null;
  }
  if (!board) return { board: { clusters: [], tasks: [] }, damaged: true };
  return { board, damaged: false };
};

const DAMAGED = "The board file could not be read, so nothing was changed. It may be mid-write -- try again in a moment. If it stays unreadable, the file is damaged and needs looking at before anything writes over it.";

/**
 * Writes the whole board back, clusters included. Writing only the tasks --
 * which an earlier version of this file did -- silently deleted every cluster
 * the moment an assistant touched anything.
 */
const saveBoard = async (board: Board): Promise<void> => {
  await mkdir(dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(board, null, 2), "utf8");
};

/** One level of undo, in memory, per session. The whole board, not just its
 * tasks -- reverting to a bare task list would drop the clusters. */
let lastUndo: Board | null = null;

/**
 * Which cluster this session is working in. No window to read it from, so it
 * defaults to the oldest live one and moves when `flow_switch` says so.
 */
let activeClusterId: string | null = null;

/**
 * All board operations run through this queue. MCP clients may pipeline
 * requests; without serialization two handlers interleave their load/save
 * and one write clobbers the other (caught by the stdio smoke test).
 */
let queue: Promise<unknown> = Promise.resolve();
const serialized = <T>(work: () => Promise<T>): Promise<T> => {
  const next = queue.then(work, work);
  queue = next.catch(() => {});
  return next;
};

const brief = (task: Task, board?: Board) => ({
  title: task.title,
  status: task.status,
  ...(board && task.clusterId
    ? { cluster: board.clusters.find((c) => c.id === task.clusterId)?.name }
    : {}),
  ...(task.dueDate ? { dueDate: task.dueDate } : {}),
  ...(task.tags?.length ? { tags: task.tags } : {}),
  ...(task.darkForest ? { darkForest: true } : {}),
});

const executeCommand = (command: Command) => serialized(async () => {
  const { board, damaged } = await loadBoard();
  // Refuse rather than write. The alternative is reporting success while
  // replacing a damaged board with an empty one.
  if (damaged) {
    return { content: [{ type: "text" as const, text: DAMAGED }], isError: true };
  }
  activeClusterId = nextActiveClusterId(board.clusters, activeClusterId);
  const result = run(command, board.tasks, Date.now(), {
    clusters: board.clusters,
    ...(activeClusterId ? { activeClusterId } : {}),
  });
  if (result.undo) {
    await saveBoard({ clusters: board.clusters, tasks: result.tasks });
    lastUndo = { clusters: board.clusters, tasks: result.undo };
  }
  // `switch` changes nothing on the board; it reports where to work next.
  if (result.activeClusterId) activeClusterId = result.activeClusterId;
  const payload = {
    message: result.message,
    ...(result.listed ? { tasks: result.listed.map((task) => brief(task, board)) } : {}),
  };
  return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }] };
});

const server = new McpServer({ name: "flowstate", version: "0.1.0" });

/**
 * A column name, not one of three fixed statuses. Boards make their own
 * columns now, and an enum here made every custom column unreachable from an
 * assistant. `run` refuses a column the board does not have.
 */
const COLUMN = z
  .string()
  .describe("The column to move it to, by name -- whatever this board calls it");

server.tool(
  "flow_list",
  "List tasks on the Flowstate board. Filters: open (default), done, decaying (neglected, worst first), dark (set aside).",
  { filter: z.enum(["open", "done", "decaying", "dark"]).default("open") },
  async ({ filter }) => executeCommand({ kind: "list", filter })
);

server.tool(
  "flow_move",
  "Move a task to a status. Describe the task in words; Flowstate resolves which task you mean and refuses if ambiguous.",
  { target: z.string().describe("The task, in your words"), to: COLUMN },
  async ({ target, to }) => executeCommand({ kind: "move", target, to })
);

server.tool(
  "flow_create",
  "Add a new task to the board (always lands in TO-DO).",
  { title: z.string() },
  async ({ title }) => executeCommand({ kind: "create", title })
);

server.tool(
  "flow_clusters",
  "List the projects (clusters) on this board, and say which one you are working in. Each has its own columns.",
  {},
  async () => serialized(async () => {
    const { board, damaged } = await loadBoard();
    if (damaged) {
      return { content: [{ type: "text" as const, text: DAMAGED }], isError: true };
    }
    activeClusterId = nextActiveClusterId(board.clusters, activeClusterId);
    const payload = {
      working_in: board.clusters.find((c) => c.id === activeClusterId)?.name ?? null,
      clusters: liveClusters(board.clusters).map((cluster) => ({
        name: cluster.name,
        columns: cluster.columns.map((column) => column.name),
        tasks: board.tasks.filter((task) => task.clusterId === cluster.id).length,
      })),
    };
    return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }] };
  })
);

server.tool(
  "flow_switch",
  "Work in a different cluster. Everything after this -- adding, listing, moving -- happens there.",
  { target: z.string().describe("The cluster, in your words") },
  async ({ target }) => executeCommand({ kind: "switch", target })
);

server.tool(
  "flow_assign",
  "Move a task into a different cluster.",
  {
    target: z.string().describe("The task, in your words"),
    cluster: z.string().describe("The cluster to move it into"),
  },
  async ({ target, cluster }) => executeCommand({ kind: "assign", target, cluster })
);

server.tool(
  "flow_set_aside",
  "Set a task aside -- an honest 'not doing this now'. It leaves the board, stays in the file, and can be brought back.",
  { target: z.string() },
  async ({ target }) => executeCommand({ kind: "darkForest", target })
);

server.tool(
  "flow_bring_back",
  "Bring a task that was set aside back onto the board.",
  { target: z.string() },
  async ({ target }) => executeCommand({ kind: "restore", target })
);

server.tool(
  "flow_undo",
  "Revert the last change this session made to the board.",
  {},
  async () => serialized(async () => {
    if (!lastUndo) {
      return { content: [{ type: "text" as const, text: "Nothing to undo this session." }] };
    }
    await saveBoard(lastUndo);
    lastUndo = null;
    return { content: [{ type: "text" as const, text: "Reverted the last change." }] };
  })
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`[flowstate-mcp] serving board at ${FILE}`);
