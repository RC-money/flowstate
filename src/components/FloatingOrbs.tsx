import React from "react";
import { motion } from "@motionone/react"
;

export default function FloatingOrbs() {
  return (
    <>
      <motion.div
        className="absolute top-20 left-1/3 w-64 h-64 rounded-full bg-indigo-500/10 blur-3xl"
        animate={{ y: [0, 20, 0], opacity: [0.6, 0.8, 0.6] }}
        transition={{ repeat: Infinity, duration: 14 }}
      />
      <motion.div
        className="absolute bottom-10 right-1/4 w-80 h-80 rounded-full bg-cyan-500/10 blur-3xl"
        animate={{ y: [0, -20, 0], opacity: [0.5, 0.7, 0.5] }}
        transition={{ repeat: Infinity, duration: 16 }}
      />
    </>
  );
}
