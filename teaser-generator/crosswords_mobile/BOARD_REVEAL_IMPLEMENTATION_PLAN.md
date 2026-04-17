# Board Reveal Implementation Summary

## Goal

Fix the `STRAIN` / `ALTER` shared-tile contamination bug and converge main-board
and post-guided tutorial gameplay onto the same rules.

This document now records the shipped implementation state. See
`BOARD_REVEAL_PIPELINE.md` for the architecture and behavior reference.

## Shipped Invariants

- Board tiles come only from native selected rows.
- Solved greens remain the only hard override.
- Reveal target owns shared tiles during animation.
- Shadow cross-history may exist as informational state, but never repaints the board.
- Tutorial free-play follows the same gameplay rules as the main board once guided restrictions are out of the way.

## Implemented State

### Split History Model

- `rawHistoryByTarget` remains the submitted-history source of truth.
- `nativeHistoryByTarget` is derived from raw history and includes reconciliation plus intersection merge for submitted rows only.
- `shadowHistoryByTarget` contains cross-word compacted rows only.
- `combinedHistoryByTarget` is the informational history/detail surface.
- `boardDisplayGuessByTarget` is the native-only board display surface used to build `tileRevealMap`.

### Stable Selection Model

- History and board selection use stable `rowId` values rather than mutable array indices.
- Native row IDs resolve on both history/detail and board display paths.
- Shadow row IDs resolve only on combined-history/detail surfaces.
- This removes the prior selection drift caused by shadow-row prepends shifting array indices.

### Board Behavior

- Board repaint is resolved from `nativeHistoryByTarget` only.
- Shadow rows never win tile ownership.
- Shadow rows shown in the live board history UI are informational only.
- On the live board history UI, shadow rows are inert:
  - tap does nothing
  - long-press does nothing
- Native history rows remain previewable and lockable.

### Tutorial Behavior

- Tutorial free-play now uses the same split-state contract shape as the live board.
- Tutorial exposes empty `shadowHistoryByTarget`.
- Tutorial board repaint uses `boardDisplayGuessByTarget`.
- Tutorial native rows remain lockable.

### Blue Ticker / History Surfaces

- Blue ticker remains based on combined history.
- History/detail surfaces remain combined-history driven.
- Shadow rows may appear there as informational entries, but they are never authoritative for board repaint.

## What Changed From The Original Plan

- Stable `rowId` selection replaced mutable index-based selection for preview/lock behavior.
- Live board shadow rows ended up stricter than originally discussed:
  - they are still visible as informational entries
  - they are no longer previewable on the live board
  - they are no longer lockable on the live board
- The implementation moved beyond a temporary adapter approach and now treats `boardDisplayGuessByTarget` as the authoritative board path.

## Current Validation

The shipped behavior is covered by current board/tutorial tests, including:

- `src/lib/boardHistoryPipeline.test.ts`
- `src/lib/boardRevealMap.test.ts`
- `src/lib/boardRevealPipeline.regression.test.ts`
- `src/lib/guessDisplayState.test.ts`
- `src/screens/tutorial/useTutorialGameState.test.ts`
- `src/screens/tutorial/TutorialScreen.reveal.test.ts`

These validate, among other things:

- split native/shadow/combined outputs
- native-only board repaint
- stable `rowId`-based selection
- solved-green precedence
- reveal-target precedence
- tutorial free-play parity with the live board contract

## Remaining Follow-Up

No known gameplay-critical follow-up remains in this area. Future changes should
update both this document and `BOARD_REVEAL_PIPELINE.md` if board/history
authority rules change again.
