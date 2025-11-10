import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Task } from "../App";

interface TaskModalProps {
  task: Task | null;
  onClose: () => void;
  onMove: (id: string, newStatus: Task["status"]) => void;
}

export default function TaskModal({ task, onClose, onMove }: TaskModalProps) {
  if (!task) return null;

  const renderButtons = () => {
    switch (task.status) {
      case "TO-DO":
        return (
          <button
            onClick={() => onMove(task.id, "IN PROGRESS")}
            className="px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/40 border border-indigo-400/40 rounded-lg text-indigo-300 transition-all"
          >
            Move to In Progress
          </button>
        );
      case "IN PROGRESS":
        return (
          <div className="flex gap-3">
            <button
              onClick={() => onMove(task.id, "TO-DO")}
              className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/40 border border-cyan-400/40 rounded-lg text-cyan-300 transition-all"
            >
              Move to To-Do
            </button>
            <button
              onClick={() => onMove(task.id, "DONE")}
              className="px-4 py-2 bg-gradient-to-r from-indigo-400 via-emerald-400 to-cyan-400 text-white font-semibold rounded-lg shadow-[0_0_15px_rgba(99,102,241,0.6)] hover:shadow-[0_0_25px_rgba(99,102,241,0.9)] transition-all"
            >
              Mark Complete
            </button>
          </div>
        );
      case "DONE":
        return (
          <div className="flex gap-3">
            <button
              onClick={() => onMove(task.id, "TO-DO")}
              className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/40 border border-cyan-400/40 rounded-lg text-cyan-300 transition-all"
            >
              Move to To-Do
            </button>
            <button
              onClick={() => onMove(task.id, "IN PROGRESS")}
              className="px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/40 border border-indigo-400/40 rounded-lg text-indigo-300 transition-all"
            >
              Move to In Progress
            </button>
          </div>
        );
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-[#0f172a]/90 border border-white/10 rounded-2xl p-8 max-w-md w-full text-center"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-2xl font-semibold mb-4">{task.title}</h2>
          <p className="text-slate-400 mb-6">{task.status}</p>
          <div className="flex justify-center gap-3">{renderButtons()}</div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
