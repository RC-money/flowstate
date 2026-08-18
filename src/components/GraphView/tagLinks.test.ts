import { describe, expect, test } from "vitest";
import { buildGraphData } from "./graphTransforms";
import type { Task } from "../../hooks/useLocalTasks";

const NOW = 1_755_500_000_000;
const task = (id: string, tags?: string[], createdAt = NOW): Task => ({
  id, title: id, status: "TO-DO", createdAt, updatedAt: NOW, ...(tags ? { tags } : {}),
});

const tagLinks = (tasks: Task[]) =>
  buildGraphData(tasks, {}).links.filter((l) => l.kind === "tag");

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

  test("a dependency between the same pair wins over the tag link", () => {
    const a = task("a", ["api"]);
    const b = { ...task("b", ["api"]), dependsOn: ["a"] };
    const data = buildGraphData([a, b], {});
    expect(data.links.filter((l) => l.kind === "tag")).toHaveLength(0);
    expect(data.links.filter((l) => l.kind === "dependency")).toHaveLength(1);
  });

  test("tag comparison is case-insensitive", () => {
    expect(tagLinks([task("a", ["API"]), task("b", ["api"])])).toHaveLength(1);
  });
});
