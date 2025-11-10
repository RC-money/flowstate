import { motion } from "motion/react";
import { cn } from "../util/cn";

interface TaskCardProps {
  title: string;
  status: "todo" | "inprogress" | "done";
  onClick?: () => void;
}

export function TaskCard({ title, status, onClick }: TaskCardProps) {
  const gradientMap = {
    todo: "from-cyan-400/10 to-blue-500/10 hover:from-cyan-400/20 hover:to-blue-500/20",
    inprogress: "from-blue-500/10 to-indigo-500/10 hover:from-blue-500/20 hover:to-indigo-500/20",
    done: "from-emerald-500/10 to-teal-500/10 hover:from-emerald-500/20 hover:to-teal-500/20",
  };

  return (
    <motion.div
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={cn(
        "relative p-4 rounded-xl cursor-pointer backdrop-blur-sm border border-white/10",
        "shadow-[0_0_15px_rgba(255,255,255,0.03)]",
        "bg-gradient-to-br transition-all duration-300 group",
        gradientMap[status]
      )}
    >
      {/* Glow hover aura */}
      <motion.div
        className="absolute inset-0 rounded-xl bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.06)_0%,transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        animate={{
          opacity: [0.3, 0.45, 0.3],
        }}
        transition={{
          repeat: Infinity,
          duration: 6,
          ease: "easeInOut",
        }}
      />

      <div className="relative z-10">
        <h3 className="font-medium text-lg text-slate-100">{title}</h3>
        <p
          className={cn(
            "text-xs mt-1 uppercase tracking-wide font-semibold",
            status === "todo" && "text-cyan-400/70",
            status === "inprogress" && "text-blue-400/70",
            status === "done" && "text-emerald-400/70"
          )}
        >
          {status.replace("-", " ")}
        </p>
      </div>
    </motion.div>
  );
}
