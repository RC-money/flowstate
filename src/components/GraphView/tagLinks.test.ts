import { describe, expect, test } from "vitest";
import { buildGraphData } from "./graphTransforms";
import type { Task } from "../../hooks/useLocalTasks";

const NOW = 1_755_500_000_000;
const task = (id: string, tags?: string[], createdAt = NOW): Task => ({
  id, title: id, status: "TO-DO", createdAt, updatedAt: NOW, ...(tags ? { tags } : {}),
});

const tagLinks = (tasks: Task[]) =>
  buildGraphData(tasks).links.filter((l) => l.kind === "tag");

describe("tag gravity", () => {
  test("two tasks sharing a tag get a tag link", () => {
    const links = tagLinks([task("a", ["api"]), task("b", ["api"])]);
    expect(links).toHaveLength(1);
  });

  test("tasks are chained by age, not fully meshed", () => {
    // Five tasks sharing one tag: a chain (4 links), not a 10-link clique.
    const five = ["a", "b", "c", "d", "e"].map((id, i) => task(id, ["ops"], NOW + i));
    expect(tagLinks(five)).toHaveLength(4);
  });

  test("no shared tag, no link", () => {
    expect(tagLinks([task("a", ["api"]), task("b", ["design"])])).toHaveLength(0);
  });

  test("dependency data draws no lines -- only shared tags relate tasks", () => {
    const a = task("a", ["api"]);
    const b = { ...task("b", ["api"]), dependsOn: ["a"] };
    const data = buildGraphData([a, b]);
    // dependsOn survives in storage but the galaxy no longer draws it.
    expect(data.links).toHaveLength(1);
    expect(data.links[0].kind).toBe("tag");
  });

  test("tag comparison is case-insensitive", () => {
    expect(tagLinks([task("a", ["API"]), task("b", ["api"])])).toHaveLength(1);
  });
});
