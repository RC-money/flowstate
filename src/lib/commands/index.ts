import type { Task } from "../../hooks/useLocalTasks";
import { parse } from "./parse";
import { run, type CommandResult } from "./run";

export type { Command, ListFilter } from "./types";
export type { CommandResult } from "./run";
export type { Resolution } from "./resolve";
export { parse } from "./parse";
export { resolve } from "./resolve";
export { run } from "./run";

/**
 * The one entry point. Plain English in, a board change or an answer out.
 *
 * The ⌘K palette calls this. An on-device model or an MCP tool calls `run`
 * with a Command it produced -- same gate, same undo, same refusals. Nothing
 * reaches the board except through here.
 */
export const execute = (
  text: string,
  tasks: Task[],
  now: number
): CommandResult => run(parse(text), tasks, now);
