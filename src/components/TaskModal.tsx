import { motion, AnimatePresence } from "motion/react";
import { X, ArrowLeft, ArrowRight, CheckCircle } from "lucide-react";

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  notes: string[];
  onMoveToProgress: () => void;
  onMoveToTodo?: () => void;
  onMoveToDone?: () => void;
  onComplete: () => void;
}

export function TaskModal({
  isOpen,
  onClose,
  title,
  notes,
  onMoveToProgress,
  onMoveToTodo,
  onMoveToDone,
  onComplete,
}: TaskModalProps) {
  // Infer task status by title keywords or better, add explicit prop later
  const titleLower = title.toLowerCase();
  const isDone =
    titleLower.includes("done") ||
    titleLower.includes("complete") ||
    titleLower.includes("testing");
  const isInProgress =
    titleLower.includes("progress") ||
    titleLower.includes("dashboard") ||
    titleLower.includes("documentation");
  const isTodo = !isDone && !isInProgress;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="relative w-[90%] max-w-lg rounded-2xl p-8 bg-gradient-to-br from-space-600 to-space-700 shadow-glow border border-white/10"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-2xl font-bold mb-4 text-white">{title}</h2>
            <ul className="space-y-2 mb-6">
              {notes.map((note, idx) => (
                <li
                  key={idx}
                  className="text-slate-300 text-sm flex items-start gap-2 leading-relaxed"
                >
                  • {note}
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap gap-3">
              {/* To-Do → In Progress + Complete */}
              {isTodo && (
                <>
                  <motion.button
                    onClick={onMoveToProgress}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 font-medium text-white flex items-center justify-center gap-2 shadow-soft"
                  >
                    <ArrowRight className="w-4 h-4" />
                    Move to Progress
                  </motion.button>

                  <motion.button
                    onClick={onComplete}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 font-medium text-white flex items-center justify-center gap-2 shadow-soft"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Mark Complete
                  </motion.button>
                </>
              )}

              {/* In Progress → To-Do + Complete */}
              {isInProgress && (
                <>
                  <motion.button
                    onClick={onMoveToTodo}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 font-medium text-white flex items-center justify-center gap-2 shadow-soft"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Move to To-Do
                  </motion.button>

                  <motion.button
                    onClick={onComplete}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 font-medium text-white flex items-center justify-center gap-2 shadow-soft"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Mark Complete
                  </motion.button>
                </>
              )}

              {/* Done → To-Do or In Progress */}
              {isDone && (
                <>
                  <motion.button
                    onClick={onMoveToProgress}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 font-medium text-white flex items-center justify-center gap-2 shadow-soft"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Move to Progress
                  </motion.button>

                  <motion.button
                    onClick={onMoveToTodo}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-400 font-medium text-white flex items-center justify-center gap-2 shadow-soft"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Move to To-Do
                  </motion.button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
