import { motion } from "motion/react";
import { theme } from "../theme";

interface TaskCardProps {
  title: string;
  status: "todo" | "inprogress" | "done";
  onClick: () => void;
}

export function TaskCard({ title, status, onClick }: TaskCardProps) {
  const accent =
    status === "done" ? theme.accent : status === "inprogress" ? theme.accent2 : theme.accent;

  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className="panel shadow-glow-soft cursor-pointer p-5 transition-all"
      style={{
        borderLeft: `4px solid ${accent}`,
      }}
    >
      <h4 className="text-title text-lg font-semibold">{title}</h4>
      {/* optional meta line if you want: <p className='text-mute text-sm mt-1'>Tap to view notes</p> */}
    </motion.div>
  );
}
