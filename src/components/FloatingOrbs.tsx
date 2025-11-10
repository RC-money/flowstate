import { motion } from "motion/react";

export function FloatingOrbs() {
  const orbs = [
    { size: 180, color: "rgba(91,92,240,0.25)", x: "10%", y: "15%" },
    { size: 220, color: "rgba(165,175,255,0.18)", x: "70%", y: "40%" },
    { size: 260, color: "rgba(124,131,255,0.12)", x: "45%", y: "75%" },
  ];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {orbs.map((orb, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full blur-[120px]"
          style={{
            width: orb.size,
            height: orb.size,
            background: orb.color,
            top: orb.y,
            left: orb.x,
          }}
          animate={{
            y: ["0%", "-4%", "0%"],
            x: ["0%", "2%", "0%"],
            opacity: [0.4, 0.6, 0.4],
          }}
          transition={{
            duration: 14 + i * 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
