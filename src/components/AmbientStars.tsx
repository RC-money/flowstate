import React, { useEffect, useRef } from "react";

/**
 * The quiet star dust behind the board -- the artifact's backdrop, ported.
 * Fixed, full-viewport, drawn once per resize plus a slow twinkle loop that
 * honors prefers-reduced-motion by rendering a single static frame.
 */
const AmbientStars: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let stars: Array<{ x: number; y: number; r: number; base: number; phase: number; speed: number; hue: string }> = [];
    let frame: number | null = null;
    let w = 0;
    let h = 0;

    const build = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(220, Math.round((w * h) / 6500));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.2 + 0.25,
        base: Math.random() * 0.45 + 0.15,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.5 + 0.25,
        hue: Math.random() > 0.86 ? "165,175,255" : "255,255,255",
      }));
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      for (const star of stars) {
        const alpha = reduceMotion
          ? star.base
          : Math.max(0.04, star.base + Math.sin((t / 1000) * star.speed + star.phase) * 0.2);
        ctx.beginPath();
        ctx.fillStyle = `rgba(${star.hue},${alpha.toFixed(3)})`;
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!reduceMotion) frame = window.requestAnimationFrame(draw);
    };

    build();
    if (reduceMotion) draw(0);
    else frame = window.requestAnimationFrame(draw);

    const onResize = () => {
      build();
      if (reduceMotion) draw(0);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
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

export default AmbientStars;
