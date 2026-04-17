# Board Reveal Unification Implementation Plan

## Goal

Resolve the crossed-letter resurfacing and green-lock regressions by restoring a
single board authority model shared by the live board and tutorial free-play.

This plan assumes:

- Green is true on the board, including at crossed tiles.
- A shadow row must not independently create a new green truth.
- If a crossed letter is truly green, the board should lock that coordinate as
  green regardless of which word is currently surfaced.
- History may remain richer than the board surface, but it must not become
  authoritative for board repaint.

## Design Principles

### 1. Single Pipeline

There should be one gameplay pipeline for board state.

- Live board and tutorial free-play should consume the same contract.
- Divergence is allowed only for tutorial gating/modal behavior, not for board
  repaint rules.
- Data may differ between board and tutorial, but authority rules should not.

### 2. Board Authority Is Explicit

Board paint should come from one canonical contract produced by the shared
 pipeline.

- `combinedHistoryByTarget` remains informational.
- `boardDisplayGuessByTarget` remains the board-visible per-target guess layer.
- Board green locks should come from shared pipeline outputs, not be rebuilt
  ad hoc from combined history inside screen components.

### 3. Green Truth Is Coordinate Truth

Once a coordinate is truly green, it is locked on the board.

- A green at a crossed tile is true for the board.
- Shadow rows may reflect that truth in history, but they do not create it.
- Hard board locks should represent confirmed coordinate truth, not history
  surface artifacts.

### 4. Reveal Ownership Is Temporary

Reveal ownership exists only during animation.

- During reveal, the revealing word may temporarily own crossed tiles for the
  flip.
- After reveal completes, ownership must return to steady-state rules.
- No stale reveal target may persist and continue winning shared tiles.

### 5. Fewer Fallbacks, More Fail-Fast

The system should prefer one clear source of truth over layered rescue logic.

- If canonical board state is present, render from it.
- Avoid extra fallback overlays for live gameplay paths.
- Prefer failing tests that expose contract drift over keeping old fallback
  behavior alive.

## Target Architecture

The shared pipeline should produce a single board contract with these concepts:

- `nativeHistoryByTarget`
- `shadowHistoryByTarget`
- `combinedHistoryByTarget`
- `boardDisplayGuessByTarget`
- coordinate-level green truth for board locks
- solved-word truth for board locks

Suggested design direction:

1. `rawHistoryByTarget` remains the submitted-history source.
2. The shared pipeline derives native-only display history.
3. The shared pipeline derives informational shadow history.
4. The shared pipeline derives board-visible snapshots from native history.
5. The shared pipeline derives hard board locks from confirmed coordinate truth.
6. `BoardView` consumes only the shared board contract for repaint behavior.

This means `BoardScreen` and tutorial free-play should stop reconstructing board
lock state from `combinedHistoryByTarget`.

## Core Invariants

These invariants should hold after the fix:

1. Shadow rows never repaint the board.
2. Shadow rows never create a new hard lock on the board by themselves.
3. If a coordinate is truly green, the board locks that coordinate green.
4. Resurfacing a word shows that word's native selected row, not a crossing
   word's shadow-derived state.
5. Reveal ownership expires when reveal animation ends.
6. Tutorial free-play and live board produce the same board contract for the
   same raw history and selection state.

## TDD Plan

The implementation should be done test-first.

### Red: Add Failing Tests First

Add regression tests that prove the current system is wrong in the exact ways
we care about.

#### A. Reveal Lifecycle

Add tests proving that reveal ownership is temporary.

- A revealing target owns a crossed tile during animation.
- After reveal ends, that same crossed tile no longer prefers the old reveal
  target.
- A stale reveal target cannot continue suppressing green locks or active-word
  resurfacing.

Likely files:

- `src/lib/boardRevealMap.test.ts`
- `src/lib/boardRevealPipeline.regression.test.ts`
- `src/components/BoardView` behavior tests if present or newly added

#### B. Resurfacing On Crossed Tiles

Add tests proving the last checked native word resurfaces correctly.

- After guessing crossing word B, returning to word A resurfaces A's selected
  native row.
- Shared-tile ownership follows the steady-state rule after reveal completes.
- Crossed tiles do not adopt crossing-word informational history as board truth.

Likely files:

- `src/lib/boardRevealPipeline.regression.test.ts`
- `src/lib/guessDisplayState.test.ts`

#### C. Green Lock Authority

Add tests proving green locks come from confirmed coordinate truth, not shadow
history.

- A true green coordinate remains locked after later nearby guesses.
- A shadow row containing a green reflection does not itself create a new lock.
- Native board lock outputs and board display outputs stay aligned.

Likely files:

- `src/lib/boardHistoryPipeline.test.ts`
- new shared pipeline tests if lock data is added there
- `src/lib/boardRevealPipeline.regression.test.ts`

#### D. Board / Tutorial Parity

Add tests proving tutorial free-play and live board use the same board
authority rules.

- Same raw history + same view state => same board display output.
- Same confirmed coordinate truth => same board lock output.
- Tutorial free-play remains compatible with empty shadow history.

Likely files:

- `src/screens/tutorial/useTutorialGameState.test.ts`
- `src/screens/tutorial/TutorialScreen.reveal.test.ts`

