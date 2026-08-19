import type { TaskStatus } from "../../hooks/useLocalTasks";
import type { Command, ListFilter } from "./types";

/** Lowercase, collapse runs of whitespace, drop surrounding space. */
const normalize = (text: string): string =>
  text.trim().toLowerCase().replace(/\s+/g, " ");

const STATUS_WORDS: ReadonlyArray<[RegExp, TaskStatus]> = [
  [/^(done|finished|complete[d]?)$/, "DONE"],
  [/^(in progress|progress|doing|started)$/, "IN PROGRESS"],
  [/^(to-?do|open|backlog|later)$/, "TO-DO"],
];

const toStatus = (word: string): TaskStatus | null => {
  for (const [pattern, status] of STATUS_WORDS) {
    if (pattern.test(word)) return status;
  }
  return null;
};

const LIST_WORDS: ReadonlyArray<[RegExp, ListFilter]> = [
  [/^(open|left|remaining|to-?do|outstanding)$/, "open"],
  [/^(rotting|decaying|stale|rotten|slipping)$/, "decaying"],
  [/^(done|finished|complete[d]?)$/, "done"],
  [/^(dark|dark forest|archived|resting)$/, "dark"],
];

const toListFilter = (word: string): ListFilter | null => {
  for (const [pattern, filter] of LIST_WORDS) {
    if (pattern.test(word)) return filter;
  }
  return null;
};

/**
 * Stage 1: turn a sentence into a Command. Deterministic, offline, and the
 * only stage that is ever allowed to be ambiguous. Anything it cannot place
 * comes back as `unknown` -- callers may hand that to a model, but the model
 * still has to answer in this same vocabulary.
 */
export const parse = (text: string): Command => {
  const input = normalize(text);
  const unknown: Command = { kind: "unknown", text: text.trim() };

  const listMatch = input.match(/^(?:what'?s|what is|show(?: me)?|list)\s+(.+)$/);
  if (listMatch) {
    const filter = toListFilter(listMatch[1]);
    if (filter) return { kind: "list", filter };
  }

  const moveMatch = input.match(/^(?:move|put|send)\s+(.+?)\s+(?:to|into)\s+(.+)$/);
  if (moveMatch) {
    const to = toStatus(moveMatch[2]);
    if (to) return { kind: "move", target: moveMatch[1], to };
  }

  return unknown;
};
