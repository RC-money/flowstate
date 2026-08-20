/**
 * Pick the next track for shuffle play. Prefers anything other than the
 * current track so a two-song library alternates instead of stuttering.
 * `rand` is a [0, 1) roll passed in so the choice stays testable.
 */
export const pickNextTrack = (
  tracks: string[],
  current: string | null,
  rand: number
): string | null => {
  if (!tracks.length) return null;
  const pool = tracks.filter((track) => track !== current);
  const candidates = pool.length ? pool : tracks;
  return candidates[Math.floor(rand * candidates.length)];
};
