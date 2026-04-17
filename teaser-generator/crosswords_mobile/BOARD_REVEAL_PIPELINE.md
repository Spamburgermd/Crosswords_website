# Board Reveal Pipeline

## Summary

The live board, word cards, and tutorial free-play now share a canonical
snapshot model.

There are two primary authorities:

- **Canonical word snapshot**: one per target word, containing literal letters,
  merged codes, native history rows, shadow history rows, and the latest native
  row.
- **Canonical board snapshot**: one per coordinate, containing the steady board
  tile plus candidate entries for selected-word and reveal ownership.

This replaced the older layered mix of:

- `literalNativeHistoryByTarget`
- `latestLiteralNativeGuessByTarget`
- `latestNativeGuessByTarget`
- `boardDisplayGuessByTarget`

Those are no longer live pipeline outputs. The live path now flows through
`wordSnapshotsByTarget`, `boardTilesByCoord`, and `cardDisplayState`.

## Current Source Of Truth

### Canonical word snapshot

Defined in
[src/lib/boardHistoryPipeline.ts](src/lib/boardHistoryPipeline.ts:44).

Each `CanonicalWordSnapshot` contains:

- `latestLiteralGuess`
- `latestMergedCodes`
- `confirmedGreensByPosition`
- `nativeHistoryRows`
- `shadowHistoryRows`
- `latestNativeRow`

Built in
[buildBoardSplitHistory(...)](src/lib/boardHistoryPipeline.ts:297) and stored in
`wordSnapshotsByTarget` at
[src/lib/boardHistoryPipeline.ts](src/lib/boardHistoryPipeline.ts:370) and
[src/lib/boardHistoryPipeline.ts](src/lib/boardHistoryPipeline.ts:445).

Contract:

- letters come from the literal submitted row
- codes come from the merged/reconciled row for that same native submission
- native and merged row counts must align
- row length mismatches fail fast

### Canonical board snapshot

Built by
[buildBoardTilesByCoord(...)](src/lib/boardRevealMap.ts:70) and returned from
[buildBoardSplitHistory(...)](src/lib/boardHistoryPipeline.ts:456).

Each `BoardTile` contains:

- `steadyState`
- `candidateEntries`
- `isIntersection`
- `isGreenLocked`

`steadyState` is the resting board truth for that coordinate. `candidateEntries`
are used only to resolve selected-word ownership and reveal animation at render
time.

### Canonical card snapshot

Built by
[buildCardDisplayState(...)](src/lib/cardDisplayState.ts:181).

It returns:

- `selectedNativeGuessByTarget`
- `detailRowsForSelectedTarget`
- `greenPlaceholdersByTarget`
- `diagnostics`

This selector now consumes `wordSnapshotsByTarget` directly rather than
separate native/shadow/combined history products.

## Canonical Flow

### Live board

1. `BoardScreen.tsx` builds `rawHistoryByTarget` and calls
   [buildBoardSplitHistory(...)](src/screens/BoardScreen.tsx:1388).
2. `buildBoardSplitHistory(...)` derives:
   - `wordSnapshotsByTarget`
   - `shadowHistoryByTarget`
   - `combinedHistoryByTarget`
   - `confirmedBoardLettersByCoord`
   - `boardTilesByCoord`
   - `boardDiagnostics`
3. `BoardScreen.tsx` renders `BoardView` directly for live play and passes:
   - `boardTilesByCoord`
   - `boardDiagnostics`
   - `activeTargetIndex`
   - `revealTargetIndex`
   - `revealEpoch`
4. `BoardView.tsx` normalizes board tiles into view coordinates at
   [normalizeBoardTilesByViewCoords(...)](src/components/boardViewHelpers.ts:12)
   and uses that helper from
   [src/components/BoardView.tsx](src/components/BoardView.tsx:905).
5. `BoardView.tsx` builds the render-time reveal map from canonical board tiles
   via [buildTileRevealMapFromBoardTiles(...)](src/components/BoardView.tsx:921).

Important change:

- the Atlantic live board no longer depends on `displayGuessByTarget` as a live
  board paint source
- `buildTileRevealMapFromDisplayGuess(...)` is now only a fallback path for the
  non-Atlantic / legacy renderer path

### Live card / word panel

