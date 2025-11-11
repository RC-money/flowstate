import { useMemo } from "react";
import type { Task } from "../App";
import { tasksToGraph } from "../components/GraphView/graphTransforms";

interface UseGraphDataOptions {
  showTemporal: boolean;
}

export const useGraphData = (
  tasks: Task[],
  opts: UseGraphDataOptions
) => {
  const { showTemporal } = opts ?? { showTemporal: false };
  return useMemo(
    () => tasksToGraph(tasks, { showTemporal }),
    [tasks, showTemporal]
  );
};

export default useGraphData;
