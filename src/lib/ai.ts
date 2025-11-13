import { type Task } from "../hooks/useLocalTasks";
import {
  analyzeStrangeLoop,
  EMPTY_STRANGE_LOOP_ANALYSIS,
  type IntentEchoProfile,
  type StrangeLoopAnalysis,
  type StrangeLoopContext,
} from "./strangeLoopEngine";

const delay = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const withSafety = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    console.error("Flowstate AI stub error", error);
    return fallback;
  }
};

export async function askFlow(query: string): Promise<string> {
  return withSafety(async () => {
    await delay(450 + Math.random() * 400);
    return `Flowstate mock insight -> ${query}`;
  }, "Flowstate mock insight unavailable.");
}

export async function summarizeTasks(tasks: Task[]): Promise<string> {
  return withSafety(async () => {
    await delay(400 + Math.random() * 300);
    if (!tasks.length) {
      return "No tasks to summarize.";
    }
    const done = tasks.filter((task) => task.status === "DONE").length;
    return `Mock summary: ${tasks.length} total, ${done} done.`;
  }, "Summary unavailable.");
}

export const rag = {
  async search(query: string): Promise<string[]> {
    return withSafety(async () => {
      await delay(300 + Math.random() * 300);
      return [query, `${query} follow-up`, `${query} context`];
    }, []);
  },
};

export async function runStrangeLoopEngine(
  context: StrangeLoopContext,
  previousIntentEcho?: IntentEchoProfile
): Promise<StrangeLoopAnalysis> {
  return withSafety(async () => {
    await delay(350 + Math.random() * 250);
    return analyzeStrangeLoop(context, previousIntentEcho);
  }, EMPTY_STRANGE_LOOP_ANALYSIS);
}

export type {
  StrangeLoopContext,
  StrangeLoopAnalysis,
  RecursionInsight,
  ParadoxInsight,
  IntentEchoProfile as StrangeLoopIntentEchoProfile,
  MagnetismMatrix,
  StrangeLoopQuestion,
} from "./strangeLoopEngine";
