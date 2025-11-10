// src/components/GlowOverlay.tsx
import { motion, AnimatePresence } from "motion/react";

interface GlowOverlayProps {
  activeColumn: "todo" | "inprogress" | "done" | null;
}

export function GlowOverlay({ activeColumn }: GlowOverlayProps) {
  return (
    <AnimatePresence>
        {activeColumn && (
 <motion.div
  key={activeColumn}
className="absolute md:top-[23%] top-[28%] -translate-x-1/2 w-[420px] h-[420px] rounded-full pointer-events-none blur-[90px] z-[20]"
  style={{
    left:
      activeColumn === "todo"
        ? "22%"
        : activeColumn === "inprogress"
        ? "50%"
        : "78%",
    background: `radial-gradient(circle at center, ${
      activeColumn === "todo"
        ? "rgba(103, 232, 249, 0.35)"
        : activeColumn === "inprogress"
        ? "rgba(59, 130, 246, 0.35)"
        : "rgba(16, 185, 129, 0.35)"
    } 0%, transparent 60%)`,
  }}
  initial={{ opacity: 0, scale: 0.9 }}
  animate={{ opacity: 0.55, scale: 1 }}
  exit={{ opacity: 0, scale: 0.9 }}
  transition={{ duration: 0.25, ease: "easeOut" }}
/>


        )}
    </AnimatePresence>
  );
}