### Yellow: Tighten Invariants During Refactor

Once failing tests exist, add narrower contract tests before broad code edits.

1. Contract tests for the shared board output shape.
2. Tests separating informational history from authoritative board state.
3. Tests confirming reveal-target precedence only applies while reveal is
   active.
4. Tests confirming stable `rowId` selection survives history enrichment.

These tests act as guard rails while implementation changes are in progress.

### Green: Implement Minimal Clean Changes To Satisfy The Contract

Implement the smallest coherent architecture change that makes all Red/Yellow
tests pass.

## Implementation Sequence

### Phase 1. Introduce A Shared Board Contract

Extend the shared board pipeline to expose the full board-facing contract.

Potential additions:

- `confirmedBoardLettersByCoord`
- `boardLockMap` or equivalent coordinate-based green/solved lock output
- reveal-phase inputs that are explicit and bounded

Rules:

- Native board display remains derived from native history only.
- Board hard locks are derived from confirmed coordinate truth.
- Combined history remains a separate informational output.

### Phase 2. Remove Screen-Level Re-Derivation Of Board Locks

Refactor `BoardScreen` so it no longer derives board lock state from
`combinedHistoryByTarget`.

Current risk area:

- `greenLettersByTarget` is rebuilt from `groupedHistoryList`, which is derived
  from `combinedHistoryByTarget`.

Target state:

- `BoardScreen` passes shared board contract outputs directly into `BoardView`.
- No board-lock authority is reconstructed from informational history.

### Phase 3. Make Reveal State Finite

Refactor reveal state so it has a defined end.

Target behavior:

- reveal starts on submit
- reveal target temporarily owns the active flip
- reveal ends after animation duration
- steady-state ownership resumes immediately afterward

Important rule:

- reveal state must not survive indefinitely in screen state
- reveal state must not suppress solved/green locks after the reveal window

### Phase 4. Keep Tile Ownership Rules Simple

Steady-state ownership should be deterministic and narrow.

Recommended steady-state rule:

1. true green coordinate truth
2. active target native display entry
3. deterministic fallback for unresolved shared tiles

Recommended reveal-state rule:

1. true green coordinate truth
2. reveal target during active reveal
3. active target native display entry
4. deterministic fallback

This preserves animation behavior without allowing reveal ownership to become a
long-lived board override.

### Phase 5. Converge Tutorial Free-Play

Refactor tutorial free-play to consume the same shared board contract.

Allowed divergence:

- tutorial step machine
- tutorial modals
- guided restrictions

Not allowed:

- separate board authority rules
- separate green-lock rules
- separate resurfacing behavior

Tutorial should differ only by data shape, such as empty shadow history, not by
board repaint logic.

### Phase 6. Remove Obsolete Fallback Paths

Once shared contract tests pass, remove or narrow fallback behavior that can
reintroduce ambiguity.

Candidates to review:

- legacy overlay fallbacks inside `BoardView`
- any alternate board paint path that activates when canonical board state is
  already present

The goal is not zero fallback everywhere. The goal is zero fallback on the
primary live gameplay path when canonical pipeline outputs exist.

## Files Likely In Scope

Primary implementation files:

- `src/lib/boardHistoryPipeline.ts`
- `src/lib/boardRevealMap.ts`
- `src/components/BoardView.tsx`
- `src/screens/BoardScreen.tsx`
- `src/screens/tutorial/useTutorialGameState.ts`

Primary test files:

- `src/lib/boardHistoryPipeline.test.ts`
- `src/lib/boardRevealPipeline.regression.test.ts`
- `src/lib/boardRevealMap.test.ts`
- `src/lib/guessDisplayState.test.ts`
- `src/screens/tutorial/useTutorialGameState.test.ts`
- `src/screens/tutorial/TutorialScreen.reveal.test.ts`

Secondary review file:

- `src/lib/evidenceFeedback.ts`

`evidenceFeedback.ts` does not currently appear to be the main fault line, but
it should still be protected by regression coverage if the contract around
confirmed green truth changes.

## Non-Goals

This plan is not trying to:

- redesign hint history
- remove shadow history entirely
- fork tutorial gameplay logic from board gameplay logic
- preserve every legacy fallback if it conflicts with a cleaner contract

## Definition Of Done

The work is complete when all of the following are true:

1. The resurfacing regression is covered by tests and fixed.
2. Green coordinates remain locked on the board after reveal.
3. Reveal ownership does not persist beyond the animation window.
4. Shadow rows remain informational only.
5. Tutorial free-play and live board share the same board authority pathway.
6. Board paint no longer depends on screen-level recomputation from combined
   history.

## Recommended First Implementation Slice

Start with the narrowest high-value slice:

1. Add failing reveal lifecycle tests.
2. Add failing green-lock authority tests.
3. Add failing board/tutorial parity tests for board lock outputs.
4. Refactor pipeline to emit shared board lock data.
5. Refactor `BoardScreen` and tutorial free-play to consume that shared output.
6. Remove stale reveal ownership behavior.

This sequence should expose real failures early and force the architecture into
the single-path design rather than letting the fix turn into another layered
patch.
