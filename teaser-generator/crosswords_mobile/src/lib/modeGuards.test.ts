import { isNetworkPvPMode, shouldForceLocalScoring } from './modeGuards';

describe('modeGuards', () => {
  it('treats only pvp+server-enabled as network PvP', () => {
    expect(isNetworkPvPMode('pvp', true)).toBe(true);
    expect(isNetworkPvPMode('pvp', false)).toBe(false);
    expect(isNetworkPvPMode('solo', true)).toBe(false);
    expect(isNetworkPvPMode('bot', true)).toBe(false);
  });

  it('forces local scoring for all non-network branches', () => {
    expect(shouldForceLocalScoring('solo', true)).toBe(true);
    expect(shouldForceLocalScoring('bot', true)).toBe(true);
    expect(shouldForceLocalScoring('pvp', false)).toBe(true);
    expect(shouldForceLocalScoring('pvp', true)).toBe(false);
  });
});

