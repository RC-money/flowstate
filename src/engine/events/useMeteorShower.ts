import { useCallback, useEffect, useMemo, useState } from "react";
import { getTemporalEngine } from "../temporal";
import type { CelestialKind } from "../temporal";

const METEOR_DURATION_MS = 90_000;
const METEOR_KIND: CelestialKind = "asteroid";

interface MeteorShowerOptions {
  autoTrigger?: boolean;
  onMessage?: (text: string) => void;
}

export const useMeteorShower = ({
  autoTrigger = true,
  onMessage,
}: MeteorShowerOptions = {}) => {
  const engine = useMemo(() => getTemporalEngine(), []);
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const endEvent = useCallback(() => {
    setActive(false);
    setMessage(null);
    if (typeof document !== "undefined") {
      document.documentElement.style.removeProperty("--meteor-particle-speed");
    }
  }, []);

  const startEvent = useCallback(() => {
    if (active) return;
    setActive(true);
    const hunterMsg = "Captain… the sky is falling. Perfect time to hunt.";
    setMessage(hunterMsg);
    engine.boostKind(METEOR_KIND, 0.35, 0.12);
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("--meteor-particle-speed", "1.35");
    }
    onMessage?.(hunterMsg);
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        endEvent();
      }, METEOR_DURATION_MS);
    }
  }, [active, endEvent, engine, onMessage]);

  useEffect(() => {
    if (!autoTrigger) return undefined;
    if (typeof window === "undefined") return undefined;
    const delay = 5000;
    const timer = window.setTimeout(() => {
      startEvent();
    }, delay);
    return () => {
      window.clearTimeout(timer);
      endEvent();
    };
  }, [autoTrigger, startEvent, endEvent]);

  return { active, message, triggerMeteorShower: startEvent };
};
