import React from "react";

const dispatchToggle = (type: "graph" | "starfield" | "theme") => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(`flowstate:toggle:${type}`));
};

const actionButtons = [
  {
    id: "legend-toggle-graph",
    label: "Graph Mode",
    detail: "flowstate:toggle:graph",
    onPress: () => dispatchToggle("graph" as const),
  },
  {
    id: "legend-toggle-starfield",
    label: "Starfield",
    detail: "flowstate:toggle:starfield",
    onPress: () => dispatchToggle("starfield" as const),
  },
  {
    id: "legend-toggle-theme",
    label: "Theme",
    detail: "flowstate:toggle:theme",
    onPress: () => dispatchToggle("theme" as const),
  },
] as const;

const Legend: React.FC = () => {
  return (
    <div className="flex flex-wrap gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs uppercase tracking-wide text-white/80">
      {actionButtons.map((action) => (
        <button
          key={action.id}
          type="button"
          className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-[11px] font-semibold transition hover:border-white/30 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70"
          onClick={action.onPress}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              action.onPress();
            }
          }}
        >
          <span className="text-white">{action.label}</span>
          <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] text-white/70">
            {action.detail.replace("flowstate:toggle:", "").toUpperCase()}
          </span>
        </button>
      ))}
    </div>
  );
};

export default Legend;
