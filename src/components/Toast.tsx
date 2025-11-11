import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type ToastVariant = "success" | "warn" | "error";

interface ToastRecord {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastContextValue {
  show: (message: string, opts?: { variant?: ToastVariant; duration?: number }) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const CONTAINER_PROPS = {
  role: "status",
  "aria-live": "polite" as const,
};

const variantClasses: Record<ToastVariant, string> = {
  success: "border-emerald-400/40 text-emerald-200",
  warn: "border-amber-400/40 text-amber-200",
  error: "border-rose-400/40 text-rose-200",
};

const prefersReducedMotion = (): boolean => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const timers = useRef(new Map<string, number>());
  const reducedMotion = useMemo(prefersReducedMotion, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    const handle = timers.current.get(id);
    if (handle) {
      clearTimeout(handle);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (message: string, opts?: { variant?: ToastVariant; duration?: number }) => {
      if (!message) return;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const toast: ToastRecord = {
        id,
        message,
        variant: opts?.variant ?? "success",
        duration: Math.max(1500, opts?.duration ?? 3000),
      };
      setToasts((prev) => [...prev, toast]);
      const timer = window.setTimeout(() => removeToast(id), toast.duration);
      timers.current.set(id, timer);
    },
    [removeToast]
  );

  useEffect(
    () => () => {
      timers.current.forEach((timer) => clearTimeout(timer));
      timers.current.clear();
    },
    []
  );

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster
        toasts={toasts}
        onDismiss={removeToast}
        reducedMotion={reducedMotion}
      />
    </ToastContext.Provider>
  );
}

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
};

const Toaster = ({
  toasts,
  onDismiss,
  reducedMotion,
}: {
  toasts: ToastRecord[];
  onDismiss: (id: string) => void;
  reducedMotion: boolean;
}) => {
  if (typeof document === "undefined") return null;
  if (!toasts.length) return null;

  return createPortal(
    <div
      {...CONTAINER_PROPS}
      className="pointer-events-none fixed bottom-6 right-6 z-[9999] flex w-full max-w-sm flex-col gap-3"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          tabIndex={-1}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onDismiss(toast.id);
            }
          }}
          className={[
            "pointer-events-auto flex items-start gap-3 rounded-2xl border bg-[#0F172A]/95 px-4 py-3 text-sm text-[#E6EDF3] shadow-2xl shadow-black/40",
            variantClasses[toast.variant],
            reducedMotion ? "" : "animate-[fadeUp_0.25s_ease-out]",
          ].join(" ")}
        >
          <span className="flex-1 leading-relaxed">{toast.message}</span>
          <button
            type="button"
            aria-label="Dismiss"
            className="rounded-lg border border-white/10 px-2 py-1 text-xs uppercase tracking-wide text-white/80 transition hover:border-white/40 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            onClick={() => onDismiss(toast.id)}
          >
            ×
          </button>
        </div>
      ))}
      <style>{`@keyframes fadeUp {
        from { opacity: 0; transform: translateY(12px); }
        to { opacity: 1; transform: translateY(0); }
      }`}</style>
    </div>,
    document.body
  );
};
