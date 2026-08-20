import { useEffect, useState } from "react";
import { EXTERNAL_EVENT, lastExternalChange } from "../hooks/useLocalTasks";

interface ConnectedPillProps {
  /** Opens the panel with the prompt in it. */
  onConnect: () => void;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * How long after an outside write we still call it connected.
 *
 * An assistant that has not touched the board in a fortnight is not obviously
 * still attached, and claiming otherwise would be the kind of always-green
 * status light nobody believes.
 */
const STILL_CONNECTED = 14 * DAY;

/** "just now", "4m", "3h", "2d" -- enough to place it, no more. */
const ago = (at: number, now: number): string => {
  const elapsed = Math.max(0, now - at);
  if (elapsed < MINUTE) return "just now";
  if (elapsed < HOUR) return `${Math.round(elapsed / MINUTE)}m ago`;
  if (elapsed < DAY) return `${Math.round(elapsed / HOUR)}h ago`;
  return `${Math.round(elapsed / DAY)}d ago`;
};

/**
 * Whether anything other than this app has written the board.
 *
 * There is no connection to observe -- an MCP server is a process that starts
 * when a client feels like it, and a file-editing assistant announces nothing.
 * What can be observed is work arriving from somewhere else, so that is what
 * this reports, and the label says exactly that rather than implying a
 * handshake that never happened.
 */
export default function ConnectedPill({ onConnect }: ConnectedPillProps) {
  const [seenAt, setSeenAt] = useState<number | null>(() => lastExternalChange());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const onExternal = () => {
      setSeenAt(lastExternalChange());
      setNow(Date.now());
    };
    window.addEventListener(EXTERNAL_EVENT, onExternal);
    return () => window.removeEventListener(EXTERNAL_EVENT, onExternal);
  }, []);

  // Only to keep "4m ago" from going stale while the drawer sits open.
  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), MINUTE);
    return () => window.clearInterval(tick);
  }, []);

  const connected = seenAt !== null && now - seenAt < STILL_CONNECTED;

  return (
    <button
      type="button"
      onClick={onConnect}
      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition ${
        connected
          ? "border-emerald-300/30 bg-emerald-400/[0.07] hover:border-emerald-300/60"
          : "border-white/10 bg-white/[0.03] hover:border-white/30"
      }`}
    >
      <span className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 rounded-full ${
            connected ? "bg-emerald-300" : "bg-slate-600"
          }`}
          style={connected ? { boxShadow: "0 0 8px rgba(110,231,183,0.8)" } : undefined}
        />
        <span
          className={`font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] ${
            connected ? "text-emerald-100" : "text-slate-400"
          }`}
        >
          {connected ? "Connected" : "Not connected"}
        </span>
      </span>
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-slate-500">
        {connected && seenAt !== null ? ago(seenAt, now) : "Set it up"}
      </span>
    </button>
  );
}