1. `BoardScreen.tsx` calls
   [buildCardDisplayState(...)](src/screens/BoardScreen.tsx:1452).
2. That selector receives `wordSnapshotsByTarget` from
   [src/screens/BoardScreen.tsx](src/screens/BoardScreen.tsx:1446).
3. `detailHistoryItems` comes from
   `cardDisplayState.detailRowsForSelectedTarget`.
4. `greenLettersForSelected` comes from
   [cardDisplayState.greenPlaceholdersByTarget](src/screens/BoardScreen.tsx:1721).

Card contract:

- selected card row uses native rows only
- detailed card rows are built only for the selected target
- literal letters are preserved
- shadow rows remain visible but informational only
- input row remains blank except for confirmed green placeholders

### Tutorial free-play

Tutorial free-play now mirrors the live board pipeline.

`buildTutorialPipeline(...)` in
[src/screens/tutorial/useTutorialGameState.ts](src/screens/tutorial/useTutorialGameState.ts:43)
now wraps:

- `buildBoardSplitHistory(...)` at
  [src/screens/tutorial/useTutorialGameState.ts](src/screens/tutorial/useTutorialGameState.ts:55)
- `buildCardDisplayState(...)` at
  [src/screens/tutorial/useTutorialGameState.ts](src/screens/tutorial/useTutorialGameState.ts:67)

Tutorial output now returns only canonical products:

- `wordSnapshotsByTarget`
- `combinedHistoryByTarget`
- `confirmedBoardLettersByCoord`
- `boardTilesByCoord`
- `boardDiagnostics`
- `cardDisplayState`
- `groupedHistoryList`
- `blueTickerEntries`
- `solvedFlags`

`TutorialScreen.tsx` consumes:

- `game.boardTilesByCoord` at
  [src/screens/tutorial/TutorialScreen.tsx](src/screens/tutorial/TutorialScreen.tsx:286)
- `game.cardDisplayState.greenPlaceholdersByTarget` at
  [src/screens/tutorial/TutorialScreen.tsx](src/screens/tutorial/TutorialScreen.tsx:116)
- `game.cardDisplayState.detailRowsForSelectedTarget` at
  [src/screens/tutorial/TutorialScreen.tsx](src/screens/tutorial/TutorialScreen.tsx:250)
- `game.wordSnapshotsByTarget` for scripted tutorial state at
  [src/screens/tutorial/TutorialScreen.tsx](src/screens/tutorial/TutorialScreen.tsx:172)

## Board Ownership Rules

### Stable truth

`confirmedBoardLettersByCoord` in
[src/lib/boardHistoryPipeline.ts](src/lib/boardHistoryPipeline.ts:52) remains
the only hard board-lock source.

Rules:

- green-locked coordinates are global
- green coordinates do not depend on selection
- a confirmed green always overrides non-green candidates

### Selected-word ownership

Selected-word ownership is now resolved only at render time from
`candidateEntries` in
[buildTileRevealMapFromBoardTiles(...)](src/lib/boardRevealMap.ts:194).

Rules:

- if the tile is green-locked, green wins
- otherwise the `activeTargetIndex` candidate wins if present
- if a reveal is active, the `revealTargetIndex` candidate wins temporarily
- otherwise `steadyState` wins

This is what makes non-green shared cells follow the currently selected word
without changing steady-state board truth.

### Reveal animation

Reveal animation is presentation-only.

The steady board snapshot does not change during reveal. Reveal simply chooses a
different candidate entry temporarily in
[buildTileRevealMapFromBoardTiles(...)](src/lib/boardRevealMap.ts:205).

The Atlantic renderer now has an explicit settled-vs-reveal rule:

- **reveal tiles** use the committed/pending cross-fade letter layers
- **settled tiles** render the current letter directly and do not reuse the
  committed reveal glyph layer

That behavior is encoded in
[resolveAtlanticTileRenderState(...)](src/components/boardViewHelpers.ts:50)
and consumed by
[AtlanticTileInner](src/components/BoardView.tsx:144).

Practical implication:

- a shared cell can switch between two same-color candidates when selection
  changes
- the newly selected word's letter renders immediately on the settled board
- green reveal flips still animate because reveal tiles keep the cross-fade path

## Word Snapshot Contract

The canonical word snapshot is the main simplification.

Rules:

