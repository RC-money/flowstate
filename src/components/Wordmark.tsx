import React, { useEffect, useMemo, useState } from "react";

const letters = "FLOWSTATE".split("");

const prefersReducedMotion = () => {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

const Wordmark: React.FC = () => {
  const [ready, setReady] = useState(false);
  const rp = useMemo(prefersReducedMotion, []);

  useEffect(() => {
    if (rp) return;
    const id = window.requestAnimationFrame(() => setReady(true));
    return () => window.cancelAnimationFrame(id);
  }, [rp]);

  return (
    <div className="inline-flex items-center gap-1 text-4xl font-extrabold tracking-[0.3em] text-white">
      {letters.map((letter, index) => (
        <span
          key={letter + index}
          className="inline-block will-change-[filter,opacity]"
          style={{
            animation: rp
              ? "none"
              : `${"flowstate-wave"} 800ms ease-out forwards`,
            animationDelay: rp ? undefined : `${index * 80}ms`,
            opacity: rp ? 1 : 0,
            filter: rp ? "none" : "blur(6px)",
          }}
          aria-hidden="true"
        >
          {letter}
        </span>
      ))}
      {!rp && ready ? (
        <style>
          {`@keyframes flowstate-wave {
            0% { opacity: 0; filter: blur(8px); transform: translateY(8px); }
            60% { opacity: 1; filter: blur(0px); transform: translateY(0); }
            100% { opacity: 1; filter: blur(0px); transform: translateY(0); }
          }`}
        </style>
      ) : null}
    </div>
  );
};

export default Wordmark;
