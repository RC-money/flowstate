import { useEffect } from "react";

export type BoardHotkeys = {
  onNew?: () => void;
  onSetStatus?: (status: "TO-DO" | "IN PROGRESS" | "DONE") => void;
};

const STATUS_LOOKUP: Record<string, "TO-DO" | "IN PROGRESS" | "DONE"> = {
  "1": "TO-DO",
  "2": "IN PROGRESS",
  "3": "DONE",
};

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName?.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    target.isContentEditable ||
    target.getAttribute("role") === "textbox"
  );
};

export function useBoardHotkeys(
  ref: React.RefObject<HTMLElement>,
  cfg: BoardHotkeys
): void {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!ref.current) return;

      const active = document.activeElement as HTMLElement | null;
      const withinFocus = !!active && ref.current.contains(active);
      const hovering = !!ref.current.matches(":hover");

      if (!withinFocus && !hovering) return;
      if (isEditableTarget(event.target)) return;

      const key = event.key.toLowerCase();

      if (key === "n") {
        if (cfg.onNew) {
          event.preventDefault();
          cfg.onNew();
        }
        return;
      }

      const status = STATUS_LOOKUP[key];
      if (status && cfg.onSetStatus) {
        event.preventDefault();
        cfg.onSetStatus(status);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cfg.onNew, cfg.onSetStatus, ref]);
}
