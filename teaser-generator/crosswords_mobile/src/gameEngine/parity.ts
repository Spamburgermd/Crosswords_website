/**
 * src/gameEngine/parity.ts
 * ---------------------------------------------
 * Helpers for comparing engine feedback against golden fixtures.
 * Normalization is intentionally minimal and documented to avoid hiding
 * real mismatches.
 */

/** Optional normalization: align "red"/"grey" naming without masking other diffs. */
export function normalizeCodes(codes: string[]): string[] {
  return codes.map((c) => {
    const lower = c.toLowerCase();
    if (lower === 'red') return 'grey'; // server uses "grey" for misses; engine used "red"
    return lower;
  });
}

/** Human-readable diff describing where codes diverge. */
export function diffCodes(expected: string[], actual: string[]): { ok: boolean; message?: string } {
  const normExpected = normalizeCodes(expected);
  const normActual = normalizeCodes(actual);
  const issues: string[] = [];
  if (normExpected.length !== normActual.length) {
    issues.push(`length expected=${normExpected.length} actual=${normActual.length}`);
  }
  const len = Math.min(normExpected.length, normActual.length);
  for (let i = 0; i < len; i++) {
    if (normExpected[i] !== normActual[i]) {
      issues.push(`idx ${i}: expected ${normExpected[i]} vs actual ${normActual[i]}`);
    }
  }
  return { ok: issues.length === 0, message: issues.length ? issues.join('; ') : undefined };
}
