import React, { useEffect, useRef } from "react";

interface ObservatoryProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * A slide-over for everything ambient. These panels used to stack above the
 * board -- 2,040px of them, so the first task sat two and a half screens down.
 * They are good features; they just are not what you open the app to look at.
 *
 * The shell is deliberately dumb: App composes the contents so this stays a
 * drawer rather than a second layout to keep in sync.
 */
const Observatory: React.FC<ObservatoryProps> = ({ open, onClose, children }) => {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="Close observatory"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-[#03040c]/60 backdrop-blur-sm"
        />
      ) : null}

      <aside
        ref={panelRef}
        tabIndex={-1}
        aria-hidden={!open}
        aria-label="Observatory"
        className={[
          "fixed right-0 top-0 z-50 h-full w-[min(440px,100vw)] overflow-y-auto",
          "border-l border-white/10 bg-[#070a16]/95 backdrop-blur-xl",
          "shadow-[0_0_80px_rgba(3,4,12,0.8)] transition-transform duration-300 ease-out",
          "focus:outline-none motion-reduce:transition-none",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#070a16]/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-[10px] uppercase tracking-[0.4em] text-white/50">Observatory</p>
            <p className="text-base font-semibold text-white">Ambient signals</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:border-white/40 hover:bg-white/10 hover:text-white"
          >
            Close
          </button>
        </header>

        <div className="px-5 pb-16 pt-2">{children}</div>
      </aside>
    </>
  );
};

export default Observatory;
