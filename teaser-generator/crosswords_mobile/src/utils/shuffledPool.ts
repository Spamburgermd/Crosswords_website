/**
 * src/utils/shuffledPool.ts
 * -----------------------------------------------------------
 * Fisher-Yates shuffle queue that avoids back-to-back repeats
 * across reshuffles.
 */

export type ShuffledPool = {
  next(): string;
};

function fisherYates<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createShuffledPool(items: string[]): ShuffledPool {
  if (items.length === 0) return { next: () => '' };

  let queue: string[] = [];
  let lastShown = '';

  function refill() {
    let shuffled = fisherYates(items);
    // Prevent last-shown from being the first after reshuffle
    if (shuffled.length > 1 && shuffled[0] === lastShown) {
      const swap = Math.floor(Math.random() * (shuffled.length - 1)) + 1;
      [shuffled[0], shuffled[swap]] = [shuffled[swap], shuffled[0]];
    }
    queue = shuffled;
  }

  refill();

  return {
    next() {
      if (queue.length === 0) refill();
      const item = queue.pop()!;
      lastShown = item;
      return item;
    },
  };
}
