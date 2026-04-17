/**
 * src/localChallenge/seedInput.ts
 * -----------------------------------------------------------
 * Shared helpers for local seed entry and "random" seed creation.
 * Keeping this logic in one file prevents different screens from
 * silently interpreting the same user input in different ways.
 */

const RANDOM_SEED_MOD = 1_000_000;

/**
 * Create a repeatable pseudo-random-looking seed from a clock value.
 * The caller may pass a mocked timestamp in tests.
 */
export function createRandomSeed(nowMs: number = Date.now()): number {
  return Math.trunc(Math.abs(nowMs)) % RANDOM_SEED_MOD;
}

export type ParsedExplicitSeed =
  | { ok: true; seed: number }
  | { ok: false; error: string };

/**
 * Parse user-entered seed text strictly.
 * We intentionally reject mixed text so explicit seeds never
 * fall back to a hidden time-based seed.
 */
export function parseExplicitSeed(raw: string): ParsedExplicitSeed {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: 'Enter a numeric seed.' };
  }
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false, error: 'Seed must contain digits only.' };
  }

  const seed = Number(trimmed);
  if (!Number.isSafeInteger(seed)) {
    return { ok: false, error: 'Seed is too large.' };
  }

  return { ok: true, seed };
}
