import { motion } from "motion/react";
import { theme } from "../theme";

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  notes: string[];
  onComplete: () => void;
}

export function TaskModal({ isOpen, onClose, title, notes, onComplete }: TaskModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 32 }}
        transition={{ type: "spring", damping: 20 }}
        className="panel shadow-glow-soft w-[92%] max-w-lg p-7 relative"
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <h2 className="text-title text-2xl font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="text-mute hover:text-sub transition-colors px-2 py-1 rounded-md"
            style={{ outline: "none" }}
          >
            ✕
          </button>
        </div>

        {/* Notes */}
        <ul className="mt-4 space-y-2">
          {notes.map((n, i) => (
            <li key={i} className="text-sub text-[15px] leading-relaxed">
              • {n}
            </li>
          ))}
        </ul>

        {/* Actions */}
        <div className="mt-6 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sub hover:text-title transition-colors"
            style={{ border: `1px solid ${theme.border}` }}
          >
            Close
          </button>
          <button
            onClick={onComplete}
            className="px-4 py-2 rounded-lg font-medium"
            style={{
              background: `linear-gradient(90deg, ${theme.accent} 0%, ${theme.accent2} 100%)`,
              color: "#0E1625",
            }}
          >
            Mark Complete
          </button>
        </div>
      </motion.div>
    </div>
  );
}
