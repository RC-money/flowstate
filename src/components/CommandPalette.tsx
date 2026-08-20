import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type Command = {
  id: string;
  label: string;
  /** What it does, in a line. The palette is where people meet a feature. */
  description?: string;
  hint?: string;
  /** Groups the entry under a heading. Ungrouped entries lead the list. */
  section?: string;
  run: () => void;
};

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: Command[];
  onGlobalOpen?: () => void;
}

const filterCommands = (commands: Command[], query: string): Command[] => {
  if (!query) return commands;
  const normalized = query.toLowerCase();
  return commands.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(normalized) ||
      (cmd.description ?? "").toLowerCase().includes(normalized) ||
      (cmd.section ?? "").toLowerCase().includes(normalized)
  );
};

const useGlobalShortcut = (handler: () => void) => {
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        handler();
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [handler]);
};

const isFocusable = (element: Element | null): element is HTMLElement => {
  if (!element) return false;
  const el = element as HTMLElement;
  const focusableSelectors =
    [
      "button",
      "[href]",
      "input",
      "textarea",
      "select",
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");
  return el.matches(focusableSelectors);
};

export default function CommandPalette({
  isOpen,
  onClose,
  commands,
  onGlobalOpen,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  useGlobalShortcut(() => {
    if (!isOpen) {
      if (onGlobalOpen) {
        onGlobalOpen();
      }
    }
  });

  const filtered = useMemo(() => filterCommands(commands, query), [commands, query]);

  const closePalette = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      lastFocused.current = document.activeElement as HTMLElement | null;
      setQuery("");
      setHighlighted(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    } else if (lastFocused.current) {
      lastFocused.current.focus();
      lastFocused.current = null;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePalette();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, closePalette]);

  useEffect(() => {
    if (!isOpen) return;
    const handleFocus = (event: FocusEvent) => {
      if (
        dialogRef.current &&
        !dialogRef.current.contains(event.target as Node) &&
        isFocusable(event.relatedTarget as Element)
      ) {
        dialogRef.current.focus();
      }
    };
    document.addEventListener("focusin", handleFocus);
    return () => document.removeEventListener("focusin", handleFocus);
  }, [isOpen]);

  const handleCommand = useCallback(
    (cmd: Command) => {
      cmd.run();
      closePalette();
    },
    [closePalette]
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!filtered.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((prev) => (prev + 1) % filtered.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((prev) => (prev - 1 + filtered.length) % filtered.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      handleCommand(filtered[highlighted]);
    } else if (event.key === "Tab") {
      // keep focus inside
      event.preventDefault();
      inputRef.current?.focus();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={closePalette}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-palette-title"
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0B1220]/95 p-4 shadow-2xl shadow-black/60 focus:outline-none"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="mb-3">
          <h2
            id="command-palette-title"
            className="text-sm font-semibold uppercase tracking-wide text-slate-300"
          >
            Command Palette
          </h2>
          <div className="mt-2 flex items-center rounded-xl border border-white/10 bg-[#050B18] px-3">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setHighlighted(0);
              }}
              placeholder="Type a command…"
              className="w-full bg-transparent py-3 text-sm text-[#E6EDF3] placeholder:text-slate-500 focus:outline-none"
            />
            <span className="text-xs uppercase tracking-wide text-slate-500">⌘K</span>
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto pr-1">
          {filtered.length ? (
            <ul className="space-y-1">
              {filtered.map((cmd, index) => {
                const isActive = index === highlighted;
                // A heading appears the first time a section shows up, so the
                // list reads as sections without needing a nested structure --
                // filtering still walks one flat array.
                const heading =
                  cmd.section && cmd.section !== filtered[index - 1]?.section
                    ? cmd.section
                    : null;
                return (
                  <li key={cmd.id}>
                    {heading ? (
                      <p className="px-3 pb-1 pt-3 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {heading}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleCommand(cmd)}
                      className={[
                        "w-full rounded-xl border border-transparent px-3 py-2 text-left text-sm text-[#E6EDF3] transition",
                        isActive
                          ? "border-white/20 bg-white/5"
                          : "hover:border-white/10 hover:bg-white/5",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span>{cmd.label}</span>
                        {cmd.hint ? (
                          <span className="shrink-0 text-xs uppercase tracking-wide text-slate-500">
                            {cmd.hint}
                          </span>
                        ) : null}
                      </div>
                      {cmd.description ? (
                        <p className="mt-0.5 text-xs text-slate-500">{cmd.description}</p>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-center text-sm text-slate-400">
              No commands found
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
