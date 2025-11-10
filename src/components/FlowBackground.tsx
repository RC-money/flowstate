import React, { useEffect } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

export default function FlowBackground() {
  const x = useMotionValue(window.innerWidth / 2);
  const y = useMotionValue(window.innerHeight / 2);
  const sx = useSpring(x, { stiffness: 40, damping: 20 });
  const sy = useSpring(y, { stiffness: 40, damping: 20 });

  useEffect(() => {
    const move = (e: MouseEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, [x, y]);

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-[#0E1625]">
      <motion.div
        className="absolute w-[700px] h-[700px] rounded-full bg-gradient-to-br from-[#6366f1]/40 to-[#14b8a6]/30 blur-[120px] opacity-50"
        style={{
          left: sx,
          top: sy,
          translateX: "-50%",
          translateY: "-50%",
        }}
      />
      <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay" />
    </div>
  );
}
