# Task 7: TutorialScreen orchestrator

**Files:**
- Create: `crosswords_mobile/src/screens/tutorial/TutorialScreen.tsx`

This is the most complex file. Read `crosswords_mobile/src/screens/BoardScreen.tsx` before writing to understand how `GameBoardPanel` is mounted (activeTargetIndex, scrollRef, boardRef, etc.), then adapt that pattern.

---

- [ ] **Step 1: Read `GameBoardPanel.tsx` props and `BoardScreen.tsx` usage**

Read both:
- `crosswords_mobile/src/components/GameBoardPanel.tsx` — check `GameBoardPanelProps` for exact prop names, especially `emphasizeKeyboard`, `emphasizeBoard`, and `emphasizedRailTargetIndex`
- `crosswords_mobile/src/screens/BoardScreen.tsx` — understand how the panel is mounted and what state wires into it

- [ ] **Step 2: Write `TutorialScreen.tsx`**

```typescript
// crosswords_mobile/src/screens/tutorial/TutorialScreen.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@src/navigation/AppNavigator';
import GameBoardPanel from '@src/components/GameBoardPanel';
import TutorialOverlay from './TutorialOverlay';
import { useTutorialGameState } from './useTutorialGameState';
import { useTutorialStepMachine } from './useTutorialStepMachine';
import { TUTORIAL_STEPS } from './tutorialScript';
import {
  TUTORIAL_WORDS,
  TUTORIAL_MASKED_SEGMENTS,
  TUTORIAL_TARGETS_META,
  TUTORIAL_REVEALED_COORDS,
  TUTORIAL_PREFILLS,
  getTutorialWordSlots,
} from './tutorialPuzzle';
import type { TutorialGameState } from './types';

type Props = NativeStackScreenProps<RootStackParamList, 'Tutorial'>;

const WORD_SLOTS = getTutorialWordSlots();

export default function TutorialScreen({ navigation }: Props) {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [activeTargetIndex, setActiveTargetIndex] = useState(0);
  const [guessText, setGuessText] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const boardRef = useRef<View>(null);
  const [boardWidth, setBoardWidth] = useState<number | null>(null);

  // ── Game state ─────────────────────────────────────────────────────────────
  const game = useTutorialGameState(WORD_SLOTS, TUTORIAL_WORDS);

  // ── Step machine ───────────────────────────────────────────────────────────
  const tutorialGameState: TutorialGameState = {
    guessCountByTarget: Object.fromEntries(
      Array.from(game.rawHistoryByTarget.entries()).map(([k, v]) => [k, v.length]),
    ),
    activeTargetIndex,
  };
  const { activeStep, dismiss } = useTutorialStepMachine(TUTORIAL_STEPS, tutorialGameState);

  // ── Pre-fill: apply when switching to a word that has a pending pre-fill ───
  useEffect(() => {
    if (activeStep?.preFillTargetIndex === undefined) return;
    if (activeStep.preFillTargetIndex === activeTargetIndex && activeStep.preFill) {
      setGuessText((prev) => (prev === '' ? activeStep.preFill! : prev));
    }
  }, [activeTargetIndex, activeStep]);

  // ── Emphasis props derived from active step ────────────────────────────────
  const emphasizeKeyboard    = activeStep?.highlightTarget === 'submit-button';
  const emphasizeBoard       = activeStep?.highlightTarget === 'intersection-tile';
  const emphasizedRailTarget =
    activeStep?.highlightTarget === 'word-tabs'
      ? (activeStep.highlightTargetIndex ?? null)
      : null;

  // ── Guess submission ───────────────────────────────────────────────────────
  const handleSubmit = useCallback(() => {
    const trimmed = guessText.trim().toUpperCase();
    if (trimmed.length === 0) return;
    const prefillData = TUTORIAL_PREFILLS[activeTargetIndex];
    const codes =
      prefillData && trimmed === prefillData.guess
        ? prefillData.codes
        : computeFallbackCodes(trimmed, TUTORIAL_WORDS[activeTargetIndex] ?? '');
    game.injectScriptedGuess(activeTargetIndex, trimmed, codes);
    setGuessText('');
  }, [guessText, activeTargetIndex, game]);

  // ── Tile press (word switching) ────────────────────────────────────────────
  const handleTilePress = useCallback((targetIndex: number) => {
    setActiveTargetIndex(targetIndex);
    setGuessText('');
  }, []);

  const handleRailPress = useCallback((targetIndex: number) => {
    setActiveTargetIndex(targetIndex);
    setGuessText('');
  }, []);

  // ── History for active word ────────────────────────────────────────────────
  const historyItems = (game.mergedHistoryByTarget.get(activeTargetIndex) ?? []).map(
    (entry, i) => ({
      codes: entry.codes,
      guess: entry.guess,
      isLocked: game.guessViewStateByTarget[activeTargetIndex]?.lockedIndex === i,
    }),
  );

  const wordLength = TUTORIAL_WORDS[activeTargetIndex]?.length ?? 5;
  const greenLetters = game.greenLettersByTarget[activeTargetIndex] ?? {};

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="always"
      >
        <GameBoardPanel
          // Board
          maskedSegments={TUTORIAL_MASKED_SEGMENTS}
          revealedCoords={TUTORIAL_REVEALED_COORDS}
          activeTargetIndex={activeTargetIndex}
          displayGuessByTarget={game.displayGuessByTarget}
          targetsMeta={TUTORIAL_TARGETS_META}
          solvedWordsByTarget={game.solvedWordsByTarget}
          greenLettersByTarget={game.greenLettersByTarget}
          onTilePress={handleTilePress}
          boardRef={boardRef}
          boardWidth={boardWidth}
          onBoardWidthChange={setBoardWidth}
          compact={false}
          windowHeight={windowHeight}
          // Status rail
          blueLetters={game.blueTickerLetters}
          // Word cards
          wordSlots={WORD_SLOTS}
          solvedFlags={game.solvedFlags}
          selectedTargetIndex={activeTargetIndex}
          onRailPress={handleRailPress}
          // Stage
          historyItems={historyItems}
          onHistoryPress={(i) => game.handleHistoryPress(activeTargetIndex, i)}
          onHistoryLongPress={(i) => game.handleHistoryLongPress(activeTargetIndex, i)}
          // Input
          showGuessInput
          guessText={guessText}
          wordLength={wordLength}
          greenLetters={greenLetters}
          // Keyboard
          onKey={(k) => setGuessText((t) => (t.length < wordLength ? t + k : t))}
          onBackspace={() => setGuessText((t) => t.slice(0, -1))}
          onSubmit={handleSubmit}
          letterStates={game.letterStates}
          safeAreaBottom={insets.bottom}
          // Emphasis from active step
          emphasizeKeyboard={emphasizeKeyboard}
          emphasizeBoard={emphasizeBoard}
          emphasizedRailTargetIndex={emphasizedRailTarget}
        />
      </ScrollView>

      {/* Overlay sits above the game, pointerEvents let touches through to game */}
      {activeStep && (
        <TutorialOverlay step={activeStep} onDismiss={dismiss} />
      )}
    </View>
  );
}

/**
 * Fallback scorer for when player overrides the pre-fill.
 * Produces simple G/Y/R codes against the target word (no cross-word B detection).
 * Only scores up to target.length letters; caller should validate length before calling.
 */
function computeFallbackCodes(guess: string, target: string): string[] {
  return Array.from({ length: target.length }, (_, i) => {
    const letter = guess[i] ?? '';
    if (!letter) return 'R';
    if (target[i] === letter) return 'G';
    if (target.includes(letter)) return 'Y';
    return 'R';
  });
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f7f7f7',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    flexGrow: 1,
  },
});
```

- [ ] **Step 3: Run TypeScript check**

```bash
cd crosswords_mobile && npm run typecheck
```

Expected: no errors in `src/screens/tutorial/`

If there are errors, fix imports — check that `@src/navigation/AppNavigator` and `@src/components/GameBoardPanel` match the aliases in `tsconfig.json`. Verify any prop names that don't match by re-reading `GameBoardPanel.tsx`.

- [ ] **Step 4: Commit**

```bash
git add crosswords_mobile/src/screens/tutorial/TutorialScreen.tsx
git commit -m "feat(tutorial): add TutorialScreen orchestrator"
```

- [ ] **Step 5: Mark task complete in index**

Edit `docs/superpowers/plans/2026-03-29-tutorial-redesign/index.md`:

Change:
```
- [ ] [Task 7: TutorialScreen orchestrator](task-07-tutorial-screen.md)
```
To:
```
- [x] [Task 7: TutorialScreen orchestrator](task-07-tutorial-screen.md)
```
