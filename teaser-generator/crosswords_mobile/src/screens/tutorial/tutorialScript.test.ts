// crosswords_mobile/src/screens/tutorial/tutorialScript.test.ts
import { TUTORIAL_STEPS } from './tutorialScript';
import { TUTORIAL_PREFILLS, TUTORIAL_TARGETS_META } from './tutorialPuzzle';
import type { TutorialGameState } from './types';

const empty: TutorialGameState = {
  guessCountByTarget: { 0: 0, 1: 0, 2: 0 },
  lastGuessByTarget: {},
  activeTargetIndex: 0,
};

const after1stGuess: TutorialGameState = {
  ...empty,
  guessCountByTarget: { 0: 1, 1: 0, 2: 0 },
  lastGuessByTarget: { 0: 'LOCUS' },
};

const afterAlsoGuess: TutorialGameState = {
  ...empty,
  guessCountByTarget: { 0: 1, 1: 0, 2: 1 },
  lastGuessByTarget: { 0: 'LOCUS', 2: 'DIAL' },
};

const afterPatterGuess: TutorialGameState = {
  ...empty,
  guessCountByTarget: { 0: 1, 1: 1, 2: 1 },
  lastGuessByTarget: { 0: 'LOCUS', 2: 'DIAL', 1: 'PATTER' },
};

const afterNonPatterPuddleGuess: TutorialGameState = {
  ...empty,
  guessCountByTarget: { 0: 1, 1: 1, 2: 1 },
  lastGuessByTarget: { 0: 'LOCUS', 2: 'DIAL', 1: 'BATTER' },
};

const stepById = (id: string) => {
  const step = TUTORIAL_STEPS.find((candidate) => candidate.id === id);
  expect(step).toBeDefined();
  return step!;
};

describe('TUTORIAL_STEPS', () => {
  test('has exactly 14 steps', () => {
    expect(TUTORIAL_STEPS).toHaveLength(14);
  });

  test('all steps have unique ids', () => {
    const ids = TUTORIAL_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(14);
  });

  test('welcome trigger always fires on open', () => {
    expect(stepById('welcome').trigger(empty)).toBe(true);
  });

  test('feedback-colors trigger fires after first HOUSE guess', () => {
    expect(stepById('feedback-colors').trigger(empty)).toBe(false);
    expect(stepById('feedback-colors').trigger(after1stGuess)).toBe(true);
  });

  test('ALSO follow-up explanation steps fire after the DIAL guess', () => {
    expect(stepById('color-truth').trigger(after1stGuess)).toBe(false);
    expect(stepById('color-truth').trigger(afterAlsoGuess)).toBe(true);
    expect(stepById('duplicate-letters').trigger(afterAlsoGuess)).toBe(true);
  });

  test('intersection explanation steps fire after the PATTER guess', () => {
    expect(stepById('intersection-colors').trigger(afterAlsoGuess)).toBe(false);
    expect(stepById('intersection-colors').trigger(afterPatterGuess)).toBe(true);
    expect(stepById('intersection-colors-blue').trigger(afterPatterGuess)).toBe(true);
    expect(stepById('intersection-colors-outline').trigger(afterPatterGuess)).toBe(true);
  });

  test('action steps stay action-only', () => {
    expect(stepById('first-guess').hint.isAction).toBe(true);
    expect(stepById('switch-to-basic').hint.isAction).toBe(true);
    expect(stepById('intersection-guess').hint.isAction).toBe(true);
  });

  test('all remaining steps are explanatory', () => {
    [
      'welcome',
      'word-cards',
      'feedback-colors',
      'blue-ticker',
      'keyboard-tracking',
      'color-truth',
      'duplicate-letters',
      'intersection-colors',
      'intersection-colors-blue',
      'intersection-colors-outline',
      'guess-locking',
    ].forEach((id) => {
      expect(stepById(id).hint.isAction).toBe(false);
    });
  });

  test('first-guess expectedAction fires when HOUSE guess count increases', () => {
    const fn = stepById('first-guess').expectedAction!;
    expect(fn(after1stGuess, empty)).toBe(true);
    expect(fn(empty, empty)).toBe(false);
  });

  test('switch-to-basic expectedAction fires when ALSO guess count increases', () => {
    const fn = stepById('switch-to-basic').expectedAction!;
    expect(fn(afterAlsoGuess, after1stGuess)).toBe(true);
    expect(fn(after1stGuess, after1stGuess)).toBe(false);
  });

  test('intersection-guess expectedAction fires only when PATTER is submitted for PUDDLE', () => {
    const fn = stepById('intersection-guess').expectedAction!;
    expect(fn(afterPatterGuess, afterAlsoGuess)).toBe(true);
    expect(fn(afterNonPatterPuddleGuess, afterAlsoGuess)).toBe(false);
    expect(fn(afterAlsoGuess, afterAlsoGuess)).toBe(false);
  });

  test('first-guess has preFill LOCUS for targetIndex 0', () => {
    expect(stepById('first-guess').preFill).toBe('LOCUS');
    expect(stepById('first-guess').preFillTargetIndex).toBe(0);
  });

  test('switch-to-basic has preFill DIAL for targetIndex 2', () => {
    expect(stepById('switch-to-basic').preFill).toBe('DIAL');
    expect(stepById('switch-to-basic').preFillTargetIndex).toBe(2);
  });

  test('intersection-guess has no preFill so PATTER must be typed manually', () => {
    expect(stepById('intersection-guess').preFill).toBeUndefined();
  });

  test('no Y or B code at intersection cells for prefills before intersections are taught', () => {
    const coordCounts = new Map<string, number>();
    for (const meta of TUTORIAL_TARGETS_META) {
      for (const [r, c] of meta.coords) {
        const key = `${r},${c}`;
        coordCounts.set(key, (coordCounts.get(key) ?? 0) + 1);
      }
    }

    const intersectionCoords = new Set<string>();
    for (const [key, count] of coordCounts) {
      if (count > 1) {
        intersectionCoords.add(key);
      }
    }

    for (const targetIdx of [0, 2]) {
      const prefill = TUTORIAL_PREFILLS[targetIdx];
      if (!prefill) continue;
      const meta = TUTORIAL_TARGETS_META.find((candidate) => candidate.target_index === targetIdx);
      expect(meta).toBeDefined();
      for (let i = 0; i < prefill.codes.length; i += 1) {
        const [r, c] = meta!.coords[i];
        const coordKey = `${r},${c}`;
        if (intersectionCoords.has(coordKey)) {
          expect(['G', 'R']).toContain(prefill.codes[i]);
        }
      }
    }
  });
});
