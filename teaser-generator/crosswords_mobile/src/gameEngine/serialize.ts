/**
 * src/gameEngine/serialize.ts
 * ---------------------------------------------
 * Encode/decode challenge/result payloads using JSON + base64url.
 * Compression via pako is omitted here to avoid bundler resolution issues;
 * codes will be longer but fully deterministic and offline-safe.
 */

import { Buffer } from 'buffer';

import {
  ChallengePayload,
  ResultPayload,
  ChallengeOfferPayload,
  ChallengeReturnPayload,
  ChallengeBundlePayload,
} from './types';

/** Stable stringify that sorts keys for deterministic hashing. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined) // match JSON.stringify behavior: skip undefined
    .sort(([a], [b]) => a.localeCompare(b));
  const inner = entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',');
  return `{${inner}}`;
}

/** Convert Uint8Array -> base64url string (no padding). */
export function toBase64Url(bytes: Uint8Array): string {
  const b64 = Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/** Convert base64url string -> Uint8Array. */
export function fromBase64Url(b64url: string): Uint8Array {
  const padded = b64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(b64url.length / 4) * 4, '=');
  return new Uint8Array(Buffer.from(padded, 'base64'));
}

function encodePayload(payload: object): string {
  const json = stableStringify(payload);
  const bytes = Buffer.from(json, 'utf-8');
  return toBase64Url(bytes);
}

/**
 * Sanitize a pasted code string: strip share-text prefixes, deep-link
 * wrappers, zero-width / invisible Unicode characters, and whitespace
 * that messaging apps (Discord, WhatsApp, SMS) may inject.
 */
function sanitizeCode(raw: string): string {
  let s = raw;

  // Strip invisible / zero-width Unicode characters Discord loves to add
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\u200B-\u200D\uFEFF\u00A0\u2060\u2028\u2029\u0000-\u001F]/g, '');

  // Remove angle brackets Discord wraps around URLs: <myapp://...>
  s = s.replace(/[<>]/g, '');

  // Remove markdown formatting (backticks, bold, etc.)
  // NOTE: Do NOT strip underscores (_) — they are valid base64url characters!
  s = s.replace(/[`*~]/g, '');

  // URL-decode in case messaging app percent-encoded the base64url chars
  try {
    if (s.includes('%')) s = decodeURIComponent(s);
  } catch { /* ignore bad percent sequences */ }

  // Strip share-text prefix: "CrosSWords Offer: ", "My CrosSWords result: ", etc.
  s = s.replace(/^.*CrosSWords\s+\w+:\s*/i, '');

  // Strip deep-link wrapper: "myapp://offer/CODE" or "myapp://return/CODE"
  s = s.replace(/^myapp:\/\/\w+\//i, '');

  // Strip any other URL-like prefix (https://..., http://...)
  s = s.replace(/^https?:\/\/\S+\//i, '');

  // Strip any remaining whitespace / newlines
  s = s.replace(/\s+/g, '');

  // Keep only valid base64url characters (A-Z, a-z, 0-9, -, _, =)
  s = s.replace(/[^A-Za-z0-9\-_=]/g, '');

  return s;
}

function decodePayload<T>(code: string): T {
  const clean = sanitizeCode(code);
  if (!clean) throw new Error('Empty code after sanitizing input');
  const bytes = fromBase64Url(clean);
  const json = Buffer.from(bytes).toString('utf-8');
  try {
    return JSON.parse(json) as T;
  } catch (e) {
    // Show start AND end of decoded text plus length for debugging
    const start = json.slice(0, 60);
    const end = json.length > 60 ? '...' + json.slice(-30) : '';
    throw new Error(
      `Invalid code (${json.length} chars). ` +
      `Decoded: "${start}${end}"`
    );
  }
}

// Public helpers -------------------------------------------------------------

export function encodeChallenge(payload: ChallengePayload): string {
  return encodePayload(payload);
}

export function decodeChallenge(code: string): ChallengePayload {
  return decodePayload<ChallengePayload>(code);
}

export function encodeResult(payload: ResultPayload): string {
  return encodePayload(payload);
}

export function decodeResult(code: string): ResultPayload {
  return decodePayload<ResultPayload>(code);
}

// New offer/return/bundle helpers (backward compatible)
export function encodeOffer(payload: ChallengeOfferPayload): string {
  return encodePayload(payload);
}

export function decodeOffer(code: string): ChallengeOfferPayload {
  return decodePayload<ChallengeOfferPayload>(code);
}

export function encodeReturn(payload: ChallengeReturnPayload): string {
  return encodePayload(payload);
}

export function decodeReturn(code: string): ChallengeReturnPayload {
  return decodePayload<ChallengeReturnPayload>(code);
}

export function encodeBundle(payload: ChallengeBundlePayload): string {
  return encodePayload(payload);
}

export function decodeBundle(code: string): ChallengeBundlePayload {
  return decodePayload<ChallengeBundlePayload>(code);
}
