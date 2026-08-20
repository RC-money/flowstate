import { useCallback, useEffect, useState } from "react";

interface ConnectPanelProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Where the board lives. The server defaults to this and the app writes it, so
 * an assistant needs no path configured -- only the command.
 */
const BOARD_FILE = "~/Library/Application Support/com.flowstate.app/tasks.json";

/**
 * Where the packaged app puts the server.
 *
 * One constant, because these snippets are copied and pasted: if this and what
 * the bundle actually ships ever disagree, every instruction on this screen is
 * wrong at once. Keep it in step with `resources` in tauri.conf.json.
 */
const SERVER_PATH = "/Applications/Flowstate.app/Contents/Resources/mcp/server.js";

interface Recipe {
  id: string;
  client: string;
  /** One line saying where this goes, in the client's own vocabulary. */
  where: string;
  snippet: string;
}

/**
 * For every assistant that cannot speak MCP but can open a file -- which is
 * most of them. Handing over the format and the rules directly is a wider door
 * than a config block, and it costs nothing to keep open.
 *
 * Everything stated here is load-bearing. An assistant that writes a timestamp
 * into dueDate, or a status no column has, produces a board that still loads
 * (the app repairs rather than rejects) but reads wrong to the person who owns
 * it.
 */
const HANDOVER_PROMPT = `You are managing my Flowstate task board. It is a single JSON file at:
~/Library/Application Support/com.flowstate.app/tasks.json

Read it before every change and write it back whole. The shape is:

{
  "clusters": [
    { "id": "c_1", "name": "Work", "createdAt": 1700000000000,
      "columns": [ { "id": "TO-DO", "name": "To-Do" }, { "id": "DONE", "name": "Done" } ] }
  ],
  "tasks": [
    { "id": "t_1", "title": "Refactor auth", "status": "TO-DO",
      "clusterId": "c_1", "createdAt": 1700000000000, "updatedAt": 1700000000000 }
  ]
}

Rules, all of which matter:

- A cluster is a project with its own board. A task's clusterId says which one
  it belongs to; its status is the id of a column in THAT cluster's columns.
  Never give a task a status no column of its cluster has.
- The LAST column in a cluster's list is the finish line. When a task reaches
  it, set completedAt to the current epoch milliseconds. If it leaves, remove
  completedAt. That stamp is what earns the task a permanent star.
- Set updatedAt to now on every task you change. It drives how the app shows
  neglect, so leaving it stale makes finished work look abandoned.
- dueDate, if present, is a calendar day as "YYYY-MM-DD". Never a timestamp --
  a timestamp lands the task on the wrong day for anyone west of Greenwich.
- Never delete a task. To set one aside, add "darkForest": true. To bring it
  back, remove that field.
- Keep every id exactly as it is, and keep fields you do not understand.
- Optional fields you may see and should preserve: tags, notes, description,
  subtasks, dependsOn, etheredAt, orbitSeed.

Only ever change clusters and tasks. Do not touch any other file, and do not
add fields of your own.

Tell me what you changed in one line. Start by reading the file and telling me
what is open.`;

const RECIPES: Recipe[] = [
  {
    id: "claude-code",
    client: "Claude Code",
    where: "Run this once, anywhere:",
    snippet: `claude mcp add flowstate -- node ${SERVER_PATH}`,
  },
  {
    id: "claude-desktop",
    client: "Claude Desktop",
    where: "Settings → Developer → Edit Config, then add:",
    snippet: `{
  "mcpServers": {
    "flowstate": {
      "command": "node",
      "args": ["${SERVER_PATH}"]
    }
  }
}`,
  },
  {
    id: "codex",
    client: "Codex",
    where: "In ~/.codex/config.toml:",
    snippet: `[mcp_servers.flowstate]
command = "node"
args = ["${SERVER_PATH}"]`,
  },
  {
    id: "any-ai",
    client: "Any other AI",
    where: "No MCP? Paste this into anything that can read and write files:",
    snippet: HANDOVER_PROMPT,
  },
];

/** What it can do once connected, in the order someone would try them. */
const ABILITIES = [
  "See what is open, what is finished, and what is quietly rotting",
  "Add tasks, move them between columns, set them aside in the Dark Forest",
  "Work across your clusters, and move a task from one project to another",
  "Undo the last thing it did",
];

export default function ConnectPanel({ open, onClose }: ConnectPanelProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const close = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  const copy = async (recipe: Recipe) => {
    try {
      await navigator.clipboard.writeText(recipe.snippet);
      setCopied(recipe.id);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      // Clipboard can be refused; the snippet is on screen to select by hand.
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/60 p-4 pt-[8vh] backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-title"
        className="max-h-[84vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#0B1220]/97 p-5 shadow-2xl shadow-black/60"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p
              id="connect-title"
              className="text-sm font-semibold uppercase tracking-wide text-slate-300"
            >
              Connect your AI
            </p>
            <p className="mt-1.5 text-xs text-slate-500">
              Let Claude, Codex or any MCP client run your board. It reads and
              writes the same file this app does — on your machine, with no
              server and no account in between.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            className="shrink-0 rounded-xl border border-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-200 transition hover:border-white/40 hover:bg-white/5"
          >
            Close
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            What it can do
          </p>
          <ul className="mt-2 space-y-1">
            {ABILITIES.map((ability) => (
              <li key={ability} className="flex gap-2 text-xs text-slate-400">
                <span aria-hidden="true" className="text-slate-600">
                  —
                </span>
                {ability}
              </li>
            ))}
          </ul>
          {/* The gate, stated as a promise rather than a limitation. */}
          <p className="mt-3 text-xs text-slate-500">
            And nothing else. It cannot reach your colours, your galaxy, your
            intent surface or your journal — there is no tool for them, so no
            model can touch them. Every change it makes is undoable.
          </p>
        </div>

        <div className="mt-4 space-y-3">
          {RECIPES.map((recipe) => (
            <div
              key={recipe.id}
              className="rounded-2xl border border-white/10 bg-[#050B18]/70 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                  {recipe.client}
                </p>
                <button
                  type="button"
                  onClick={() => copy(recipe)}
                  className="shrink-0 rounded-lg border border-white/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-300 transition hover:border-white/40 hover:bg-white/5"
                >
                  {copied === recipe.id ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">{recipe.where}</p>
              <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-[#c9d0ff]">
                {recipe.snippet}
              </pre>
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Then ask it something: <span className="text-slate-400">“what’s
          rotting on my board?”</span> or{" "}
          <span className="text-slate-400">“move the auth thing to done”</span>.
          Changes show up here without a relaunch.
        </p>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[#4d587a]">
          Board file · {BOARD_FILE}
        </p>
      </div>
    </div>
  );
}
