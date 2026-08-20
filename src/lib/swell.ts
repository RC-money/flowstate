/**
 * Detects emotional swells in a live audio signal: a moment noticeably
 * louder than the track's own recent baseline. The baseline is an
 * exponential moving average, so slow crescendos get absorbed and only
 * genuine surges fire. `now` comes in as a parameter, like everywhere else.
 */
export interface SwellState {
  avg: number;
  lastSwellAt: number;
}

export interface SwellOptions {
  /** EMA weight for each new sample. */
  alpha: number;
  /** How far above baseline a sample must land to count as a swell. */
  ratio: number;
  /** Absolute RMS floor -- silence never swells. */
  minEnergy: number;
  /** Minimum time between swells, in ms. */
  cooldownMs: number;
}

export const DEFAULT_SWELL_OPTIONS: SwellOptions = {
  alpha: 0.05,
  ratio: 1.4,
  minEnergy: 0.08,
  cooldownMs: 8000,
};

export const initialSwellState = (): SwellState => ({
  avg: 0,
  lastSwellAt: Number.NEGATIVE_INFINITY,
});

export const detectSwell = (
  state: SwellState,
  rms: number,
  now: number,
  options: SwellOptions = DEFAULT_SWELL_OPTIONS
): { swell: boolean; state: SwellState } => {
  const hasBaseline = state.avg > 0;
  const swell =
    hasBaseline &&
    rms >= options.minEnergy &&
    rms > state.avg * options.ratio &&
    now - state.lastSwellAt >= options.cooldownMs;
  const avg = hasBaseline
    ? state.avg * (1 - options.alpha) + rms * options.alpha
    : rms;
  return {
    swell,
    state: { avg, lastSwellAt: swell ? now : state.lastSwellAt },
  };
};
