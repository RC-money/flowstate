import { motion } from "motion/react";

interface ProgressIndicatorProps {
  total: number;
  completed: number;
  colorFrom?: string; // optional override
  colorTo?: string;   // optional override
}

export function ProgressIndicator({
  total,
  completed,
  colorFrom = "#22D3EE", // cyan-400
  colorTo = "#60A5FA",   // blue-400
}: ProgressIndicatorProps) {
  const pct =
    total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;

  return (
    <div
      className="w-full h-1.5 rounded-full overflow-hidden"
      style={{ background: "rgba(255,255,255,0.06)" }} // soft track
    >
      <motion.div
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="h-full rounded-full"
        style={{
          background: `linear-gradient(90deg, ${colorFrom} 0%, ${colorTo} 100%)`,
          boxShadow: "0 0 8px rgba(34, 211, 238, 0.25)", // subtle inner glow
        }}
      />
    </div>
  );
}
