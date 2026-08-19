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
import { coerceTasks, type Task, type TaskStatus } from "../src/hooks/useLocalTasks";

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

const loadBoard = async (): Promise<Task[]> => {
  try {
    const raw = await readFile(FILE, "utf8");
    return coerceTasks(JSON.parse(raw)) ?? [];
  } catch {
    return [];
  }
};

const saveBoard = async (tasks: Task[]): Promise<void> => {
  await mkdir(dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(tasks, null, 2), "utf8");
};

/** One level of undo, in memory, per session. */
let lastUndo: Task[] | null = null;

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

const brief = (task: Task) => ({
  title: task.title,
  status: task.status,
  ...(task.dueDate ? { dueDate: task.dueDate } : {}),
  ...(task.tags?.length ? { tags: task.tags } : {}),
  ...(task.darkForest ? { darkForest: true } : {}),
});

const executeCommand = (command: Command) => serialized(async () => {
  const tasks = await loadBoard();
  const result = run(command, tasks, Date.now());
  if (result.undo) {
    await saveBoard(result.tasks);
    lastUndo = result.undo;
  }
  const payload = {
    message: result.message,
    ...(result.listed ? { tasks: result.listed.map(brief) } : {}),
  };
  return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }] };
});

const server = new McpServer({ name: "flowstate", version: "0.1.0" });

const STATUS = z.enum(["TO-DO", "IN PROGRESS", "DONE"]);

server.tool(
  "flow_list",
  "List tasks on the Flowstate board. Filters: open (default), done, decaying (neglected, worst first), dark (resting in the Dark Forest).",
  { filter: z.enum(["open", "done", "decaying", "dark"]).default("open") },
  async ({ filter }) => executeCommand({ kind: "list", filter })
);

server.tool(
  "flow_move",
  "Move a task to a status. Describe the task in words; Flowstate resolves which task you mean and refuses if ambiguous.",
  { target: z.string().describe("The task, in your words"), to: STATUS },
  async ({ target, to }) => executeCommand({ kind: "move", target, to: to as TaskStatus })
);

server.tool(
  "flow_create",
  "Add a new task to the board (always lands in TO-DO).",
  { title: z.string() },
  async ({ title }) => executeCommand({ kind: "create", title })
);

server.tool(
  "flow_dark_forest",
  "Let a task rest in the Dark Forest -- an honest 'not doing this now'. Restorable, never deleted.",
  { target: z.string() },
  async ({ target }) => executeCommand({ kind: "darkForest", target })
);

server.tool(
  "flow_restore",
  "Restore a task from the Dark Forest to the board.",
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
