export type RevealOwnership = {
  targetIndex: number;
  expiresAtMs: number;
};

export function beginRevealOwnership(
  targetIndex: number,
  nowMs: number,
  durationMs: number,
): RevealOwnership {
  return {
    targetIndex,
    expiresAtMs: nowMs + Math.max(0, durationMs),
  };
}

export function resolveRevealTargetIndex(
  revealOwnership: RevealOwnership | null | undefined,
  nowMs: number,
): number | null {
  if (!revealOwnership) return null;
  return nowMs < revealOwnership.expiresAtMs ? revealOwnership.targetIndex : null;
}
