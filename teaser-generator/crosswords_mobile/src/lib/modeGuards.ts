/**
 * src/lib/modeGuards.ts
 * ---------------------------------------------
 * Centralized mode guards so screen logic does not drift between local-only
 * and server-enabled behavior.
 */

export type PlayMode = 'pvp' | 'solo' | 'bot';

/**
 * True only when the current board session is true network PvP:
 * - mode is explicitly pvp
 * - server functions switch is enabled
 */
export function isNetworkPvPMode(mode: PlayMode, serverEnabled: boolean): boolean {
  return mode === 'pvp' && serverEnabled;
}

/**
 * Local scoring must be used in every non-network path:
 * - solo
 * - bot
 * - pvp while server switch is disabled (defensive fallback)
 */
export function shouldForceLocalScoring(mode: PlayMode, serverEnabled: boolean): boolean {
  return !isNetworkPvPMode(mode, serverEnabled);
}

