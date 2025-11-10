import { motion } from "motion/react";

interface FlowMotionProps {
  active?: boolean;
  colorFrom?: string;
  colorTo?: string;
}

export function FlowMotion({
  active = false,
  colorFrom = "#67E8F9",
  colorTo = "#93C5FD",
}: FlowMotionProps) {
  if (!active) return null;

  return (
    <motion.div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="absolute w-[120%] h-[3px] rounded-full blur-md"
        style={{
          background: `linear-gradient(90deg, ${colorFrom}, ${colorTo})`,
          top: "50%",
          left: "-10%",
        }}
        animate={{ x: ["-10%", "110%"] }}
        transition={{
          duration: 1.2,
          ease: "easeInOut",
        }}
      />
    </motion.div>
  );
}
