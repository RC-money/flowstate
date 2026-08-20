/**
 * The one hash the sky is built on.
 *
 * Star positions, cluster knots and deep-field galaxies all derive from an id
 * rather than a stored coordinate, so they have to agree on how an id becomes a
 * number. Sharing this keeps that promise in one place.
 *
 * FNV-1a, then two rounds of xorshift mixing. FNV alone leaves sequential ids
 * ("t1", "t2") clustered; the mixing scatters them.
 */
export const hash32 = (text: string, seed: number): number => {
  let h = 0x811c9dc5 ^ seed;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return h >>> 0;
};

/** A hash as a number in [0, 1). */
export const unit = (hash: number): number => hash / 0x1_0000_0000;