- `latestLiteralGuess` preserves the submitted guess string
- `latestMergedCodes` preserves the merged/intersection-aware code state for
  that same latest native row
- `nativeHistoryRows` are the authoritative interactive history rows
- `shadowHistoryRows` are informational only
- `latestNativeRow` is the latest native row surfaced to list/card views

Fail-fast conditions in
[buildBoardSplitHistory(...)](src/lib/boardHistoryPipeline.ts:297):

- shadow count cannot exceed final merged rows
- literal/native row counts must match
- guess length and merged code length must match for a native row

## Shadow History Contract

Shadow rows still exist, but they are no longer reusable state sources.

They are built into:

- `shadowHistoryByTarget` at
  [src/lib/boardHistoryPipeline.ts](src/lib/boardHistoryPipeline.ts:368)
- `combinedHistoryByTarget` at
  [src/lib/boardHistoryPipeline.ts](src/lib/boardHistoryPipeline.ts:440)

They are surfaced on cards through
[buildCardDisplayState(...)](src/lib/cardDisplayState.ts:181), which marks rows
as:

- `kind: 'native' | 'shadow'`
- `interactive: boolean`
- `isPreviewed`
- `isLocked`

`GameBoardPanel.tsx` now disables interaction on informational rows and labels
them `INFO` at
[src/components/GameBoardPanel.tsx](src/components/GameBoardPanel.tsx:460) and
[src/components/GameBoardPanel.tsx](src/components/GameBoardPanel.tsx:491).

Practical implication:

- shadow rows may appear on the word card
- shadow rows may never repaint the board
- shadow rows may never become selected or locked
- shadow rows may never prefill the input row

## Renderer Contract

### BoardView

`BoardView.tsx` now treats `boardTilesByCoord` as the live Atlantic board input.

Relevant references:

- prop definition at
  [src/components/BoardView.tsx](src/components/BoardView.tsx:68)
- coordinate normalization helper at
  [src/components/boardViewHelpers.ts](src/components/boardViewHelpers.ts:12)
- helper use in `BoardView` at
  [src/components/BoardView.tsx](src/components/BoardView.tsx:905)
- reveal-map construction at
  [src/components/BoardView.tsx](src/components/BoardView.tsx:921)
- settled-vs-reveal tile render helper at
  [src/components/boardViewHelpers.ts](src/components/boardViewHelpers.ts:50)

If `boardDiagnostics` is present in Atlantic mode, `BoardView` can surface a
minimal explicit board error state rather than silently falling back.

Renderer contract:

- normalized board tiles must preserve the canonical tile at the corresponding
  original coordinate
- Atlantic mode must not consult `displayGuessByTarget` when canonical
  `boardTilesByCoord` are present
- settled tiles must not cross-fade from a stale committed glyph
- reveal tiles still animate through the midpoint color/letter swap
- green shared tiles may animate during reveal but settle to global green truth

### GameBoardPanel

`GameBoardPanel.tsx` is still board-snapshot oriented, but it is currently the
shared tutorial/shared-layout path rather than the direct live board handoff.

Relevant references:

- prop definition at
  [src/components/GameBoardPanel.tsx](src/components/GameBoardPanel.tsx:86)
- `BoardView` handoff at
  [src/components/GameBoardPanel.tsx](src/components/GameBoardPanel.tsx:318)

Removed from the Atlantic board-snapshot contract:

- `displayGuessByTarget`
- per-target solved/green board paint props

The panel still handles history-row interaction and informational shadow-row
rendering, and `TutorialScreen.tsx` currently uses it for the tutorial board
layout.

## Failure Model

### Board invariants

Board invariants still live in:

- [shouldFailFastForBoardInvariant()](src/lib/boardRevealMap.ts:33)
- [reportBoardInvariant(...)](src/lib/boardRevealMap.ts:37)

Behavior:

- test/dev: throw on impossible board state
- production: append diagnostics to `boardDiagnostics`

### Card invariants

Card invariants still live in
[buildCardDisplayState(...)](src/lib/cardDisplayState.ts:181).

Behavior:

- preview/lock cannot target shadow rows
- strict mode throws
- non-strict mode records diagnostics and falls back to native-only selection

## Tests

The current implementation is covered by canonical snapshot and parity tests.

### Canonical word snapshot tests

