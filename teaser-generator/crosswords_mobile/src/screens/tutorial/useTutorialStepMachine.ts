// crosswords_mobile/src/screens/tutorial/useTutorialStepMachine.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { TutorialGameState, TutorialPhase, TutorialStep } from './types';

export type StepMachineOutput = {
  phase:      TutorialPhase
  activeStep: TutorialStep | null   // non-null only when phase.kind === 'HINT'
  dismiss:    () => void
}

// ── Pure transition helpers (exported for unit testing) ───────────────────

export function advancePhase(
  currentPhase: TutorialPhase,
  steps: TutorialStep[],
): TutorialPhase {
  const nextIndex =
    currentPhase.kind === 'HINT'
      ? currentPhase.stepIndex + 1
      : currentPhase.kind === 'PLAYING'
        ? currentPhase.nextStepIndex
        : steps.length;
  return nextIndex >= steps.length
    ? { kind: 'DONE' }
    : { kind: 'PLAYING', nextStepIndex: nextIndex };
}

export function applyTrigger(
  phase: TutorialPhase,
  steps: TutorialStep[],
  gameState: TutorialGameState,
): TutorialPhase {
  if (phase.kind !== 'PLAYING') return phase;
  const { nextStepIndex } = phase;
  if (nextStepIndex >= steps.length) return { kind: 'DONE' };
  if (steps[nextStepIndex].trigger(gameState)) {
    return { kind: 'HINT', stepIndex: nextStepIndex };
  }
  return phase;
}

export function applyExpectedAction(
  phase: TutorialPhase,
  steps: TutorialStep[],
  gameState: TutorialGameState,
  prevGameState: TutorialGameState,
): TutorialPhase {
  if (phase.kind !== 'HINT') return phase;
  const step = steps[phase.stepIndex];
  if (!step?.expectedAction) {
    return phase;
  }
  const result = step.expectedAction(gameState, prevGameState);
  if (result) {
    return advancePhase(phase, steps);
  }
  return phase;
}

export function applyDismiss(
  phase: TutorialPhase,
  steps: TutorialStep[],
): TutorialPhase {
  if (phase.kind !== 'HINT') return phase;
  return advancePhase(phase, steps);
}

export function activeStepFor(
  phase: TutorialPhase,
  steps: TutorialStep[],
): TutorialStep | null {
  return phase.kind === 'HINT' ? (steps[phase.stepIndex] ?? null) : null;
}

// ── React hook ────────────────────────────────────────────────────────────

export function useTutorialStepMachine(
  steps: TutorialStep[],
  gameState: TutorialGameState,
): StepMachineOutput {
  const [phase, setPhase] = useState<TutorialPhase>({ kind: 'PLAYING', nextStepIndex: 0 });
  const prevGameStateRef = useRef<TutorialGameState>(gameState);

  useEffect(() => {
    setPhase((prev) => applyTrigger(prev, steps, gameState));
  }, [phase, gameState, steps]);

  useEffect(() => {
    const prev = prevGameStateRef.current;
    prevGameStateRef.current = gameState;
    setPhase((prev2) => applyExpectedAction(prev2, steps, gameState, prev));
  }, [gameState, steps]);

  const dismiss = useCallback(() => {
    setPhase((prev) => applyDismiss(prev, steps));
  }, [steps]);

  return { phase, activeStep: activeStepFor(phase, steps), dismiss };
}
