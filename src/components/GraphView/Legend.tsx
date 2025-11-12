import React, { useEffect, useMemo, useState } from "react";
import { legendSwatches } from "./graphStyles";

const buildKey = (label: string, kind: "node" | "link"): string =>
  `${kind}:${label.trim().toLowerCase().replace(/\s+/g, "-")}`;

const legendEntries = legendSwatches.map((swatch) => ({
  ...swatch,
  id: buildKey(swatch.label, swatch.kind),
}));

type LegendEntry = (typeof legendEntries)[number];

export interface LegendFilters {
  nodes: Record<string, boolean>;
  links: Record<string, boolean>;
  activeKeys: string[];
  inactiveKeys: string[];
}

export interface LegendProps {
  defaultDisabledKeys?: string[];
  debounceMs?: number;
  onVisibilityChange?: (filters: LegendFilters) => void;
  onCategoryHover?: (entry: LegendEntry | null) => void;
}

type DebouncedFn<T extends (...args: any[]) => void> = ((...args: Parameters<T>) => void) & {
  cancel: () => void;
};

const debounce = <T extends (...args: any[]) => void>(fn: T, delay = 120): DebouncedFn<T> => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const debounced = ((...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => fn(...args), delay);
  }) as DebouncedFn<T>;
  debounced.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };
  return debounced;
};

const Legend: React.FC<LegendProps> = ({
  defaultDisabledKeys = [],
  debounceMs = 180,
  onVisibilityChange,
  onCategoryHover,
}) => {
  const [visibility, setVisibility] = useState<Record<string, boolean>>(() => {
    const base = legendEntries.reduce<Record<string, boolean>>((acc, entry) => {
      acc[entry.id] = true;
      return acc;
    }, {});
    defaultDisabledKeys.forEach((key) => {
      if (key in base) {
        base[key] = false;
      }
    });
    return base;
  });
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const emitVisibility = useMemo(() => {
    if (!onVisibilityChange) return null;
    return debounce(onVisibilityChange, debounceMs);
  }, [onVisibilityChange, debounceMs]);

  useEffect(() => {
    if (!emitVisibility) return undefined;
    const nodes: LegendFilters["nodes"] = {};
    const links: LegendFilters["links"] = {};
    legendEntries.forEach((entry) => {
      if (entry.kind === "node") {
        nodes[entry.label] = visibility[entry.id];
      } else {
        links[entry.label] = visibility[entry.id];
      }
    });
    const activeKeys = legendEntries.filter((entry) => visibility[entry.id]).map((entry) => entry.id);
    const inactiveKeys = legendEntries
      .filter((entry) => !visibility[entry.id])
      .map((entry) => entry.id);
    emitVisibility({
      nodes,
      links,
      activeKeys,
      inactiveKeys,
    });
    return () => {
      emitVisibility.cancel();
    };
  }, [visibility, emitVisibility]);

  const handleToggle = (entry: LegendEntry) => {
    setVisibility((prev) => ({
      ...prev,
      [entry.id]: !prev[entry.id],
    }));
  };

  const handleHover = (entry: LegendEntry | null) => {
    setHoveredKey(entry?.id ?? null);
    onCategoryHover?.(entry);
  };

  return (
    <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/5 p-3">
      {legendEntries.map((entry) => {
        const isActive = visibility[entry.id];
        const isHovered = hoveredKey === entry.id;
        return (
          <button
            key={entry.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => handleToggle(entry)}
            onMouseEnter={() => handleHover(entry)}
            onMouseLeave={() => handleHover(null)}
            className={[
              "group flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70",
              isActive
                ? "border-white/30 bg-white/10 text-white"
                : "border-white/10 bg-transparent text-slate-400 opacity-70",
              isHovered ? "ring-1 ring-white/40" : "",
            ].join(" ")}
          >
            {entry.kind === "node" ? (
              <span
                className="inline-block h-2.5 w-2.5 rounded-full shadow-[0_0_12px_rgba(255,255,255,0.35)]"
                style={{
                  backgroundColor: entry.color,
                  opacity: isActive ? 1 : 0.35,
                }}
              />
            ) : (
              <span
                className="inline-flex h-[2px] w-6 items-center"
                style={{ opacity: isActive ? 1 : 0.35 }}
              >
                <span
                  className="h-[2px] w-full"
                  style={{
                    background: entry.color,
                    borderBottom: entry.dashed ? "1px dashed rgba(226,232,240,0.6)" : "none",
                  }}
                />
              </span>
            )}
            <span>{entry.label}</span>
            <span
              aria-hidden="true"
              className={[
                "ml-1 rounded-md px-1 py-0.5 text-[10px] font-bold transition",
                isActive ? "bg-white/15 text-white" : "bg-white/5 text-slate-400",
              ].join(" ")}
            >
              {isActive ? "ON" : "OFF"}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default Legend;
