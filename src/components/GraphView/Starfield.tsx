import React, { useEffect, useRef, useState } from "react";

export type StarEvent = "add" | "move" | "complete" | null;

interface StarfieldProps {
  enabled: boolean;
  zoom: number;
  className?: string;
  nodePositions?: ReadonlyArray<{ x: number; y: number }>;
  nodePositionsRef?: React.MutableRefObject<ReadonlyArray<{ x: number; y: number }>>;
  event?: StarEvent;
  tint?: { h: number; s: number; a: number };
}

type Star = {
  x: number;
  y: number;
  r: number;
  alpha: number;
  speed: number;
  vx: number;
  vy: number;
  twinkle: number;
  gravitate: boolean;
  gravityFactor: number;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const getMeteorMultiplier = (): number => {
  if (typeof document === "undefined") return 1;
  const raw = document.documentElement.style.getPropertyValue("--meteor-particle-speed");
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return 1;
  return value;
};

const EVENT_COLORS: Record<Exclude<StarEvent, null>, [number, number, number]> = {
  add: [56, 189, 248],
  move: [99, 102, 241],
  complete: [16, 185, 129],
};

const createStars = (width: number, height: number): Star[] => {
  const base = Math.min(340, Math.max(140, Math.round((width * height) / 9000)));
  return Array.from({ length: base }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    r: Math.random() * 1.2 + 0.3,
    alpha: Math.random() * 0.5 + 0.35,
    speed: (Math.random() - 0.5) * 0.22,
    vx: (Math.random() - 0.5) * 0.05,
    vy: (Math.random() - 0.5) * 0.05,
    twinkle: Math.random() * Math.PI * 2,
    gravitate: Math.random() < 0.02,
    gravityFactor: Math.random() * 0.6 + 0.4,
  }));
};

const Starfield: React.FC<StarfieldProps> = ({
  enabled,
  zoom,
  className,
  nodePositions,
  nodePositionsRef,
  event,
  tint,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const sizeRef = useRef<{ w: number; h: number; dpr: number }>({ w: 0, h: 0, dpr: 1 });
  const starsRef = useRef<Star[]>([]);
  const zoomRef = useRef(zoom);
  const targetsRef = useRef<ReadonlyArray<{ x: number; y: number }>>([]);
  const pulseColorRef = useRef<[number, number, number] | null>(null);
  const pulseProgressRef = useRef(0);
  const breathingPhaseRef = useRef(Math.random() * Math.PI * 2);
  const lastTimeRef = useRef<number>(performance.now());
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    if (nodePositions && nodePositions.length) {
      targetsRef.current = nodePositions;
      return;
    }
    targetsRef.current = nodePositionsRef?.current ?? [];
  }, [nodePositions, nodePositionsRef]);

  useEffect(() => {
    if (!event) return;
    pulseColorRef.current = EVENT_COLORS[event];
    pulseProgressRef.current = 0;
  }, [event]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }
    setPrefersReducedMotion(mediaQuery.matches);
    return () => {
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !enabled) {
      return undefined;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      sizeRef.current = { w, h, dpr };
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      starsRef.current = createStars(w, h);
    };

    resize();
    if (!resizeObserverRef.current) {
      resizeObserverRef.current = new ResizeObserver(resize);
    }
    resizeObserverRef.current.observe(canvas);

    const draw = (now: number) => {
      const { w, h } = sizeRef.current;
      const dt = Math.min(60, now - (lastTimeRef.current || now));
      lastTimeRef.current = now;
      ctx.clearRect(0, 0, w, h);

      const parallax = (1 / Math.max(0.5, zoomRef.current)) * 0.55;
      const gravityTargets = targetsRef.current.length
        ? targetsRef.current
        : nodePositionsRef?.current ?? [];

      const meteorBoost = getMeteorMultiplier();

      for (const star of starsRef.current) {
        star.x += star.speed * parallax * meteorBoost;
        star.twinkle += 0.0015 * dt;

        if (star.gravitate && gravityTargets.length > 0) {
          let nearestDx = 0;
          let nearestDy = 0;
          let nearestDist = Infinity;
          for (const node of gravityTargets) {
            const dx = node.x - star.x;
            const dy = node.y - star.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < nearestDist) {
              nearestDist = dist;
              nearestDx = dx;
              nearestDy = dy;
            }
          }
          if (nearestDist < Infinity) {
            const norm = nearestDist || 1;
            const falloff = Math.min(1, 140 / (nearestDist + 60));
            const pull = 0.02 * star.gravityFactor * falloff;
            star.vx += (nearestDx / norm) * pull;
            star.vy += (nearestDy / norm) * pull;
          }
        }

        star.vx *= 0.97;
        star.vy *= 0.97;
        star.x += star.vx;
        star.y += star.vy;

        if (star.x < -4) star.x = w + 4;
        if (star.x > w + 4) star.x = -4;
        if (star.y < -4) star.y = h + 4;
        if (star.y > h + 4) star.y = -4;

        ctx.beginPath();
        const twinkle = 0.8 + 0.2 * Math.sin(star.twinkle + star.x * 0.01);
        ctx.globalAlpha = enabled ? clamp(star.alpha * twinkle, 0.1, 0.95) : 0;
        ctx.fillStyle = "#ffffff";
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Pulse overlay
      if (pulseColorRef.current) {
        pulseProgressRef.current += dt / 160;
        const progress = clamp(pulseProgressRef.current, 0, 1);
        const eased = 1 - (1 - progress) * (1 - progress);
        const [r, g, b] = pulseColorRef.current;
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = 0.18 * (1 - eased);
        const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.1, w / 2, h / 2, Math.max(w, h) * 0.8);
        grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.85)`);
        grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
        if (progress >= 1) {
          pulseColorRef.current = null;
          pulseProgressRef.current = 0;
        }
      }

      // Ambient tint breathing
      if (tint) {
        breathingPhaseRef.current += dt * 0.0012;
        const amplitude = 0.65 + 0.35 * Math.sin(breathingPhaseRef.current);
        const alpha = clamp(tint.a * amplitude, 0, 0.3);
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.fillStyle = `hsla(${tint.h}, ${Math.round(tint.s * 100)}%, 50%, ${alpha})`;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }

      if (!prefersReducedMotion && !document.hidden) {
        frameRef.current = window.requestAnimationFrame(draw);
      } else {
        frameRef.current = null;
      }
    };

    const startAnimation = () => {
      if (prefersReducedMotion || document.hidden) {
        frameRef.current = null;
        draw(performance.now());
        return;
      }
      if (frameRef.current === null) {
        lastTimeRef.current = performance.now();
        frameRef.current = window.requestAnimationFrame(draw);
      }
    };

    const stopAnimation = () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopAnimation();
      } else if (!prefersReducedMotion) {
        startAnimation();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    startAnimation();

    return () => {
      stopAnimation();
      if (resizeObserverRef.current && canvas) {
        resizeObserverRef.current.unobserve(canvas);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, tint, prefersReducedMotion]);

  return (
    <div
      className={["pointer-events-none", className ?? "-z-10"]
        .filter(Boolean)
        .join(" ")}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        className="absolute inset-0 rounded-2xl"
        style={{ transition: "opacity 0.35s ease", opacity: enabled ? 1 : 0 }}
      />
    </div>
  );
};

export default Starfield;
