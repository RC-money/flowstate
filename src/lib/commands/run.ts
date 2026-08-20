import { touchTask, type Task } from "../../hooks/useLocalTasks";
import { isLive, type Cluster } from "../clusters/clusters";
import { DEFAULT_COLUMNS } from "../columns/columns";
import { stampCompletion } from "../earnedStars";
import { decayLevel } from "../orbitalDecay";
import { resolve, resolveCluster } from "./resolve";
import type { Command, ListFilter } from "./types";

export interface CommandResult {
  /** The next board. Identical to the input when the command was refused. */
  tasks: Task[];
  /** What to show the user. */
  message: string;
  /** Populated by read-only commands. */
  listed?: Task[];
  /**
   * The board as it was before this command. Present only when tasks actually
   * changed -- its absence is how callers know there is nothing to revert.
   */
  undo?: Task[];
  /** Which cluster the board should show next. Only `switch` sets it. */
  activeClusterId?: string;
}

/** What `run` needs to know beyond the tasks themselves. All optional, so a
 * caller that has never heard of clusters still behaves as it always did. */
export interface RunOptions {
  clusters?: Cluster[];
  /** The cluster the user is looking at. New tasks land here. */
  activeClusterId?: string;
  makeId?: (now: number) => string;
}

const defaultId = (now: number): string =>
  `t_${now}_${Math.random().toString(36).slice(2, 8)}`;

/** Matches the board's own notion of a live task (see App.tsx visibleTasks). */
const isOpen = (task: Task): boolean =>
  task.status !== "DONE" && !task.darkForest && task.etheredAt === undefined;

const quote = (tasks: Task[]): string => tasks.map((task) => `"${task.title}"`).join(", ");

/**
 * Tasks still on the board. Work inside an ethered cluster is out in the deep
 * field and does not answer questions about what's open. Callers that pass no
 * clusters -- an MCP server on an older board -- see everything, as before.
 */
const visible = (tasks: Task[], clusters?: Cluster[]): Task[] => {
  if (!clusters?.length) return tasks;
  const gone = new Set(clusters.filter((cluster) => !isLive(cluster)).map((c) => c.id));
  if (!gone.size) return tasks;
  return tasks.filter((task) => !task.clusterId || !gone.has(task.clusterId));
};

/**
 * Stages 2 and 3: resolve the user's words to a real task, then act.
 *
 * Every mutation returns the previous board as `undo`. Nothing here can touch
 * anything but tasks -- styling, layout, biomes and the graph are unreachable
 * by construction, which is the whole gate. Refusing is always preferred to
 * guessing: an ambiguous or unmatched target changes nothing.
 */
export const run = (
  command: Command,
  tasks: Task[],
  now: number,
  options: RunOptions = {}
): CommandResult => {
  const { clusters, activeClusterId, makeId = defaultId } = options;
  const refuse = (message: string): CommandResult => ({ tasks, message });
  const mutate = (next: Task[], message: string): CommandResult => ({
    tasks: next,
    message,
    undo: tasks,
  });

  /** Shared front half of every targeted command. */
  const withTarget = (
    target: string,
    act: (task: Task) => CommandResult
  ): CommandResult => {
    const found = resolve(target, tasks);
    if (found.kind === "miss") return refuse(`No task matches "${target}".`);
    if (found.kind === "ambiguous") {
      return refuse(`"${target}" could mean ${quote(found.candidates)}. Be more specific.`);
    }
    return act(found.task);
  };

  /** The same front half for a cluster name. Refuses on the same terms. */
  const withCluster = (
    target: string,
    act: (cluster: Cluster) => CommandResult
  ): CommandResult => {
    const found = resolveCluster(target, clusters ?? []);
    if (found.kind === "miss") return refuse(`No cluster matches "${target}".`);
    if (found.kind === "ambiguous") {
      const names = found.candidates.map((cluster) => `"${cluster.name}"`).join(", ");
      return refuse(`"${target}" could mean ${names}. Be more specific.`);
    }
    return act(found.cluster);
  };

  const replace = (id: string, change: (task: Task) => Task): Task[] =>
    tasks.map((task) => (task.id === id ? change(task) : task));

  /** The board this task lives on, which is what says where its finish line is. */
  const columnsFor = (task: Task) =>
    clusters?.find((cluster) => cluster.id === task.clusterId)?.columns ?? DEFAULT_COLUMNS;

  switch (command.kind) {
    case "move":
      return withTarget(command.target, (task) => {
        if (task.status === command.to) {
          return refuse(`"${task.title}" is already in ${command.to}.`);
        }
        const next = replace(task.id, (current) =>
          touchTask(
            {
              ...stampCompletion(current, command.to, now, columnsFor(current)),
              status: command.to,
            },
            now
          )
        );
        return mutate(next, `Moved "${task.title}" to ${command.to}.`);
      });

    case "darkForest":
      return withTarget(command.target, (task) => {
        if (task.darkForest) return refuse(`"${task.title}" is already resting.`);
        const next = replace(task.id, (current) =>
          touchTask({ ...current, darkForest: true }, now)
        );
        return mutate(next, `"${task.title}" is resting in the Dark Forest.`);
      });

    case "restore":
      return withTarget(command.target, (task) => {
        if (!task.darkForest) return refuse(`"${task.title}" is already on the board.`);
        const next = replace(task.id, (current) =>
          touchTask({ ...current, darkForest: false }, now)
        );
        return mutate(next, `Restored "${task.title}".`);
      });

    case "create": {
      const title = command.title.trim();
      if (!title) return refuse("A task needs a title.");
      const created: Task = {
        id: makeId(now),
        title,
        status: "TO-DO",
        createdAt: now,
        updatedAt: now,
        ...(activeClusterId ? { clusterId: activeClusterId } : {}),
      };
      return mutate([...tasks, created], `Added "${title}".`);
    }

    case "switch":
      return withCluster(command.target, (cluster) => ({
        tasks,
        message: `Switched to "${cluster.name}".`,
        activeClusterId: cluster.id,
      }));

    case "assign":
      return withTarget(command.target, (task) =>
        withCluster(command.cluster, (cluster) => {
          if (task.clusterId === cluster.id) {
            return refuse(`"${task.title}" is already in "${cluster.name}".`);
          }
          const next = replace(task.id, (current) =>
            touchTask({ ...current, clusterId: cluster.id }, now)
          );
          return mutate(next, `Moved "${task.title}" to "${cluster.name}".`);
        })
      );

    case "list": {
      const listed = selectList(command.filter, visible(tasks, clusters), now);
      return {
        tasks,
        listed,
        message: listed.length
          ? `${listed.length} ${describeFilter(command.filter)}.`
          : `Nothing ${describeFilter(command.filter)}.`,
      };
    }

    case "unknown":
      return refuse(`I didn't catch that. Try "what's open" or "move [task] to done".`);
  }
};

const FILTER_LABELS: Record<ListFilter, string> = {
  open: "open",
  done: "finished",
  decaying: "slipping",
  dark: "resting in the Dark Forest",
};

const describeFilter = (filter: ListFilter): string => FILTER_LABELS[filter];

const selectList = (filter: ListFilter, tasks: Task[], now: number): Task[] => {
  switch (filter) {
    case "done":
      return tasks.filter((task) => task.status === "DONE");
    case "dark":
      return tasks.filter((task) => task.darkForest);
    case "decaying":
      return tasks
        .filter((task) => isOpen(task) && decayLevel(task.updatedAt, now) > 0)
        .sort((a, b) => decayLevel(b.updatedAt, now) - decayLevel(a.updatedAt, now));
    case "open":
      return tasks.filter(isOpen);
  }
};
