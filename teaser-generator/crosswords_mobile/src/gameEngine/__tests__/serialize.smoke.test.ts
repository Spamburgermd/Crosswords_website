/**
 * Smoke tests for serialize encode/decode roundtrips.
 * Run with: npx jest serialize.smoke
 */
import {
  encodeOffer,
  decodeOffer,
  encodeReturn,
  decodeReturn,
  encodeBundle,
  decodeBundle,
  encodeChallenge,
  decodeChallenge,
  encodeResult,
  decodeResult,
} from '../serialize';
import type {
  ChallengeOfferPayload,
  ChallengeReturnPayload,
  ChallengeBundlePayload,
  ChallengePayload,
  ResultPayload,
} from '../types';
import { DEFAULT_RULES } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────

/** Simulate Discord mangling: add prefix, zero-width chars, angle brackets */
function discordMangle(code: string, prefix: string): string {
  // Discord adds zero-width spaces, wraps URLs in <>, may add line breaks
  const zws = '\u200B';
  return `CrosSWords ${prefix}: ${zws}<myapp://${prefix.toLowerCase()}/${code}>${zws}`;
}

/** Simulate WhatsApp: just prefix text */
function whatsappMangle(code: string, prefix: string): string {
  return `CrosSWords ${prefix}: myapp://${prefix.toLowerCase()}/${code}`;
}

/** Simulate copy-paste with extra whitespace */
function messyPaste(code: string): string {
  return `  \n  ${code}  \n  `;
}

// ─── Test Data ────────────────────────────────────────────────────────

const sampleOffer: ChallengeOfferPayload = {
  v: 1,
  type: 'offer',
  offerId: 'test-offer-123',
  mode: 'sender_picks_for_receiver',
  dictionaryId: 'twl',
  receiverTargets: ['APPLE', 'BERRY', 'CANDY', 'STONE', 'BRICK'],
  createdAtMs: 1700000000000,
  rules: { ...DEFAULT_RULES },
};

const sampleReturn: ChallengeReturnPayload = {
  v: 1,
  type: 'return',
  offerId: 'test-offer-123',
  senderTargets: ['PLANE', 'HOUSE', 'DRINK', 'LIVER', 'CRANE'],
  createdAtMs: 1700000001000,
};

const sampleBundle: ChallengeBundlePayload = {
  v: 1,
  type: 'bundle',
  offer: sampleOffer,
  return: sampleReturn,
};

const sampleChallenge: ChallengePayload = {
  v: 1,
  words: ['APPLE', 'BERRY', 'CANDY', 'STONE', 'BRICK'],
  rules: { ...DEFAULT_RULES },
  createdAtMs: 1700000000000,
};

const sampleResult: ResultPayload = {
  v: 1,
  challengeId: 'test-challenge-456',
  completed: 'win',
  attempts: 15,
  guessesByTarget: [
    ['CRANE', 'APPLE'],
    ['HOUSE', 'BERRY'],
    ['DRINK', 'CANDY'],
    ['LIVER', 'STONE'],
    ['PLANE', 'BRICK'],
  ],
};

// ─── Tests ────────────────────────────────────────────────────────────

describe('serialize roundtrip (clean)', () => {
  test('offer encode → decode', () => {
    const code = encodeOffer(sampleOffer);
    const decoded = decodeOffer(code);
    expect(decoded.offerId).toBe(sampleOffer.offerId);
    expect(decoded.receiverTargets).toEqual(sampleOffer.receiverTargets);
  });

  test('return encode → decode', () => {
    const code = encodeReturn(sampleReturn);
    const decoded = decodeReturn(code);
    expect(decoded.offerId).toBe(sampleReturn.offerId);
    expect(decoded.senderTargets).toEqual(sampleReturn.senderTargets);
  });

  test('bundle encode → decode', () => {
    const code = encodeBundle(sampleBundle);
    const decoded = decodeBundle(code);
    expect(decoded.offer.offerId).toBe(sampleOffer.offerId);
    expect(decoded.return).toBeDefined();
    expect(decoded.return?.senderTargets).toEqual(sampleReturn.senderTargets);
  });

  test('challenge encode → decode', () => {
    const code = encodeChallenge(sampleChallenge);
    const decoded = decodeChallenge(code);
    expect(decoded.words).toEqual(sampleChallenge.words);
  });

  test('result encode → decode', () => {
    const code = encodeResult(sampleResult);
    const decoded = decodeResult(code);
    expect(decoded.challengeId).toBe(sampleResult.challengeId);
    expect(decoded.completed).toBe('win');
    expect(decoded.attempts).toBe(15);
  });
});

