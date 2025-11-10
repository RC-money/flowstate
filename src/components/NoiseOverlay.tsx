import { motion } from "motion/react";

export default function NoiseOverlay() {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-[25]"
      style={{
        backgroundImage: `
          repeating-radial-gradient(circle at 0 0, rgba(255,255,255,0.03) 0, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 100%)`,
        backgroundSize: "4px 4px",
        mixBlendMode: "overlay",
        opacity: 0.25,
      }}
      animate={{ opacity: [0.15, 0.25, 0.15] }}
      transition={{
        repeat: Infinity,
        duration: 6,
        ease: "easeInOut",
      }}
    />
  );
}
