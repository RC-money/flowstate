import React from "react";
import { motion } from "framer-motion";
import type { Task } from "../App";

interface TaskCardProps {
  id: string;
  title: string;
  status: Task["status"];
  onClick?: () => void;
}

export default function TaskCard({ id, title, status, onClick }: TaskCardProps) {
  // accent based on column
  const accent =
    status === "TO-DO"
      ? "#22d3ee" // cyan-400
      : status === "IN PROGRESS"
      ? "#818cf8" // indigo-400
      : "#10b981"; // emerald-500

  return (
    <motion.div
      layout
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 250, damping: 20 }}
      onClick={onClick}
      style={{
        border: `1px solid ${accent}33`, // faint accent border
        boxShadow: "0 0 0px rgba(0,0,0,0)",
      }}
      className={`
        cursor-pointer select-none p-5 rounded-xl
        bg-[#0f172a]/80 backdrop-blur-sm
        hover:shadow-[0_0_15px_rgba(0,0,0,0.3)]
        transition-all duration-200 ease-out
      `}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = `0 0 15px ${accent}66`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0px rgba(0,0,0,0)";
      }}
    >
      <h4 className="text-lg font-semibold mb-1">{title}</h4>
      <p className="text-xs uppercase tracking-wide text-slate-500">{status}</p>
    </motion.div>
  );
}