- [src/lib/boardHistoryPipeline.test.ts](src/lib/boardHistoryPipeline.test.ts:84)
  covers literal letters plus merged codes in `wordSnapshotsByTarget`
- [src/lib/boardHistoryPipeline.test.ts](src/lib/boardHistoryPipeline.test.ts:124)
  covers native/shadow separation
- [src/lib/boardHistoryPipeline.test.ts](src/lib/boardHistoryPipeline.test.ts:145)
  covers parity with legacy combined history

### Canonical board snapshot tests

- [src/lib/boardRevealMap.test.ts](src/lib/boardRevealMap.test.ts:805)
  covers `buildBoardTilesByCoord(...)`
- [src/lib/boardRevealMap.test.ts](src/lib/boardRevealMap.test.ts:864)
  covers selected-word ownership switching
- [src/lib/boardRevealMap.test.ts](src/lib/boardRevealMap.test.ts:905)
  covers green-locked shared-cell stability
- [src/lib/boardRevealMap.test.ts](src/lib/boardRevealMap.test.ts:923)
  covers the logged `targetIndex 4` across / `targetIndex 1` down shared-cell
  ownership fixture at coord `5:4`
- [src/lib/boardRevealMap.test.ts](src/lib/boardRevealMap.test.ts:974)
  covers a newly-green shared cell staying green while still animating for the
  submitted target
- [src/lib/boardRevealPipeline.regression.test.ts](src/lib/boardRevealPipeline.regression.test.ts:76)
  covers canonical board repaint behavior end-to-end

### BoardView renderer seam tests

- [src/components/boardViewHelpers.test.ts](src/components/boardViewHelpers.test.ts:10)
  covers normalized board-tile transport from canonical coords into view coords
- [src/components/boardViewHelpers.test.ts](src/components/boardViewHelpers.test.ts:65)
  covers settled-vs-reveal tile render mode selection

### Card-state tests

- [src/lib/cardDisplayState.test.ts](src/lib/cardDisplayState.test.ts:73)
  covers shadow rows remaining non-authoritative
- [src/lib/cardDisplayState.test.ts](src/lib/cardDisplayState.test.ts:156)
  covers latest literal guess resurfacing without borrowing crossing letters
- [src/lib/cardDisplayState.test.ts](src/lib/cardDisplayState.test.ts:205)
  covers strict failure on shadow-row view-state references

### Tutorial parity tests

- [src/screens/tutorial/useTutorialGameState.test.ts](src/screens/tutorial/useTutorialGameState.test.ts:154)
  covers tutorial/live canonical word snapshot parity
- [src/screens/tutorial/useTutorialGameState.test.ts](src/screens/tutorial/useTutorialGameState.test.ts:193)
  covers tutorial/live canonical board snapshot parity
- [src/screens/tutorial/useTutorialGameState.test.ts](src/screens/tutorial/useTutorialGameState.test.ts:229)
  covers tutorial/live card display state parity
- [src/screens/tutorial/TutorialScreen.reveal.test.ts](src/screens/tutorial/TutorialScreen.reveal.test.ts:18)
  covers tutorial reveal helpers against canonical tutorial pipeline outputs

## QA Checks

Use these when validating future changes:

1. The live Atlantic board paints from `boardTilesByCoord`, not from a guess fallback.
2. A non-green shared cell follows the currently selected word.
3. Green-locked cells override selection changes.
4. Reveal temporarily overrides ownership without mutating steady-state truth.
5. Cards surface native literal letters with merged codes for the same row.
6. Shadow rows remain visible but non-clickable and non-lockable.
7. Input rows remain blank except for confirmed green placeholders.
8. Tutorial free-play and live board return the same canonical word snapshots.
9. Tutorial free-play and live board return the same canonical board snapshot.
10. Tutorial free-play and live board return the same card display state.
11. Shared-cell selection changes must update the board letter even when the two
    candidates have the same non-green color code.
12. Newly-green shared cells must animate during reveal and settle to green.

## Files To Check First

- `src/lib/boardHistoryPipeline.ts`
- `src/lib/boardRevealMap.ts`
- `src/lib/cardDisplayState.ts`
- `src/components/BoardView.tsx`
- `src/screens/BoardScreen.tsx`
- `src/screens/tutorial/useTutorialGameState.ts`
- `src/components/GameBoardPanel.tsx` for tutorial/shared layout parity
