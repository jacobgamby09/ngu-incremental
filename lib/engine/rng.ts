export type SeededRng = {
  next: () => number;
  integer: (min: number, max: number) => number;
  chance: (percent: number) => boolean;
};

function hashSeed(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createRng(seed: string): SeededRng {
  let state = hashSeed(seed) || 0x6d2b79f5;

  const next = () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    integer(min, max) {
      const low = Math.ceil(Math.min(min, max));
      const high = Math.floor(Math.max(min, max));
      return low + Math.floor(next() * (high - low + 1));
    },
    chance(percent) {
      return next() * 100 < Math.max(0, Math.min(100, percent));
    },
  };
}
