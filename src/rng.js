// Kleiner deterministischer Zufallsgenerator (mulberry32). Der Zustand liegt im Spielstand,
// damit Offline-Nachberechnung und Tests reproduzierbar sind.

export function nextRandom(state) {
  let a = (state.rng = (state.rng + 0x6d2b79f5) | 0);
  a = Math.imul(a ^ (a >>> 15), a | 1);
  a ^= a + Math.imul(a ^ (a >>> 7), a | 61);
  return ((a ^ (a >>> 14)) >>> 0) / 4294967296;
}

export function makeRng(state) {
  const r = () => nextRandom(state);
  r.int = (min, max) => min + Math.floor(r() * (max - min + 1));
  r.pick = (arr) => arr[Math.floor(r() * arr.length)];
  r.chance = (p) => r() < p;
  r.range = (min, max) => min + r() * (max - min);
  return r;
}
