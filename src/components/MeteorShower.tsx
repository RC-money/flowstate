import React, { useEffect, useRef } from "react";
import { METEOR_SHOWER_EVENT } from "../hooks/useAmbientAudio";

interface Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  len: number;
  delay: number;
  born: number;
  hue: string;
}

/**
 * Meteors for the emotional moments. Idle until a meteor-shower event
 * arrives (the ambient player fires one on each musical swell), then a
 * burst streaks across and the canvas goes back to sleep. Honors
 * prefers-reduced-motion by never waking at all.
 */
const MeteorShower: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let meteors: Meteor[] = [];
    let frame: number | null = null;
    let last = 0;
    let w = 0;
    let h = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const step = (now: number) => {
      const dt = last ? Math.min((now - last) / 16.7, 3) : 1;
      last = now;
      ctx.clearRect(0, 0, w, h);
      meteors = meteors.filter(
        (m) => m.x > -m.len && m.y < h + m.len
      );
      for (const m of meteors) {
        if (now - m.born < m.delay) continue;
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        const tailX = m.x - (m.vx / Math.hypot(m.vx, m.vy)) * m.len;
        const tailY = m.y - (m.vy / Math.hypot(m.vx, m.vy)) * m.len;
        const trail = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
        trail.addColorStop(0, `rgba(${m.hue},0.9)`);
        trail.addColorStop(1, `rgba(${m.hue},0)`);
        ctx.strokeStyle = trail;
        ctx.lineWidth = 1.4;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();
      }
      if (meteors.length) {
        frame = window.requestAnimationFrame(step);
      } else {
        ctx.clearRect(0, 0, w, h);
        frame = null;
        last = 0;
      }
    };

    const spawn = () => {
      if (reduceMotion) return;
      const now = performance.now();
      const count = 12 + Math.floor(Math.random() * 8);
      for (let i = 0; i < count; i += 1) {
        const speed = 7 + Math.random() * 6;
        meteors.push({
          x: w * 0.2 + Math.random() * w,
          y: -30 - Math.random() * h * 0.25,
          vx: -speed * 0.55,
          vy: speed,
          len: 70 + Math.random() * 110,
          delay: Math.random() * 1800,
          born: now,
          hue: Math.random() > 0.6 ? "165,175,255" : "255,255,255",
        });
      }
      if (frame === null) frame = window.requestAnimationFrame(step);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener(METEOR_SHOWER_EVENT, spawn);
    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener(METEOR_SHOWER_EVENT, spawn);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0"
    />
  );
};

export default MeteorShower;
