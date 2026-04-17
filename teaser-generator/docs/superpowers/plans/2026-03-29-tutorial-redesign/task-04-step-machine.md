# Task 4: Step machine hook + tests

**Files:**
- Create: `crosswords_mobile/src/screens/tutorial/useTutorialStepMachine.ts`
- Create: `crosswords_mobile/src/screens/tutorial/useTutorialStepMachine.test.ts`

---

- [ ] **Step 1: Write the failing tests**

```typescript
// crosswords_mobile/src/screens/tutorial/useTutorialStepMachine.test.ts
import { act, renderHook } from '@testing-library/react-hooks';
import { useTutorialStepMachine } from './useTutorialStepMachine';
import type { TutorialGameState, TutorialStep } from './types';

const baseState: TutorialGameState = {
  guessCountByTarget: { 0: 0, 1: 0, 2: 0 },
  activeTargetIndex: 0,
};

const makeStep = (overrides: Partial<TutorialStep> = {}): TutorialStep => ({
  id: 'test',
  trigger: () => true,
  hint: { body: 'Hello', isAction: false },
  ...overrides,
});

describe('useTutorialStepMachine', () => {
  test('fires first step immediately when trigger returns true', () => {
    const steps = [makeStep({ id: 'step0' })];
    const { result } = renderHook(() =>
      useTutorialStepMachine(steps, baseState),
    );
    expect(result.current.phase.kind).toBe('HINT');
    expect((result.current.phase as any).stepIndex).toBe(0);
  });

  test('stays PLAYING when trigger returns false', () => {
    const steps = [makeStep({ trigger: () => false })];
    const { result } = renderHook(() =>
      useTutorialStepMachine(steps, baseState),
    );
    expect(result.current.phase.kind).toBe('PLAYING');
  });

  test('dismiss advances to next step', () => {
    const steps = [
      makeStep({ id: 'step0' }),
      makeStep({ id: 'step1' }),
    ];
    const { result } = renderHook(() =>
      useTutorialStepMachine(steps, baseState),
    );
    act(() => result.current.dismiss());
    expect(result.current.phase.kind).toBe('HINT');
    expect((result.current.phase as any).stepIndex).toBe(1);
  });

  test('dismiss on last step transitions to DONE', () => {
    const steps = [makeStep({ id: 'step0' })];
    const { result } = renderHook(() =>
      useTutorialStepMachine(steps, baseState),
    );
    act(() => result.current.dismiss());
    expect(result.current.phase.kind).toBe('DONE');
  });

  test('expectedAction auto-dismisses while in HINT', () => {
    const steps = [
      makeStep({
        id: 'action',
        hint: { body: 'Submit', isAction: true },
        expectedAction: (s, p) =>
          (s.guessCountByTarget[0] ?? 0) > (p.guessCountByTarget[0] ?? 0),
      }),
      makeStep({ id: 'next' }),
    ];
    const { result, rerender } = renderHook(
      (state: TutorialGameState) => useTutorialStepMachine(steps, state),
      { initialProps: baseState },
    );
    // Simulate a guess being submitted
    rerender({ ...baseState, guessCountByTarget: { 0: 1, 1: 0, 2: 0 } });
    expect(result.current.phase.kind).toBe('HINT');
    expect((result.current.phase as any).stepIndex).toBe(1);
  });

  test('activeStep returns the current hint step', () => {
    const steps = [makeStep({ id: 'step0', hint: { body: 'Learn!', isAction: false } })];
    const { result } = renderHook(() =>
      useTutorialStepMachine(steps, baseState),
    );
    expect(result.current.activeStep?.id).toBe('step0');
    expect(result.current.activeStep?.hint.body).toBe('Learn!');
  });

  test('activeStep is null when PLAYING or DONE', () => {
    const steps = [makeStep({ trigger: () => false })];
    const { result } = renderHook(() =>
      useTutorialStepMachine(steps, baseState),
    );
    expect(result.current.activeStep).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd crosswords_mobile && npm run test -- --testPathPattern=useTutorialStepMachine
```

Expected: FAIL (useTutorialStepMachine not found)

- [ ] **Step 3: Write `useTutorialStepMachine.ts`**

```typescript
// crosswords_mobile/src/screens/tutorial/useTutorialStepMachine.ts
import { useEffect, useRef, useState } from 'react';
import type { TutorialGameState, TutorialPhase, TutorialStep } from './types';

export type StepMachineOutput = {
  phase:      TutorialPhase
  activeStep: TutorialStep | null   // non-null only when phase.kind === 'HINT'
  dismiss:    () => void
}

export function useTutorialStepMachine(
  steps: TutorialStep[],
  gameState: TutorialGameState,
): StepMachineOutput {
  const [phase, setPhase] = useState<TutorialPhase>({ kind: 'PLAYING', nextStepIndex: 0 });
  const prevGameStateRef = useRef<TutorialGameState>(gameState);

  // ── Trigger check (PLAYING → HINT) ────────────────────────────────────────
  useEffect(() => {
    if (phase.kind !== 'PLAYING') return;
    const { nextStepIndex } = phase;
    if (nextStepIndex >= steps.length) {
      setPhase({ kind: 'DONE' });
      return;
    }
    if (steps[nextStepIndex].trigger(gameState)) {
      setPhase({ kind: 'HINT', stepIndex: nextStepIndex });
    }
  }, [phase, gameState, steps]);

  // ── Expected action check (auto-dismiss while HINT) ───────────────────────
  useEffect(() => {
    if (phase.kind !== 'HINT') return;
    const step = steps[phase.stepIndex];
    if (!step?.expectedAction) return;
    const prev = prevGameStateRef.current;
    prevGameStateRef.current = gameState;   // update ref BEFORE advance to avoid stale prev on next render
    if (step.expectedAction(gameState, prev)) {
      advance(phase.stepIndex + 1);
    }
  }, [gameState, phase, steps]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  function advance(nextIndex: number) {
    if (nextIndex >= steps.length) {
      setPhase({ kind: 'DONE' });
    } else {
      setPhase({ kind: 'PLAYING', nextStepIndex: nextIndex });
    }
  }

  const dismiss = () => {
    if (phase.kind !== 'HINT') return;
    advance(phase.stepIndex + 1);
  };

  const activeStep =
    phase.kind === 'HINT' ? (steps[phase.stepIndex] ?? null) : null;

  return { phase, activeStep, dismiss };
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd crosswords_mobile && npm run test -- --testPathPattern=useTutorialStepMachine
```

Expected: all 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add crosswords_mobile/src/screens/tutorial/useTutorialStepMachine.ts crosswords_mobile/src/screens/tutorial/useTutorialStepMachine.test.ts
git commit -m "feat(tutorial): add step machine hook with tests"
```

- [ ] **Step 6: Mark task complete in index**

Edit `docs/superpowers/plans/2026-03-29-tutorial-redesign/index.md`:

Change:
```
- [ ] [Task 4: Step machine hook + tests](task-04-step-machine.md)
```
To:
```
- [x] [Task 4: Step machine hook + tests](task-04-step-machine.md)
```
