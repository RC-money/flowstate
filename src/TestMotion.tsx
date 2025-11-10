import { motion } from "@motionone/react";

;

export default function TestMotion() {
  return (
    <motion.div
      className="w-32 h-32 bg-pink-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
    />
  );
}
