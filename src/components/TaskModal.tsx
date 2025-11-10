import { motion, AnimatePresence } from "motion/react";

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  notes: string[];
  status?: "todo" | "inprogress" | "done";
  onComplete: () => void;
  onMove?: (newStatus: "todo" | "inprogress" | "done") => void;
}

export function TaskModal({
  isOpen,
  onClose,
  title,
  notes,
  status = "todo",
  onComplete,
  onMove,
}: TaskModalProps) {
  if (!isOpen) return null;

  const renderButtons = () => {
    switch (status) {
      case "todo":
        return (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onMove?.("inprogress")}
            className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 transition text-white font-medium"
          >
            Move to In Progress
          </motion.button>
        );

      case "inprogress":
        return (
          <>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onComplete}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 transition text-white font-medium"
            >
              Mark Complete
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onMove?.("todo")}
              className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition text-white font-medium"
            >
              Move to To-Do
            </motion.button>
          </>
        );

      case "done":
        return (
          <>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onMove?.("inprogress")}
              className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 transition text-white font-medium"
            >
              Move to In Progress
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onMove?.("todo")}
              className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition text-white font-medium"
            >
              Move to To-Do
            </motion.button>
          </>
        );
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", duration: 0.4 }}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-space-600/80 border border-white/10 p-8 rounded-2xl max-w-md w-full shadow-glow"
          >
            {/* ✖ Close button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 text-ether-300 hover:text-ether-100 transition text-lg"
              aria-label="Close"
            >
              ✕
            </button>

            <h2 className="text-xl font-bold text-ether-100 mb-4">{title}</h2>

            <ul className="space-y-2 mb-6 text-ether-300 text-sm">
              {notes.map((note, i) => (
                <li key={i}>• {note}</li>
              ))}
            </ul>

            <div className="flex gap-3 justify-end">{renderButtons()}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
