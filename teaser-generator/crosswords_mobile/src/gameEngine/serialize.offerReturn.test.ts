import {
  encodeOffer,
  decodeOffer,
  encodeReturn,
  decodeReturn,
  encodeBundle,
  decodeBundle,
} from './serialize';
import type { ChallengeBundlePayload, ChallengeOfferPayload, ChallengeReturnPayload } from './types';

describe('offer/return/bundle roundtrip', () => {
  const offer: ChallengeOfferPayload = {
    v: 1,
    type: 'offer' as const,
    offerId: 'abc',
    mode: 'sender_picks_for_receiver' as const,
    dictionaryId: 'twl',
    receiverTargets: ['APPLE', 'BERRY', 'CANDY', 'STONE', 'BRICK'],
    createdAtMs: 1,
  };
  const ret: ChallengeReturnPayload = {
    v: 1,
    type: 'return' as const,
    offerId: 'abc',
    senderTargets: ['MOUSE', 'PLANT', 'LETTER', 'HONEY', 'PIZZA'],
    createdAtMs: 2,
  };

  it('offer roundtrip', () => {
    const code = encodeOffer(offer);
    const decoded = decodeOffer(code);
    expect(decoded.offerId).toBe('abc');
    expect(decoded.receiverTargets?.length).toBe(5);
  });

  it('return roundtrip', () => {
    const code = encodeReturn(ret);
    const decoded = decodeReturn(code);
    expect(decoded.senderTargets[0]).toBe('MOUSE');
  });

  it('bundle roundtrip', () => {
    const bundle: ChallengeBundlePayload = { v: 1, type: 'bundle', offer, return: ret };
    const code = encodeBundle(bundle);
    const decoded = decodeBundle(code);
    expect(decoded.offer.offerId).toBe('abc');
    expect(decoded.return).toBeDefined();
    expect(decoded.return?.senderTargets[4]).toBe('PIZZA');
  });
});
