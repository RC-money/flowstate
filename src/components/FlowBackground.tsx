import { motion, useMotionValue, useTransform, useAnimationFrame } from "motion/react";
import { useRef } from "react";

export function FlowBackground() {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const translateX = useTransform(mouseX, [0, window.innerWidth], ["-5%", "5%"]);
  const translateY = useTransform(mouseY, [0, window.innerHeight], ["-5%", "5%"]);

  // Smooth follow animation
  useAnimationFrame(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      mouseX.set((window.innerWidth / 2 - rect.width / 2) / 2);
      mouseY.set((window.innerHeight / 2 - rect.height / 2) / 2);
    }
  });

  const handleMouseMove = (e: React.MouseEvent) => {
    mouseX.set(e.clientX);
    mouseY.set(e.clientY);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="absolute inset-0 overflow-hidden -z-10"
    >
      {/* Main gradient orb */}
      <motion.div
        className="absolute w-[700px] h-[700px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(91,92,240,0.15)_0%,_transparent_70%)]"
        style={{
          translateX,
          translateY,
        }}
        transition={{ type: "spring", stiffness: 20, damping: 15 }}
      />
      {/* Accent orb */}
      <motion.div
        className="absolute bottom-0 right-0 w-[450px] h-[450px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(165,175,255,0.12)_0%,_transparent_70%)]"
        style={{
          translateX: useTransform(mouseX, [0, window.innerWidth], ["2%", "-2%"]),
          translateY: useTransform(mouseY, [0, window.innerHeight], ["2%", "-2%"]),
        }}
        transition={{ type: "spring", stiffness: 15, damping: 20 }}
      />
    </div>
  );
}