describe('serialize roundtrip (Discord mangled)', () => {
  test('offer survives Discord mangling', () => {
    const code = encodeOffer(sampleOffer);
    const mangled = discordMangle(code, 'Offer');
    const decoded = decodeOffer(mangled);
    expect(decoded.offerId).toBe(sampleOffer.offerId);
    expect(decoded.receiverTargets).toEqual(sampleOffer.receiverTargets);
  });

  test('return survives Discord mangling', () => {
    const code = encodeReturn(sampleReturn);
    const mangled = discordMangle(code, 'Return');
    const decoded = decodeReturn(mangled);
    expect(decoded.senderTargets).toEqual(sampleReturn.senderTargets);
  });

  test('bundle survives Discord mangling', () => {
    const code = encodeBundle(sampleBundle);
    const mangled = discordMangle(code, 'Bundle');
    const decoded = decodeBundle(mangled);
    expect(decoded.offer.offerId).toBe(sampleOffer.offerId);
  });
});

describe('serialize roundtrip (WhatsApp mangled)', () => {
  test('offer survives WhatsApp mangling', () => {
    const code = encodeOffer(sampleOffer);
    const mangled = whatsappMangle(code, 'Offer');
    const decoded = decodeOffer(mangled);
    expect(decoded.offerId).toBe(sampleOffer.offerId);
  });
});

describe('serialize roundtrip (result share prefix)', () => {
  test('result survives "My CrosSWords result:" prefix', () => {
    const code = encodeResult(sampleResult);
    const mangled = `My CrosSWords result: ${code}`;
    const decoded = decodeResult(mangled);
    expect(decoded.challengeId).toBe(sampleResult.challengeId);
    expect(decoded.completed).toBe('win');
  });

  test('result survives Discord-mangled "My CrosSWords result:" prefix', () => {
    const code = encodeResult(sampleResult);
    const mangled = `\u200BMy CrosSWords result: ${code}\u200B`;
    const decoded = decodeResult(mangled);
    expect(decoded.challengeId).toBe(sampleResult.challengeId);
  });
});

describe('serialize roundtrip (messy paste)', () => {
  test('offer survives whitespace paste', () => {
    const code = encodeOffer(sampleOffer);
    const mangled = messyPaste(code);
    const decoded = decodeOffer(mangled);
    expect(decoded.offerId).toBe(sampleOffer.offerId);
  });

  test('bundle survives whitespace paste', () => {
    const code = encodeBundle(sampleBundle);
    const mangled = messyPaste(code);
    const decoded = decodeBundle(mangled);
    expect(decoded.offer.offerId).toBe(sampleOffer.offerId);
  });
});

describe('code character validation', () => {
  test('encoded offer contains only base64url chars', () => {
    const code = encodeOffer(sampleOffer);
    expect(code).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  test('encoded bundle contains only base64url chars', () => {
    const code = encodeBundle(sampleBundle);
    expect(code).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  test('encoded offer code length is reasonable', () => {
    const code = encodeOffer(sampleOffer);
    console.log(`Offer code length: ${code.length} chars`);
    expect(code.length).toBeGreaterThan(50);
    expect(code.length).toBeLessThan(2000);
  });

  test('encoded bundle code length is reasonable', () => {
    const code = encodeBundle(sampleBundle);
    console.log(`Bundle code length: ${code.length} chars`);
    expect(code.length).toBeGreaterThan(100);
    expect(code.length).toBeLessThan(5000);
  });
});
