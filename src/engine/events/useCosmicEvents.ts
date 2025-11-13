import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CosmicEventsEngine } from "./cosmicEvents";
import type { ActiveCosmicEvent, CosmicEventMetrics } from "./types";

interface UseCosmicEventsOptions {
  metrics: CosmicEventMetrics;
  onEventTriggered?: (event: ActiveCosmicEvent) => void;
  intervalMs?: number;
}

export const useCosmicEvents = ({
  metrics,
  onEventTriggered,
  intervalMs = 60_000,
}: UseCosmicEventsOptions) => {
  const engine = useMemo(() => new CosmicEventsEngine(), []);
  const [activeEvent, setActiveEvent] = useState<ActiveCosmicEvent | null>(engine.getActiveEvent());
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const metricsRef = useRef(metrics);

  useEffect(() => {
    metricsRef.current = metrics;
  }, [metrics]);

  const tick = useCallback(() => {
    const event = engine.tick(metricsRef.current);
    if (event) {
      setActiveEvent(event);
      onEventTriggered?.(event);
    } else {
      setActiveEvent(engine.getActiveEvent());
    }
  }, [engine, onEventTriggered]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    tick();
    const id = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(id);
  }, [tick, intervalMs]);

  return {
    activeEvent,
    alertsEnabled,
    toggleAlerts: () => setAlertsEnabled((prev) => !prev),
  };
};
