# Tutorial Redesign Spec
**Date:** 2026-03-29
**Scope:** `crosswords_mobile/src/screens/tutorial/` — full replacement of all existing files

---

## Goal

Replace the chapter-based tutorial with a fully playable game that surfaces contextual hints at fixed milestones. The player plays a real (scripted) crossword puzzle from the start; hints appear as overlays triggered by game events, not as gated chapters.

---

## Format

- **Puzzle:** Hardcoded scripted puzzle, same every time
- **Hint triggers:** Fixed schedule — each hint fires when a specific game state condition is met
- **Hint display:** Modal overlay (semi-transparent backdrop, no blur) for explanatory steps; pulse glow for action step targets
- **Dismissal:** Player performs the expected action (auto-dismiss) OR taps corner **×** button (skip)
- **Explanatory steps** also show a **Got it!** primary button alongside the **×**

---

## Step Machine

Three phases:

```
PLAYING  — no hint showing; game runs freely; machine checks next trigger on every state update
HINT     — hint overlay visible; game remains interactive underneath
DONE     — all steps exhausted; pure free play, no more hints
```

```typescript
type TutorialPhase =
  | { kind: 'PLAYING'; nextStepIndex: number }
  | { kind: 'HINT';    stepIndex: number }
  | { kind: 'DONE' }
```

Transition rules:
- `PLAYING` → `HINT`: `tutorialScript[nextStepIndex].trigger(gameState)` returns true
- `HINT` → `PLAYING` (advance): expected action fires, or dismiss button tapped
- `PLAYING` → `DONE`: step index exceeds last step

---

## Step Sequence (11 hint steps)

After step 11 is dismissed the machine transitions to `DONE` (free play, no more hints). "Word 1/2/3" are spec labels — they correspond to actual puzzle words during implementation.

| # | Trigger | Type | Hint summary | Highlight | Pre-fill |
|---|---------|------|-------------|-----------|----------|
| 1 | Tutorial opens | Explanatory | Welcome + board overview | — | — |
| 2 | Step 1 dismissed | Explanatory | Word cards + selecting a word | — | — |
| 3 | Step 2 dismissed | Action | Keyboard intro; "submit when ready" | `submit-button` | Word 1 guess |
| 4 | Word 1 guess submitted | Explanatory | Feedback colors — G/Y/B/R | — | — |
| 5 | Step 4 dismissed | Explanatory | Blue ticker — discovery tracking | — | — |
| 6 | Step 5 dismissed | Explanatory | Keyboard tracking | — | — |
| 7 | Step 6 dismissed | Action | "Use word tabs to switch to Word 3 and submit" | `word-tabs` | Word 3 guess |
| 8 | Word 3 guess submitted | Explanatory | Blue→red: letter confirmed green in Word 3; colors reflect current truth across all words | — | — |
| 9 | Step 8 dismissed | Action | "Tap an intersection tile to switch to the crossing word and submit a guess" | `intersection-tile` | Word 2 guess |
| 10 | Word 2 guess submitted | Explanatory | Intersection colors: yellow = in either word; blue = in puzzle but neither word | — | — |
| 11 | Step 10 dismissed | Explanatory | Guess locking — tap to preview, long-press to lock/unlock history rows | — | — |

---

## Scripted Puzzle Constraints

The tutorial puzzle must be designed to satisfy all pedagogical triggers:

- **Word 1 (1st guess):** The pre-filled guess must produce at least one G, one Y, one B, and one R code — so all four feedback colors are visible in step 4.
- **Word 3 (3rd guess):** The pre-filled guess must contain a letter that:
  - Is **GREEN** (exact position match) in Word 3
  - Was scored **BLUE** in Word 1 or Word 2 (in the puzzle, not in that word)
  - Appears **exactly once** in the entire puzzle — so once confirmed green in Word 3, all its blue tiles across the board collapse to red
- **Word 2 (crossing word, 3rd action step — step 9):** Must have **exactly 2 intersections** with other words. The pre-filled guess for Word 2 must produce:
  - One **yellow** at one intersection (letter is in either crossing word)
  - One **blue** at the other intersection (letter is in the puzzle but neither crossing word)

Note: The step sequence visits words in the order 1 → 3 → 2 (Word 3 is reached via tabs before Word 2 is reached via intersection tap). Puzzle layout must make this natural.

---

## File Structure

```
crosswords_mobile/src/screens/tutorial/
  TutorialScreen.tsx          — orchestrator: mounts board + overlay, wires step
                                machine to game state, provides highlight context
  useTutorialStepMachine.ts   — hook: PLAYING/HINT/DONE state, trigger evaluation,
                                dismiss(), pre-fill exposure
  useTutorialGameState.ts     — hook: full game pipeline
                                (reconciler → merge → ticker)
  tutorialScript.ts           — static TutorialStep[] array (all hint definitions)
  tutorialPuzzle.ts           — hardcoded PuzzleData satisfying all constraints
  TutorialOverlay.tsx         — modal component: backdrop + hint card + buttons
  types.ts                    — TutorialPhase, TutorialStep, shared types
```

---

## Key Types

```typescript
// types.ts

type TutorialPhase =
  | { kind: 'PLAYING'; nextStepIndex: number }
  | { kind: 'HINT';    stepIndex: number }
  | { kind: 'DONE' }

type TutorialStep = {
  id:               string
  trigger:          (state: TutorialGameState) => boolean
  hint:             { title?: string; body: string; isAction: boolean }
  preFill?:         string
  highlightTarget?: 'submit-button' | 'word-tabs' | 'intersection-tile'
  expectedAction?:  (state: TutorialGameState, prev: TutorialGameState) => boolean
}

// TutorialGameState is the type returned by useTutorialGameState — the full
// derived game state including guessHistory, displayGuessByTarget,
// blueTickerEntries, and activeTargetIndex.
```

---

## Overlay Design (`TutorialOverlay`)

- `StyleSheet.absoluteFill`, `backgroundColor: 'rgba(0,0,0,0.55)'`
- Opacity fade-in via `Animated.Value`, **`useNativeDriver: true`**
- Hint card: optional title, body text, action buttons
  - Explanatory (`isAction: false`): **Got it!** primary + corner **×**
  - Action (`isAction: true`): corner **×** only
- Both buttons call `dismiss()`

---

## Pulse Highlight Design

- `TutorialHighlightContext` provides `highlightTarget: string | null`
- Orchestrator sets context from `activeStep.highlightTarget` (clears when step advances)
- Target components (submit button, word tabs, intersection tile) read context; render animated ring when their key matches
- Ring: `absoluteFill` `borderRadius` border, opacity loop `1 → 0.2 → 1`, **`useNativeDriver: true`**
- No layout measurement, no clipping paths — safe for older devices

---

## Navigation

`AppNavigator` already routes `Tutorial` → `TutorialScreen` with optional `{ firstLaunch?: boolean }` param. No changes to `AppNavigator.tsx`.

---

## Testing

- `useTutorialStepMachine` is a pure hook testable with mock game states — verify trigger conditions, advance logic, dismiss, and DONE transition
- `tutorialScript` trigger/expectedAction functions are pure — unit-test each step's trigger against representative game state snapshots
- `tutorialPuzzle` constraints verified manually (G/Y/B/R in Word 1 guess; single-instance blue→green letter; 2-intersection Word 2 with correct crossing codes)
- `TutorialOverlay` and pulse ring are render-only — snapshot or manual verification sufficient
