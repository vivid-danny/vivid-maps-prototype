// Seeded pseudo-random number generator for deterministic seat configurations
// Uses mulberry32 algorithm - simple, fast, and produces good distribution

export function createSeededRandom(seed: number) {
  let state = seed;

  // mulberry32 algorithm
  const next = (): number => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    // Get next random number between 0 and 1
    random: next,

    // Get random integer between min (inclusive) and max (exclusive)
    randInt: (min: number, max: number): number => {
      return Math.floor(next() * (max - min)) + min;
    },

    // Get random boolean with given probability of true
    randBool: (probability = 0.5): boolean => {
      return next() < probability;
    },

    // Shuffle array in place using Fisher-Yates
    shuffle: <T>(array: T[]): T[] => {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    },

    // Pick n random items from array (without replacement)
    pick: <T>(array: T[], n: number): T[] => {
      const copy = [...array];
      const result: T[] = [];
      for (let i = 0; i < n && copy.length > 0; i++) {
        const idx = Math.floor(next() * copy.length);
        result.push(copy.splice(idx, 1)[0]);
      }
      return result;
    },
  };
}

export type SeededRandom = ReturnType<typeof createSeededRandom>;
