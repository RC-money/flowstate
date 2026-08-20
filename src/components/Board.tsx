import React, { useRef, useState, useCallback } from "react";
import Column from "./Column";
import type { Status, Task } from "../App";
import { useBoardHotkeys } from "../hooks/useBoardHotkeys";
import { MAX_COLUMNS } from "../lib/columns/palette";
import type { Column as BoardColumn } from "../lib/columns/columns";

interface BoardProps {
  tasks: Task[];
  /** This cluster's own columns, in order. The last one is the finish line. */
  columns: BoardColumn[];
  onCardClick: (task: Task) => void;
  onAdd?: (status: Status) => void;
  onOpenTask?: (taskId: string) => void;
  onMoveTask?: (taskId: string, next: Status) => void;
  onAddTask?: () => void;
  onAddColumn?: (name: string) => void;
  onRenameColumn?: (id: string, name: string) => void;
  onRemoveColumn?: (id: string) => void;
}

export default function Board({
  tasks,
  columns,
  onCardClick,
  onAdd,
  onOpenTask,
  onMoveTask,
  onAddTask,
  onAddColumn,
  onRenameColumn,
  onRemoveColumn,
}: BoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [namingColumn, setNamingColumn] = useState(false);
  const [columnDraft, setColumnDraft] = useState("");

  // Same arrangement as the cluster switcher: the palette opens this field
  // rather than carrying a naming dialog of its own.
  React.useEffect(() => {
    const open = () => setNamingColumn(true);
    window.addEventListener("flowstate:new-column", open);
    return () => window.removeEventListener("flowstate:new-column", open);
  }, []);

  const handleCardSelection = useCallback(
    (task: Task) => {
      setSelectedCardId(task.id);
      onCardClick(task);
    },
    [onCardClick]
  );

  const handleStatusHotkey = useCallback(
    (status: Status) => {
      if (!selectedCardId) return;
      onMoveTask?.(selectedCardId, status);

      console.info("Move", selectedCardId, "to", status);
      window.dispatchEvent(
        new CustomEvent("flowstate:toast", {
          detail: { message: `Moved to ${status}`, variant: "success" },
        })
      );
    },
    [onMoveTask, selectedCardId]
  );

  useBoardHotkeys(boardRef as React.RefObject<HTMLElement>, {
    onNew: () => {
      if (onAddTask) {
        onAddTask();
      } else {
        onAdd?.(columns[0]?.id ?? "TO-DO");
      }
    },
    // 1..9 send a card along this board's own columns, however many it has.
    onSetStatus: (slot) => {
      const column = columns[Number(slot) - 1];
      if (column) handleStatusHotkey(column.id);
    },
  });

  const titleById: Record<string, string> = {};
  for (const t of tasks) titleById[t.id] = t.title;

  const commitColumn = () => {
    const name = columnDraft.trim();
    if (name) onAddColumn?.(name);
    setColumnDraft("");
    setNamingColumn(false);
  };

  // Three columns still share the width evenly, exactly as the board always
  // has. A longer board scrolls sideways rather than squeezing every column
  // into illegibility.
  const roomy = columns.length <= 3;

  return (
    <div
      ref={boardRef}
      className={[
        "flex items-start gap-8 px-4 md:px-6",
        roomy ? "mx-auto max-w-6xl" : "overflow-x-auto pb-3",
      ].join(" ")}
    >
      {columns.map((col, index) => (
        <div key={col.id} className={roomy ? "min-w-0 flex-1" : "w-[300px] shrink-0"}>
          <Column
            id={col.id}
            title={col.name}
            index={index}
            cards={tasks.filter((t) => t.status === col.id)}
            titleById={titleById}
            onCardClick={handleCardSelection}
            onAdd={onAdd}
            openTask={onOpenTask}
            onRename={onRenameColumn}
            onRemove={columns.length > 1 ? onRemoveColumn : undefined}
          />
        </div>
      ))}

      {onAddColumn && columns.length < MAX_COLUMNS ? (
        <div className="w-[150px] shrink-0 pt-1">
          {namingColumn ? (
            <input
              autoFocus
              value={columnDraft}
              onChange={(event) => setColumnDraft(event.target.value)}
              onBlur={commitColumn}
              onKeyDown={(event) => {
                if (event.key === "Enter") commitColumn();
                if (event.key === "Escape") {
                  setColumnDraft("");
                  setNamingColumn(false);
                }
              }}
              placeholder="Name it"
              aria-label="Name the new column"
              className="w-full rounded-xl border border-[rgba(165,175,255,0.2)] bg-[rgba(165,175,255,0.06)] px-3 py-2 font-mono text-[11px] uppercase tracking-[0.09em] text-white outline-none placeholder:text-[#6b7799]"
            />
          ) : (
            <button
              type="button"
              onClick={() => setNamingColumn(true)}
              aria-label="Add column"
              className="w-full rounded-xl border border-dashed border-[rgba(165,175,255,0.14)] px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.09em] text-[#6b7799] transition hover:border-[rgba(165,175,255,0.4)] hover:text-[#c9d0ff]"
            >
              + Column
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
