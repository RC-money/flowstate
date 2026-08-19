import type { TaskStatus } from "../../hooks/useLocalTasks";

/**
 * The complete vocabulary of things Flowstate can be told to do.
 *
 * This union IS the gate. Anything reaching the board -- the palette, an
 * on-device model, an MCP tool -- can only express itself as one of these,
 * so board operations are reachable and styling/layout/biomes are not.
 *
 * `target` is the user's own words, never an id. Resolving words to a real
 * task is `resolve`'s job, so no assistant can invent an id.
 */
export type Command =
  | { kind: "move"; target: string; to: TaskStatus }
  | { kind: "list"; filter: ListFilter }
  | { kind: "darkForest"; target: string }
  | { kind: "restore"; target: string }
  | { kind: "create"; title: string }
  | { kind: "unknown"; text: string };

export type ListFilter = "open" | "done" | "decaying" | "dark";
