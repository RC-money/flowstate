export type AnalyticsEvent =
  | { type: "task:add"; source: "keyboard" | "click" }
  | { type: "task:move"; method: "drag" | "menu" | "hotkey" }
  | { type: "task:delete" }
  | { type: "toast:show"; variant: "success" | "warn" | "error" }
  | { type: "graph:unlock" | "graph:lock" }
  | { type: "palette:open" | "palette:run" };

let enabled = false;
const lastEventMap = new Map<string, number>();
const THROTTLE_MS = 350;

const eventKey = (evt: AnalyticsEvent): string => {
  switch (evt.type) {
    case "task:add":
      return `${evt.type}:${evt.source}`;
    case "task:move":
      return `${evt.type}:${evt.method}`;
    case "task:delete":
      return evt.type;
    case "toast:show":
      return `${evt.type}:${evt.variant}`;
    case "graph:unlock":
    case "graph:lock":
    case "palette:open":
    case "palette:run":
      return evt.type;
    default:
      return JSON.stringify(evt);
  }
};

export function setAnalyticsEnabled(value: boolean): void {
  enabled = value;
}

export function logEvent(evt: AnalyticsEvent): void {
  if (!enabled) return;

  const key = eventKey(evt);
  const now = Date.now();
  const last = lastEventMap.get(key) ?? 0;

  if (now - last < THROTTLE_MS) {
    return;
  }

  lastEventMap.set(key, now);

  const dev =
    typeof import.meta !== "undefined" &&
    Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV);
  if (dev) {
     
    console.info("[analytics]", evt);
  } else if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("flowstate:analytics", { detail: evt })
    );
  }
}
