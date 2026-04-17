// crosswords_mobile/src/screens/tutorial/useTutorialStepMachine.test.ts
import {
  applyTrigger,
  applyExpectedAction,
  applyDismiss,
  activeStepFor,
} from './useTutorialStepMachine';
import type { TutorialGameState, TutorialPhase, TutorialStep } from './types';

const baseState: TutorialGameState = {
  guessCountByTarget: { 0: 0, 1: 0, 2: 0 },
  lastGuessByTarget: { 0: '', 1: '', 2: '' },
  activeTargetIndex: 0,
};

const makeStep = (overrides: Partial<TutorialStep> = {}): TutorialStep => ({
  id: 'test',
  trigger: () => true,
  hint: { body: 'Hello', isAction: false },
  ...overrides,
});

describe('applyTrigger', () => {
  test('fires first step immediately when trigger returns true', () => {
    const steps = [makeStep({ id: 'step0' })];
    const playing: TutorialPhase = { kind: 'PLAYING', nextStepIndex: 0 };
    const result = applyTrigger(playing, steps, baseState);
    expect(result.kind).toBe('HINT');
    expect((result as any).stepIndex).toBe(0);
  });

  test('stays PLAYING when trigger returns false', () => {
    const steps = [makeStep({ trigger: () => false })];
    const playing: TutorialPhase = { kind: 'PLAYING', nextStepIndex: 0 };
    const result = applyTrigger(playing, steps, baseState);
    expect(result.kind).toBe('PLAYING');
  });

  test('transitions to DONE when nextStepIndex exceeds steps length', () => {
    const steps = [makeStep()];
    const playing: TutorialPhase = { kind: 'PLAYING', nextStepIndex: 5 };
    const result = applyTrigger(playing, steps, baseState);
    expect(result.kind).toBe('DONE');
  });
});

describe('applyDismiss', () => {
  test('dismiss advances to next step', () => {
    const steps = [makeStep({ id: 'step0' }), makeStep({ id: 'step1' })];
    const hint: TutorialPhase = { kind: 'HINT', stepIndex: 0 };
    const afterDismiss = applyDismiss(hint, steps);
    expect(afterDismiss.kind).toBe('PLAYING');
    const result = applyTrigger(afterDismiss, steps, baseState);
    expect(result.kind).toBe('HINT');
    expect((result as any).stepIndex).toBe(1);
  });

  test('dismiss on last step transitions to DONE', () => {
    const steps = [makeStep({ id: 'step0' })];
    const hint: TutorialPhase = { kind: 'HINT', stepIndex: 0 };
    const result = applyDismiss(hint, steps);
    expect(result.kind).toBe('DONE');
  });
});

describe('applyExpectedAction', () => {
  test('auto-dismisses when expectedAction returns true', () => {
    const steps = [
      makeStep({
        id: 'action',
        hint: { body: 'Submit', isAction: true },
        expectedAction: (s, p) =>
          (s.guessCountByTarget[0] ?? 0) > (p.guessCountByTarget[0] ?? 0),
      }),
      makeStep({ id: 'next' }),
    ];
    const hint: TutorialPhase = { kind: 'HINT', stepIndex: 0 };
    const newState = { ...baseState, guessCountByTarget: { 0: 1, 1: 0, 2: 0 } };
    const result = applyExpectedAction(hint, steps, newState, baseState);
    expect(result.kind).toBe('PLAYING');
  });

  test('stays in HINT when expectedAction returns false', () => {
    const steps = [
      makeStep({
        expectedAction: (s, p) =>
          (s.guessCountByTarget[0] ?? 0) > (p.guessCountByTarget[0] ?? 0),
      }),
    ];
    const hint: TutorialPhase = { kind: 'HINT', stepIndex: 0 };
    const result = applyExpectedAction(hint, steps, baseState, baseState);
    expect(result.kind).toBe('HINT');
  });
});

describe('activeStepFor', () => {
  test('returns the current hint step', () => {
    const steps = [makeStep({ id: 'step0', hint: { body: 'Learn!', isAction: false } })];
    const hint: TutorialPhase = { kind: 'HINT', stepIndex: 0 };
    expect(activeStepFor(hint, steps)?.id).toBe('step0');
    expect(activeStepFor(hint, steps)?.hint.body).toBe('Learn!');
  });

  test('returns null when PLAYING or DONE', () => {
    const steps = [makeStep()];
    const playing: TutorialPhase = { kind: 'PLAYING', nextStepIndex: 0 };
    const done: TutorialPhase = { kind: 'DONE' };
    expect(activeStepFor(playing, steps)).toBeNull();
    expect(activeStepFor(done, steps)).toBeNull();
  });
});
