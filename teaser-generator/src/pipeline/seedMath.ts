/**
 * Extracted from crosswords_mobile/src/localChallenge/localChallengeStore.ts
 * Pure math — no dependencies.
 */

const DAILY_SEED_SALT = 0x4a3f2b1c;

/** Converts 'YYYY-MM-DD' → an obfuscated integer seed. */
export function getDailyPuzzleSeed(dateStr: string): number {
  const raw = parseInt(dateStr.replace(/-/g, ''), 10); // e.g. 20260417
  return ((raw * 1664525 + DAILY_SEED_SALT) >>> 0) % 1_000_000;
}
