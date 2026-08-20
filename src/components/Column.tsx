import React from "react";
import { useDroppable } from "@dnd-kit/core";
import type { Status, Task } from "../App";
import Card from "./Card";
import { useCelestialPrefs } from "../hooks/useCelestialPrefs";
import { accentForStatus } from "../lib/celestialPrefs";
import { columnPalette } from "../lib/columns/palette";

type Props = {
  id: Status;           // a column id -- one of the defaults, or one the user made
  title: string;
  /** Position on the board, which is what picks its colour. */
  index: number;
  /** Rename and remove are only offered where a column can be edited. */
  onRename?: (id: string, name: string) => void;
  onRemove?: (id: string) => void;
  cards: Task[];
  onCardClick: (t: Task) => void;
  onAdd?: (status: Status) => void;
  openTask?: (taskId: string) => void;
  titleById?: Record<string, string>;
};

export default function Column({
  id,
  title,
  index,
  cards,
  onCardClick,
  onAdd,
  openTask,
  titleById,
  onRename,
  onRemove,
}: Props) {
  const [renaming, setRenaming] = React.useState(false);
  const [draft, setDraft] = React.useState(title);
  const { setNodeRef, isOver } = useDroppable({ id });
  const [prefs] = useCelestialPrefs();

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.defaultPrevented) return;
    if (event.key.toLowerCase() === "n" && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      onAdd?.(id);
    }
  };

  // The column wears whatever body it flies in the galaxy. A column the user
  // added has no body assigned, so it falls back to its position's hue.
  const accent = prefs.statusSkins[id]
    ? accentForStatus(prefs, id)
    : columnPalette(index).core;
  const { hues } = columnPalette(index);
  // Past seven columns a hue is shared, so the rule becomes the gradient of the
  // whole combination -- that is what keeps the fiftieth column distinguishable.
  const rule =
    hues.length > 1
      ? `linear-gradient(90deg, ${hues.join(", ")}, transparent)`
      : `linear-gradient(90deg, ${accent}, transparent)`;

  return (
    <section
      ref={setNodeRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={[
        "w-full",
        "rounded-[20px] border border-[rgba(165,175,255,0.07)] bg-transparent",
        "p-4 pb-5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7c83ff]/60",
        isOver ? "border-[rgba(165,175,255,0.34)] bg-[rgba(124,131,255,0.09)]" : "",
      ].join(" ")}
      data-focused="false"
      onFocus={(event) => {
        event.currentTarget.dataset.focused = "true";
      }}
      onBlur={(event) => {
        event.currentTarget.dataset.focused = "false";
      }}
    >
      <header className="mb-3.5">
        <div className="flex items-start justify-between gap-2">
          {renaming && onRename ? (
            <input
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={() => {
                onRename(id, draft);
                setRenaming(false);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  onRename(id, draft);
                  setRenaming(false);
                }
                if (event.key === "Escape") {
                  setDraft(title);
                  setRenaming(false);
                }
              }}
              aria-label={`Rename ${title}`}
              className="w-full bg-transparent font-mono text-xs font-bold uppercase tracking-[0.16em] outline-none"
              style={{ color: accent }}
            />
          ) : (
            <h3
              className="font-mono text-xs font-bold uppercase tracking-[0.16em]"
              style={{ color: accent }}
              onDoubleClick={() => {
                if (!onRename) return;
                setDraft(title);
                setRenaming(true);
              }}
              title={onRename ? "Double-click to rename" : undefined}
            >
              {title}
            </h3>
          )}
          {onRemove ? (
            <button
              type="button"
              onClick={() => onRemove(id)}
              aria-label={`Remove ${title}`}
              title={`Remove ${title}`}
              className="shrink-0 rounded-md px-1.5 text-[13px] leading-none text-[#4d587a] transition hover:text-[#c9d0ff]"
            >
              &times;
            </button>
          ) : null}
        </div>
        <div className="mt-2 h-[3px] w-28 rounded" style={{ background: rule }} />
        <p className="mt-1.5 font-mono text-[11px] tabular-nums text-[#6b7799]">
          {cards.length} {cards.length === 1 ? "task" : "tasks"}
        </p>
        <button
          type="button"
          onClick={() => onAdd?.(id)}
          aria-label={`Add task to ${title}`}
          className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[rgba(165,175,255,0.14)] bg-[rgba(165,175,255,0.05)] px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.09em] text-[#c9d0ff] transition hover:border-[rgba(165,175,255,0.4)] hover:bg-[rgba(165,175,255,0.12)] hover:text-white"
        >
          + New task
          <span
            aria-hidden="true"
            className="rounded-md border border-[rgba(165,175,255,0.2)] px-1.5 py-0.5 text-[9.5px] text-[#6b7799]"
          >
            N
          </span>
        </button>
      </header>

      <div className="space-y-3.5">
        {cards.map((t) => (
          <Card
            key={t.id}
            id={t.id}
            title={t.title}
            status={t.status}
            dueDate={t.dueDate}
            description={t.description}
            tags={t.tags}
            subtasks={t.subtasks}
            depTitles={(t.dependsOn ?? [])
              .map((depId) => titleById?.[depId])
              .filter((x): x is string => Boolean(x))}
            onClick={() => {
              onCardClick(t);
              openTask?.(t.id);
            }}
          />
        ))}
      </div>
    </section>
  );
}
