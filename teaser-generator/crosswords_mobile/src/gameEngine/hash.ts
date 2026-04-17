/**
 * src/gameEngine/hash.ts
 * ---------------------------------------------
 * Stable challenge identifier generator.
 * Uses SHA-256 over a stable JSON representation, then shortens to keep
 * URLs compact. Falls back to a lightweight hash if crypto is unavailable.
 */

import type { ChallengePayload, ChallengeOfferPayload, ChallengeReturnPayload } from './types';

/** Stable stringify shared with serialize.ts to ensure matching inputs. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const inner = entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',');
  return `{${inner}}`;
}

/** Lightweight non-crypto fallback (FNV-1a 32-bit) used only if crypto is missing. */
function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  // Return 8 hex chars to keep it short.
  return hash.toString(16).padStart(8, '0');
}

function shaOrFallback(input: string): string {
  try {
    // Prefer Node's crypto (available in Metro via polyfill).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createHash } = require('crypto') as typeof import('crypto');
    const hash = createHash('sha256').update(input).digest('base64url');
    // Trim to 24 chars: enough entropy (~144 bits) while URL friendly.
    return hash.slice(0, 24);
  } catch {
    // Fallback is non-cryptographic but deterministic.
    return fnv1a(input);
  }
}

export function stableChallengeId(payload: ChallengePayload): string {
  const input = stableStringify(payload);
  return shaOrFallback(input);
}

/**
 * Stable id for an offer/return bundle. Kept here so ChallengeScreen can call
 * a single helper instead of duplicating hashing logic.
 */
export function stableOfferId(payload: ChallengeOfferPayload | ChallengeReturnPayload): string {
  const input = stableStringify(payload);
  return shaOrFallback(input);
}
