import { beforeEach, describe, expect, test } from "vitest";
import { appendLogEvent, readLog, LOG_CAP, type TaskLogEvent } from "./taskLog";

// vitest runs in node -- give it a localStorage.
const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage;
});

const evt = (over: Partial<TaskLogEvent>): TaskLogEvent => ({
  t: 1_755_500_000_000,
  taskId: "t1",
  kind: "created",
  ...over,
});

describe("task log", () => {
  test("appends and reads back in order", () => {
    appendLogEvent(evt({ kind: "created" }));
    appendLogEvent(evt({ kind: "moved", from: "TO-DO", to: "DONE", t: 2_000_000_000_000 }));
    const log = readLog();
    expect(log).toHaveLength(2);
    expect(log[0].kind).toBe("created");
    expect(log[1].to).toBe("DONE");
  });

  // Slow on purpose, and given room to be: appendLogEvent reads, parses and
  // re-serialises the whole log on every call, so filling a 2000-entry cap is
  // a couple of million JSON operations. Under a loaded suite that ran past
  // the default timeout and failed a test that was only ever being patient.
  test("caps the log by dropping the oldest entries", () => {
    for (let i = 0; i < LOG_CAP + 25; i++) {
      appendLogEvent(evt({ t: i }));
    }
    const log = readLog();
    expect(log).toHaveLength(LOG_CAP);
    expect(log[0].t).toBe(25);
  }, 20_000);

  test("recovers from corrupt storage instead of throwing", () => {
    localStorage.setItem("flowstate:v1:tasklog", "{not json");
    expect(() => appendLogEvent(evt({}))).not.toThrow();
    expect(readLog()).toHaveLength(1);
  });

  test("readLog filters garbage rows a rogue write left behind", () => {
    localStorage.setItem(
      "flowstate:v1:tasklog",
      JSON.stringify([evt({}), { junk: true }, null, evt({ kind: "deleted", t: 2 })])
    );
    const log = readLog();
    expect(log).toHaveLength(2);
    expect(log[1].kind).toBe("deleted");
  });
});
