/**
 * src/screens/TutorialScreen.tsx
 * ------------------------------------------------------------
 * Demonstration-only tutorial that walks the player through two
 * guided guesses on a fixed-seed board. Explains feedback colors
 * (green/yellow/blue/red), word switching, guess locking, and the
 * alphabet tracker via CoachMark overlays. Ends with swipeable
 * mode cards before sending the player to the lobby.
 *
 * Layout mirrors BoardScreen's Atlantic design: board frame with
 * L-bracket corners, vertical word-card rail + stage panel, and
 * letter-box guess input.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import type { RootStackParamList } from '@src/navigation/AppNavigator';
import useUIStore from '@stores/uiStore';
import { DESIGN_TOKEN_SETS } from '@src/theme/designTokens';
import colors from '@src/theme/colors';
import { useFeedbackColors } from '@src/theme/feedbackColors';
import { useTilePalette } from '@src/theme/tilePalette';
import { buildKeyboardLetterStates } from '@src/lib/keyboardLetterStates';
import CoachMark, { type TargetRect } from '@components/CoachMark';
import GameBoardPanel, { RAIL_FULL_H, type CodeEntry } from '@components/GameBoardPanel';
import GameKeyboard from '@components/GameKeyboard';
import { buildLocalPlacement } from '@src/lib/localPlacement';
import { initGameFromChallenge, applyGuess } from '@src/gameEngine/state';
import type { GameState } from '@src/gameEngine/types';
import { buildCanonicalWordSlots, type CanonicalWordSlot } from '@src/utils/wordSlots';
import { isValidGuessWord } from '@src/dictionary/dictionaryAdapter';
import { recordTutorialResult } from '@src/localChallenge/localChallengeStore';
import {
  clearGuessView,
  getDetailHistory,
  lockGuess,
  previewGuess,
  resolveDisplayGuessByTarget,
  type GuessHistoryByTarget,
  type GuessViewStateByTarget,
} from '@src/lib/guessDisplayState';
import { buildIntersectionPositionsByTarget } from '@src/lib/boardRevealMap';

const tAtlantic = DESIGN_TOKEN_SETS.atlantic;
const MOTIF_RED = '#E7131A';
const MOTIF_BLUE = colors.blue ?? '#2F6FED';
const TUTORIAL_DICTIONARY = 'standard' as const;

// Hardcoded tutorial words — common, recognizable words in the 4,4,5,5,6 pattern.
const TUTORIAL_WORDS = ['BOLT', 'SAND', 'TRAIL', 'STONE', 'MASTER'];


type TutorialNav = NativeStackNavigationProp<RootStackParamList, 'Tutorial'>;
type TutorialRoute = RouteProp<RootStackParamList, 'Tutorial'>;

// ─── Step definitions ────────────────────────────────────────

type TutorialStep =
  | 'welcome'
  | 'board_overview'       // Step 1/6
  | 'word_cards'           // Step 2/6 — wait for user to tap badge #3
  | 'guided_guess_1'       // Auto-fill PLANT for TRAIL, user hits enter
  | 'explain_feedback'     // Step 3/6 — merged green/yellow/red/blue
  | 'word_switching'       // Step 4/6 — wait for user to tap badge #1
  | 'type_slap'            // Step 5/6 — coach mark: "Type MELT"
  | 'guided_guess_2'       // User types MELT (no coach mark)
  | 'guess_locking'        // Step 6/6 — interactive lock + unlock
  | 'free_play';

type GuessEntry = { targetIndex: number; guess: string; codes: string[] };

/** Normalize engine codes ('green'→'G') to match BoardView expectations. */
function normalizeCodes(codes: string[]): string[] {
  return codes.map((c) => (c ? c[0]?.toUpperCase() : '') || '');
}


// ─── Main component ──────────────────────────────────────────

export default function TutorialScreen(): React.JSX.Element {
  const navigation = useNavigation<TutorialNav>();
  const route = useRoute<TutorialRoute>();
  const isFirstLaunch = route.params?.firstLaunch === true;

  const darkMode = useUIStore((s) => s.darkModeEnabled);
  const setHasCompletedTutorial = useUIStore((s) => s.setHasCompletedTutorial);
  const { width: screenWidth, height: windowHeight } = useWindowDimensions();
  // CoachMark adds insets.top to all targetRect y values (to align measureInWindow
  // coords with the absoluteFill overlay). For hardcoded rects (like the alphabet tab)
  // we subtract it here so the addition cancels out and the position is correct.
  const { top: safeAreaTop, bottom: safeAreaBottom } = useSafeAreaInsets();

  const feedbackColors = useFeedbackColors();
  const tilePalette = useTilePalette();

  // ─── Colors (matching BoardScreen's dark mode) ───────────
  const bg = darkMode ? '#121212' : tAtlantic.colors.screenBackground;
  const cardBg = darkMode ? '#1b1b1b' : '#fff';
  const border = darkMode ? '#2d2d2d' : '#e2e2e2';
  const titleColor = darkMode ? '#f2f2f2' : '#000';
  const bodyColor = darkMode ? '#d1d1d1' : '#444';
  const mutedColor = darkMode ? '#b0b0b0' : '#555';
  const darkCard = darkMode ? { backgroundColor: '#1b1b1b', borderColor: '#2d2d2d' } : null;
  const darkText = darkMode ? { color: '#f2f2f2' } : null;
  const darkDivider = darkMode ? { borderColor: '#303030' } : null;
  const darkInputBox = darkMode ? { backgroundColor: '#202020', borderColor: '#3a3a3a' } : null;

  // ─── Board setup (fixed seed, ephemeral state) ───────────
  const { placement, tutorialTargets } = useMemo(() => {
    const p = buildLocalPlacement(TUTORIAL_WORDS);
    return { placement: p, tutorialTargets: TUTORIAL_WORDS };
  }, []);

  const initialGameState = useMemo(() => {
    if (!placement.ok) return null;
    return initGameFromChallenge({
      v: 1,
      words: placement.words,
      rules: { smartBlue: true },
      createdAtMs: Date.now(),
    });
  }, [placement]);

  const [gameState, setGameState] = useState<GameState | null>(initialGameState);
  const [currentStep, setCurrentStep] = useState<TutorialStep>('welcome');
  const [activeTargetIndex, setActiveTargetIndex] = useState<number>(0);
  const [guessText, setGuessText] = useState('');
  const [guessError, setGuessError] = useState<string | null>(null);
  const [boardWidth, setBoardWidth] = useState<number | null>(null);
  const [guessViewStateByTarget, setGuessViewStateByTarget] = useState<GuessViewStateByTarget>({});
  const [hasLocked, setHasLocked] = useState(false);
  const [freePlayDismissed, setFreePlayDismissed] = useState(false);
  const [showTutorialWinModal, setShowTutorialWinModal] = useState(false);
  const stageScrollRef = useRef<ScrollView>(null);
  const tutorialStartMsRef = useRef<number>(Date.now());
  const tutorialResultRecordedRef = useRef(false);

  // Guess history per target
  const [guessHistory, setGuessHistory] = useState<GuessEntry[]>([]);

  // ─── Layout measurement refs for CoachMark targeting ─────
  const [boardRect, setBoardRect] = useState<TargetRect | null>(null);
  const [railRect, setRailRect] = useState<TargetRect | null>(null);
  const [coilGuessRect, setCoilGuessRect] = useState<TargetRect | null>(null);
  const [letterInputRect, setLetterInputRect] = useState<TargetRect | null>(null);
  const boardRef = useRef<View>(null);
  const railRef = useRef<View>(null);
  const coilGuessRef = useRef<View>(null);
  const letterInputRef = useRef<View>(null);


  // RAIL_FULL_H imported from GameBoardPanel — keeps badge measurement in sync.

  const measureRef = useCallback(
    (ref: React.RefObject<View | null>, setter: (r: TargetRect) => void) => {
      if (ref.current) {
        ref.current.measureInWindow((x, y, width, height) => {
          if (width > 0 && height > 0) setter({ x, y, width, height });
        });
      }
    },
    [],
  );

  // Rail measurement: use measureInWindow only for x/y/width (always correct).
  // Height is hardcoded from known badge layout so Android parent-clipping can't
  // shorten it.
  const measureBadgeRange = useCallback(() => {
    const PAD = 8;
    railRef.current?.measureInWindow((x, y, width) => {
      if (width > 0) {
        setRailRect({
          x: x - PAD,
          y: y - PAD,
          width: width + PAD * 2,
          height: RAIL_FULL_H + PAD * 2,
        });
      }
    });
  }, []);

  // Initial measurement pass after mount
  useEffect(() => {
    const timer = setTimeout(() => {
      measureRef(boardRef, setBoardRect);
      measureBadgeRange();
    }, 500);
    return () => clearTimeout(timer);
  }, [measureRef, measureBadgeRange]);

  // Re-measure board after BoardView computes its full height from boardWidth
  useEffect(() => {
    if (boardWidth == null) return;
    const timer = setTimeout(() => measureRef(boardRef, setBoardRect), 300);
    return () => clearTimeout(timer);
  }, [boardWidth, measureRef]);

  // Re-measure badge range when entering steps that highlight the rail
  useEffect(() => {
    if (currentStep !== 'word_cards' && currentStep !== 'word_switching') return;
    const timer = setTimeout(() => measureBadgeRange(), 100);
    return () => clearTimeout(timer);
  }, [currentStep, measureBadgeRange]);

  // Measure the first guess row on steps that highlight it
  useEffect(() => {
    if (
      currentStep !== 'guided_guess_1' &&
      currentStep !== 'explain_feedback' &&
      currentStep !== 'guess_locking' &&
      currentStep !== 'type_slap'
    ) return;
    const timer = setTimeout(() => {
      measureRef(coilGuessRef, setCoilGuessRect);
      measureRef(letterInputRef, setLetterInputRect);
    }, currentStep === 'guess_locking' ? 350 : 150);
    return () => clearTimeout(timer);
  }, [currentStep, measureRef]);

  // ─── Interactive step watchers ─────────────────────────────
  // Step 2/8: word_cards → wait for user to tap the TRAIL word (targetIndex 2)
  const trailTargetIndex = 2; // TRAIL in TUTORIAL_WORDS
  const boltTargetIndex = 0;  // BOLT in TUTORIAL_WORDS
  useEffect(() => {
    if (currentStep === 'word_cards' && activeTargetIndex === trailTargetIndex) {
      setCurrentStep('guided_guess_1');
    }
  }, [currentStep, activeTargetIndex]);

  // Step 4/8: word_switching → wait for user to tap the BOLT word (targetIndex 0)
  useEffect(() => {
    if (currentStep === 'word_switching' && activeTargetIndex === boltTargetIndex) {
      setCurrentStep('type_slap');
    }
  }, [currentStep, activeTargetIndex]);

// ─── Board data from placement ───────────────────────────
  const maskedSegments = useMemo(
    () => (placement.ok ? placement.opponent_masked : []),
    [placement],
  );
  const targetsMeta = useMemo(
    () => (placement.ok ? placement.targets_meta : []),
    [placement],
  );
  const revealedCoords = useMemo(
    () => (placement.ok ? placement.revealed_coords : []),
    [placement],
  );
  const wordSlots = useMemo<CanonicalWordSlot[]>(
    () => buildCanonicalWordSlots(maskedSegments, targetsMeta),
    [maskedSegments, targetsMeta],
  );
  const intersectionPositionsByTarget = useMemo(
    () => buildIntersectionPositionsByTarget(wordSlots),
    [wordSlots],
  );

  // Display labels for scripted targets (targetIndex → displayIndex on rail)
  const trailSlot = wordSlots.find((s) => s.targetIndex === 2);
  const boltSlot = wordSlots.find((s) => s.targetIndex === 0);
  const trailDisplayIndex = trailSlot?.displayIndex ?? 3;
  const boltDisplayIndex = boltSlot?.displayIndex ?? 1;

  // Active word length — needed by hooks below, so computed before the guard.
  const activeSlot = wordSlots.find((s) => s.targetIndex === activeTargetIndex);
  const activeWordLength = activeSlot?.length ?? tutorialTargets[activeTargetIndex]?.length ?? 0;

  // ─── Derived guess data for current word ─────────────────
  // ─── Scripted guesses (hardcoded valid dictionary words) ──
  // Targets: BOLT, SAND, TRAIL, STONE, MASTER
  // PLANT vs TRAIL → R Y G B Y  (all 4 colors in one guess!)
  //   P=red, L=yellow, A=green, N=blue (in SAND/STONE), T=yellow
  // MELT vs BOLT → B B G G  (user types this one)
  //   M=blue (MASTER), E=blue (STONE/MASTER), L=green, T=green
  const scriptedGuess1 = 'PLANT'; // against target 2 (TRAIL)
  const scriptedGuess2 = 'MELT';  // against target 0 (BOLT) — user types

  // ─── Guess submission ────────────────────────────────────
  const handleSubmitGuess = useCallback(() => {
    if (!gameState) return;
    const word = guessText.trim().toUpperCase();
    if (word.length === 0) return;

    const expectedLen = tutorialTargets[activeTargetIndex]?.length ?? 0;
    if (word.length !== expectedLen) {
      setGuessError(`Must be exactly ${expectedLen} letters.`);
      setGuessText('');
      return;
    }

    if (!isValidGuessWord(word, TUTORIAL_DICTIONARY)) {
      setGuessError(`"${word}" is not in the dictionary.`);
      setGuessText('');
      return;
    }

    setGuessError(null);
    const { nextState, result } = applyGuess(gameState, activeTargetIndex, word);
    const normalizedResult = normalizeCodes(result.codes);
    setGameState(nextState);
    setGuessHistory((prev) => [
      ...prev,
      { targetIndex: activeTargetIndex, guess: word, codes: normalizedResult },
    ]);
    setGuessViewStateByTarget((prev) => clearGuessView(prev, activeTargetIndex));
    setGuessText('');

    if (currentStep === 'guided_guess_1') {
      setCurrentStep('explain_feedback');
    } else if (currentStep === 'guided_guess_2') {
      // Add extra scripted guesses on BOLT so lock/unlock has multiple rows
      let gs = nextState;
      const extraGuesses = ['COLD', 'GOLD'];
      const extraEntries: GuessEntry[] = [];
      for (const extra of extraGuesses) {
        const r = applyGuess(gs, 0, extra);
        gs = r.nextState;
        extraEntries.push({
          targetIndex: 0,
          guess: extra,
          codes: normalizeCodes(r.result.codes),
        });
      }
      setGameState(gs);
      setGuessHistory((prev) => [...prev, ...extraEntries]);
      setCurrentStep('guess_locking');
    }
  }, [gameState, guessText, activeTargetIndex, tutorialTargets, currentStep]);

  const handleKeyPress = useCallback((letter: string) => {
    setGuessText((prev) => {
      if (prev.length >= activeWordLength) return prev;
      return prev + letter;
    });
  }, [activeWordLength]);

  const handleKeyBackspace = useCallback(() => {
    setGuessText((prev) => prev.slice(0, -1));
  }, []);

  const handleHistoryPress = useCallback((gIdx: number) => {
    setGuessViewStateByTarget((prev) => previewGuess(prev, activeTargetIndex, gIdx));
  }, [activeTargetIndex]);

  const handleHistoryLongPress = useCallback((gIdx: number) => {
    setGuessViewStateByTarget((prev) => {
      const isLocked = prev[activeTargetIndex]?.lockedIndex === gIdx;
      if (isLocked) {
        return clearGuessView(prev, activeTargetIndex);
      }
      return lockGuess(prev, activeTargetIndex, gIdx);
    });
    if (currentStep === 'guess_locking') setHasLocked(true);
  }, [activeTargetIndex, currentStep]);

  // ─── Skip / complete handlers ────────────────────────────
  const handleSkip = useCallback(() => {
    setHasCompletedTutorial(true);
    if (isFirstLaunch) {
      navigation.replace('Lobby');
    } else {
      navigation.goBack();
    }
  }, [isFirstLaunch, navigation, setHasCompletedTutorial]);

  const handleFinishTutorial = useCallback(() => {
    setHasCompletedTutorial(true);
    if (isFirstLaunch) {
      navigation.replace('Lobby');
    } else {
      navigation.goBack();
    }
  }, [isFirstLaunch, navigation, setHasCompletedTutorial]);

  const handleWinGoToLobby = useCallback(() => {
    setHasCompletedTutorial(true);
    if (isFirstLaunch) { navigation.replace('Lobby'); }
    else { navigation.navigate('Lobby'); }
  }, [isFirstLaunch, navigation, setHasCompletedTutorial]);

  const handleWinGoToStats = useCallback(() => {
    setHasCompletedTutorial(true);
    if (isFirstLaunch) { navigation.replace('Stats'); }
    else { navigation.navigate('Stats'); }
  }, [isFirstLaunch, navigation, setHasCompletedTutorial]);

  const handleWinGoToGameModes = useCallback(() => {
    setHasCompletedTutorial(true);
    if (isFirstLaunch) { navigation.replace('GameModes'); }
    else { navigation.navigate('GameModes'); }
  }, [isFirstLaunch, navigation, setHasCompletedTutorial]);

  // ─── Solved words map for BoardView ──────────────────────
  // ─── Green letters map ───────────────────────────────────
  const greenLettersByTarget = useMemo(() => {
    const result: Record<number, Record<number, string>> = {};
    for (const entry of guessHistory) {
      const { targetIndex, guess, codes } = entry;
      if (!result[targetIndex]) result[targetIndex] = {};
      codes.forEach((code, i) => {
        if (code === 'G') {
          result[targetIndex][i] = guess[i];
        }
      });
    }
    return result;
  }, [guessHistory]);

  // Cross-word green letter hints — mirrors BoardScreen's greenLettersForSelected.
  // Maps confirmed green letters from ALL words (by grid coordinate) so that
  // intersecting solved letters show as dimmed placeholders in the active word's input.
  const greenLettersForActive = useMemo<Record<number, string>>(() => {
    const coordToLetter = new Map<string, string>();
    for (const [targetIdxStr, posMap] of Object.entries(greenLettersByTarget)) {
      const slot = wordSlots.find((s) => s.targetIndex === Number(targetIdxStr));
      if (!slot) continue;
      for (const [posStr, letter] of Object.entries(posMap)) {
        const pos = Number(posStr);
        if (pos >= 0 && pos < slot.coords.length) {
          const [row, col] = slot.coords[pos];
          coordToLetter.set(`${row}:${col}`, letter);
        }
      }
    }
    const activeSlotFull = wordSlots.find((s) => s.targetIndex === activeTargetIndex);
    if (!activeSlotFull) return {};
    const result: Record<number, string> = {};
    activeSlotFull.coords.forEach(([row, col], i) => {
      const letter = coordToLetter.get(`${row}:${col}`);
      if (letter) result[i] = letter;
    });
    return result;
  }, [greenLettersByTarget, activeTargetIndex, wordSlots]);

  // ─── Last guess overlays for all words ───────────────────
  // Keep active word included — BoardView allows blue (B) overlays on active
  // segments so cross-word hints stay visible (matching BoardScreen behaviour).
  const historyByTarget = useMemo<GuessHistoryByTarget>(() => {
    const map: GuessHistoryByTarget = new Map();
    for (const entry of guessHistory) {
      const existing = map.get(entry.targetIndex) ?? [];
      map.set(entry.targetIndex, [...existing, { guess: entry.guess, codes: entry.codes }]);
    }
    return map;
  }, [guessHistory]);

  const tutorialBlueLetters = useMemo(() => {
    if (!gameState) return [];

    // Step 1: letters that were ever discovered via a 'B' code.
    const discoveredBlueLetters = new Set<string>();
    for (const entry of guessHistory) {
      entry.guess.split('').forEach((letter, i) => {
        if (entry.codes[i] === 'B') discoveredBlueLetters.add(letter);
      });
    }
    if (discoveredBlueLetters.size === 0) return [];

    // Step 2: for each *unsolved* target word, count letters still unconfirmed
    // (mirrors BoardScreen's blueTickerEntries logic).
    const remainingByLetter: Record<string, number> = {};
    gameState.targetWords.forEach((rawWord, targetIndex) => {
      if (gameState.solvedByTarget[targetIndex]) return; // solved → no longer contributes

      const word = String(rawWord).toUpperCase().replace(/[^A-Z]/g, '');
      if (!word) return;

      // Total letter inventory for this target.
      const totalCount: Record<string, number> = {};
      for (const ch of word) totalCount[ch] = (totalCount[ch] ?? 0) + 1;

      // Confirmed (G/Y) occurrences from guesses on this target.
      const confirmedByTarget: Record<string, number> = {};
      for (const entry of guessHistory.filter((e) => e.targetIndex === targetIndex)) {
        const entryConfirmed: Record<string, number> = {};
        entry.guess.split('').forEach((letter, i) => {
          const code = entry.codes[i];
          if (code === 'G' || code === 'Y') entryConfirmed[letter] = (entryConfirmed[letter] ?? 0) + 1;
        });
        for (const [letter, count] of Object.entries(entryConfirmed)) {
          confirmedByTarget[letter] = Math.max(confirmedByTarget[letter] ?? 0, count);
        }
      }

      // Remaining unresolved letters for this target.
      for (const [letter, total] of Object.entries(totalCount)) {
        const remaining = Math.max(0, total - (confirmedByTarget[letter] ?? 0));
        if (remaining > 0) remainingByLetter[letter] = (remainingByLetter[letter] ?? 0) + remaining;
      }
    });

    // Step 3: only show letters that were discovered blue AND still unresolved.
    return Object.keys(remainingByLetter)
      .filter((letter) => discoveredBlueLetters.has(letter))
      .sort();
  }, [gameState, guessHistory]);

  // ─── Alphabet letter states ──────────────────────────────
  const letterStates = useMemo(() => {
    return buildKeyboardLetterStates(gameState?.targetWords ?? null, guessHistory);
  }, [gameState?.targetWords, guessHistory]);

  // ─── Solved flags ────────────────────────────────────────
  const solvedFlags = gameState?.solvedByTarget ?? [];

  // Auto-show win modal and record stats when all 5 words are solved during free_play
  useEffect(() => {
    if (
      currentStep === 'free_play' &&
      solvedFlags.length > 0 &&
      solvedFlags.every(Boolean) &&
      gameState
    ) {
      setShowTutorialWinModal(true);
      if (!tutorialResultRecordedRef.current) {
        tutorialResultRecordedRef.current = true;
        const totalGuesses = gameState.guessesByTarget.reduce((sum, g) => sum + (g?.length ?? 0), 0);
        const solveTimeMs = Date.now() - tutorialStartMsRef.current;
        // Convert guessHistory to per-target arrays matching StoredResult shape
        const guessesByTarget: Array<Array<{ guess: string; codes: string[] }>> =
          gameState.targetWords.map((_, tIdx) =>
            guessHistory
              .filter((e) => e.targetIndex === tIdx)
              .map((e) => ({ guess: e.guess, codes: e.codes })),
          );
        recordTutorialResult({ totalGuesses, solveTimeMs, guessesByTarget });
      }
    }
  }, [currentStep, solvedFlags, gameState, guessHistory]);

  // Auto-fill guess for guided steps
  useEffect(() => {
    if (currentStep === 'guided_guess_1') {
      setGuessText(scriptedGuess1);
      setActiveTargetIndex(2); // target 2 = TRAIL
    } else if (currentStep === 'guided_guess_2') {
      // User types MELT manually — just clear text and ensure target 0
      setGuessText('');
      setActiveTargetIndex(0); // target 0 = BOLT
    }
  }, [currentStep]);


  // ─── Guard ───────────────────────────────────────────────
  if (!placement.ok || !gameState) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: bg }]}>
        <Text style={[styles.errorText, { color: titleColor }]}>
          Could not generate tutorial board. Please try again.
        </Text>
        <Pressable onPress={handleSkip} style={styles.skipBtn}>
          <Text style={styles.skipBtnText}>Back to Lobby</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const showGuessInput =
    currentStep === 'guided_guess_1' ||
    currentStep === 'explain_feedback' ||
    currentStep === 'word_switching' ||
    currentStep === 'type_slap' ||
    currentStep === 'guided_guess_2' ||
    currentStep === 'guess_locking' ||
    currentStep === 'free_play';
  const detailHistoryItems = useMemo(
    () => getDetailHistory(activeTargetIndex, historyByTarget, guessViewStateByTarget),
    [activeTargetIndex, historyByTarget, guessViewStateByTarget],
  );

  const historyItems: CodeEntry[] = detailHistoryItems.map((entry) => ({
    codes: entry.codes,
    guess: entry.guess,
    isLocked: entry.isLocked,
  }));

  // Auto-scroll history to show newest guess.
  // Exception: during guess_locking step the user must tap MELT (index 0).
  // scrollToEnd would push it off-screen on compact phones (e.g. S10e) where
  // the 3-row history doesn't fit the coil — causing the CoachMark cutout to
  // land above the visible scroll area and the backdrop to cover every tappable row.
  useEffect(() => {
    if (historyItems.length > 0) {
      if (currentStep === 'guess_locking') {
        setTimeout(() => stageScrollRef.current?.scrollTo({ y: 0, animated: false }), 50);
      } else {
        setTimeout(() => stageScrollRef.current?.scrollToEnd({ animated: true }), 50);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyItems.length]); // currentStep intentionally omitted — re-run on new guesses only

  // Board overlay — mirrors BoardScreen's getPreferredOrLatestGuessForKey logic:
  // 1. If user is actively typing, show typed text (no codes)
  // 2. If a guess is locked/pinned, show that with its codes
  // 3. Otherwise show the latest submitted guess with its codes
  // This ensures the overlay persists on board tiles after submission.
  /**
   * Allow target switching from rail badges / board tiles except during guided
   * input steps where the tutorial script intentionally pins the active target.
   */
  const handleTargetSwitch = useCallback(
    (nextTargetIndex: number) => {
      if (currentStep === 'guided_guess_1' || currentStep === 'guided_guess_2') return;
      setActiveTargetIndex(nextTargetIndex);
      setGuessText('');
    },
    [currentStep],
  );

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.screen, { backgroundColor: bg }]}
    >
      <View style={{ flex: 1 }}>
      {/* ─── Header ─────────────────────────────────────── */}
      <View style={[styles.header, { borderColor: border }]}>
        <View style={styles.headerTextWrap}>
          <Text style={[styles.headerTitle, darkText, { color: titleColor }]}>
            Primer
          </Text>
        </View>
        {currentStep === 'free_play' ? (
          !showTutorialWinModal && (
            <Pressable
              onPress={handleFinishTutorial}
              style={({ pressed }) => [styles.skipHeaderBtn, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel="Finish tutorial"
            >
              <Text style={[styles.skipHeaderText, { color: MOTIF_RED }]}>Done</Text>
            </Pressable>
          )
        ) : (
          <Pressable
            onPress={handleSkip}
            style={({ pressed }) => [styles.skipHeaderBtn, { zIndex: 1001, elevation: 20 }, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
            accessibilityLabel="Skip tutorial"
          >
            <Text style={[styles.skipHeaderText, { color: MOTIF_RED }]}>Skip</Text>
          </Pressable>
        )}
      </View>

      {/* ─── Body ───────────────────────────────────────── */}
      <View style={[styles.body, { paddingBottom: 0 }]}>
        <GameBoardPanel
          maskedSegments={maskedSegments}
          revealedCoords={revealedCoords}
          activeTargetIndex={activeTargetIndex}
          targetsMeta={targetsMeta}
          onTilePress={handleTargetSwitch}
          boardRef={boardRef}
          boardWidth={boardWidth}
          onBoardWidthChange={setBoardWidth}
          onBoardFrameLayout={() => measureRef(boardRef, setBoardRect)}
          compact
          windowHeight={windowHeight}
          blueLetters={tutorialBlueLetters}
          wordSlots={wordSlots}
          solvedFlags={solvedFlags}
          selectedTargetIndex={activeTargetIndex}
          intersectionPositionsByTarget={intersectionPositionsByTarget}
          onRailPress={handleTargetSwitch}
          railRef={railRef}
          stageScrollRef={stageScrollRef}
          historyItems={historyItems}
          onHistoryPress={handleHistoryPress}
          onHistoryLongPress={handleHistoryLongPress}
          firstHistoryRef={coilGuessRef}
          isSolvedWord={solvedFlags[activeTargetIndex]}
          showGuessInput={showGuessInput}
          showKeyboard={false}
          guessText={guessText}
          wordLength={activeWordLength}
          greenLetters={greenLettersForActive}
          guessError={guessError}
          letterInputRef={letterInputRef}
          onKey={handleKeyPress}
          onBackspace={handleKeyBackspace}
          onSubmit={handleSubmitGuess}
          letterStates={letterStates}
          safeAreaBottom={0}
          darkCard={darkCard}
          darkDivider={darkDivider}
          darkText={darkText}
          darkInputBox={darkInputBox}
        />
      </View>

      {/* ─── Keyboard — always rendered to prevent layout shift ── */}
      <View style={{ paddingBottom: safeAreaBottom }}>
        <GameKeyboard
          onKey={handleKeyPress}
          onBackspace={handleKeyBackspace}
          onSubmit={handleSubmitGuess}
          letterStates={letterStates}
          disabled={!showGuessInput}
        />
      </View>
      </View>

      {/* ─── Welcome overlay ────────────────────────────── */}
      {currentStep === 'welcome' && (
        <View style={styles.welcomeOverlay}>
          <View style={[styles.welcomeCard, { backgroundColor: cardBg }]}>
            <Text style={[styles.welcomeSubtitle, { color: titleColor }]}>Welcome to</Text>
            <Image
              source={require('../../assets/design/icons/CrosswordsBlackRedBent90.png')}
              style={styles.welcomeWordmark}
              resizeMode="contain"
            />
            <Text style={[styles.welcomeBody, { color: bodyColor }]}>
              Wit is your weapon.
            </Text>
            <Pressable
              onPress={() => setCurrentStep('board_overview')}
              style={({ pressed }) => [styles.welcomeBtn, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
            >
              <Text style={styles.welcomeBtnText}>En Gardé!</Text>
            </Pressable>
            <Pressable
              onPress={handleSkip}
              style={({ pressed }) => [styles.welcomeSkipBtn, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel="Skip tutorial"
            >
              <Text style={[styles.welcomeSkipText, { color: mutedColor }]}>Skip Primer</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ─── Coach marks ────────────────────────────────── */}
      <CoachMark
        visible={currentStep === 'board_overview'}
        targetRect={boardRect}
        title="The Board"
        stepLabel="Step 1 of 6"
        body="Your 5 target words are hidden on this grid. Words intersect, so solving one can reveal letters for another."
        position="below"
        buttonLabel="Next"
        onPress={() => setCurrentStep('word_cards')}
      />
      {/* Step 2/8 — Word Cards: wait for user to tap badge #3 */}
      <CoachMark
        visible={currentStep === 'word_cards'}
        targetRect={railRect}
        title="Word Cards"
        stepLabel="Step 2 of 6"
        body={`Try switching between words using the numbers. Choose number ${trailDisplayIndex} for our first guess.`}
        position="above"
        buttonLabel={null}
      />
      {/* Guided guess 1 — instruction overlay while PLANT is auto-filled */}
      <CoachMark
        visible={currentStep === 'guided_guess_1'}
        targetRect={letterInputRect}
        title="Submit a Guess"
        body={`Our first guess is PLANT. Tap Submit to continue.`}
        position="above"
        buttonLabel="Submit"
        onPress={handleSubmitGuess}
      />
      {/* Step 3/6 — Explain feedback (monochrome board tile palette) */}
      <CoachMark
        visible={currentStep === 'explain_feedback'}
        targetRect={coilGuessRect}
        title="Reading the Board"
        stepLabel="Step 3 of 6"
        body={
          <View style={{ gap: 6 }}>
            {[
              { ...tilePalette.correct,     border: undefined,   label: 'Right letter, right spot' },
              { ...tilePalette.wrongSpot,   border: undefined,   label: 'Right letter, wrong spot' },
              { ...tilePalette.notInWord,   border: undefined,   label: 'In another unsolved word' },
              { ...tilePalette.notInPuzzle, border: '#D3D3D6',   label: 'Not in any target word' },
            ].map(({ bg, letter: textColor, border, label }) => (
              <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 22, height: 22, borderRadius: 3, backgroundColor: bg, borderWidth: border ? 1 : 0, borderColor: border, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: tAtlantic.typography.displayFamily, fontSize: 12, color: textColor }}>A</Text>
                </View>
                <Text style={{ fontFamily: tAtlantic.typography.bodyFamily, fontSize: 14, lineHeight: 18, color: darkMode ? '#d1d1d1' : '#444', flex: 1 }}>{label}</Text>
              </View>
            ))}
            <Text style={{ fontFamily: tAtlantic.typography.bodyFamily, fontSize: 13, lineHeight: 18, color: darkMode ? '#aaa' : '#666', marginTop: 6 }}>
              At crossings, tiles show a corner stripe for the other word — horizontal if it runs across, vertical if it runs down. Same color rules apply.
            </Text>
            <Text style={{ fontFamily: tAtlantic.typography.bodyFamily, fontSize: 13, lineHeight: 18, color: darkMode ? '#aaa' : '#666', marginTop: 2 }}>
              Blue tiles can turn gray once that other word is solved.
            </Text>
            <Text style={{ fontFamily: tAtlantic.typography.bodyFamily, fontSize: 13, lineHeight: 18, color: darkMode ? '#aaa' : '#666', marginTop: 6 }}>
              Tap <Text style={{ fontWeight: '700' }}>?</Text> on the keyboard anytime to review these.
            </Text>
          </View>
        }
        position="above"
        buttonLabel="Next"
        onPress={() => setCurrentStep('word_switching')}
      />
      {/* Step 4/8 — Word switching: wait for user to tap badge #1 */}
      <CoachMark
        visible={currentStep === 'word_switching'}
        targetRect={railRect}
        title="Switch Targets"
        stepLabel="Step 4 of 6"
        body={`Now switch to word ${boltDisplayIndex}.`}
        position="above"
        buttonLabel={null}
      />
      {/* Step 5/8 — Type SLAP instruction */}
      <CoachMark
        visible={currentStep === 'type_slap'}
        targetRect={railRect}
        title="Your Turn"
        stepLabel="Step 5 of 6"
        body="Type MELT using the keyboard below, then tap ↵ to submit."
        position="above"
        buttonLabel="Ready"
        onPress={() => setCurrentStep('guided_guess_2')}
      />
      {/* Step 6/6 — Lock/unlock: interactive, button appears after locking */}
      <CoachMark
        visible={currentStep === 'guess_locking'}
        targetRect={coilGuessRect}
        title="Lock a Guess"
        stepLabel="Step 6 of 6"
        body={hasLocked
          ? "Perfect - long-press the pinned row again any time to unpin it."
          : <Text style={{ fontFamily: tAtlantic.typography.bodyFamily, fontSize: 14, lineHeight: 20, color: bodyColor }}>Guesses stack - by default the last one is tracked. I&apos;ve made 2 more guesses for you. Tap a row to preview it, then long-press <Text style={{ fontStyle: 'italic' }}>MELT</Text> to pin it. Try it!</Text>}
        position="above"
        buttonLabel={hasLocked ? 'Next' : null}
        onPress={() => setCurrentStep('free_play')}
      />
      {/* Free play — introductory bubble */}
      <CoachMark
        visible={currentStep === 'free_play' && !freePlayDismissed}
        targetRect={boardRect}
        title="Your Turn!"
        body="Try solving the remaining words."
        position="below"
        buttonLabel="Let's Go"
        onPress={() => setFreePlayDismissed(true)}
      />


      {/* ─── Tutorial Win Modal ─────────────────────────────────── */}
      <Modal visible={showTutorialWinModal} transparent animationType="fade">
        <View style={styles.tutorialWinOverlay}>
          <View style={[styles.tutorialWinContent, darkCard]}>

            <Text style={[styles.tutorialWinTitle, darkText]}>You're a Natural! 🎉</Text>

            <View style={styles.tutorialWinStats}>
              <View style={styles.tutorialWinStatRow}>
                <Text style={[styles.tutorialWinStatLabel, { color: mutedColor }]}>Words Solved:</Text>
                <Text style={[styles.tutorialWinStatValue, darkText]}>{solvedFlags.filter(Boolean).length}/5</Text>
              </View>
              <View style={styles.tutorialWinStatRow}>
                <Text style={[styles.tutorialWinStatLabel, { color: mutedColor }]}>Total Guesses:</Text>
                <Text style={[styles.tutorialWinStatValue, darkText]}>
                  {gameState?.guessesByTarget.reduce((sum, g) => sum + g.length, 0) ?? 0}
                </Text>
              </View>
            </View>

            <View style={[styles.tutorialWinDivider, darkDivider]} />

            <Text style={[styles.tutorialWinSectionLabel, { color: mutedColor }]}>Explore What's Next</Text>

            <View style={styles.tutorialWinFeatureButtons}>
              <Pressable
                style={({ pressed }) => [styles.tutorialWinFeatureBtn, pressed && { opacity: 0.7 }]}
                onPress={handleWinGoToStats}
                accessibilityRole="button"
                accessibilityLabel="Go to Ledger"
              >
                <Text style={[styles.tutorialWinFeatureBtnTitle, darkText]}>Ledger</Text>
                <Text style={[styles.tutorialWinFeatureBtnDesc, { color: mutedColor }]}>Track your wins and streaks</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.tutorialWinFeatureBtn, pressed && { opacity: 0.7 }]}
                onPress={handleWinGoToGameModes}
                accessibilityRole="button"
                accessibilityLabel="Go to Game Modes"
              >
                <Text style={[styles.tutorialWinFeatureBtnTitle, darkText]}>Game Modes</Text>
                <Text style={[styles.tutorialWinFeatureBtnDesc, { color: mutedColor }]}>Bot Duel, Challenges & more</Text>
              </Pressable>
            </View>

            <Pressable
              style={({ pressed }) => [styles.tutorialWinPrimaryBtn, pressed && { opacity: 0.85 }]}
              onPress={handleWinGoToLobby}
              accessibilityRole="button"
              accessibilityLabel="Go to Lobby"
            >
              <Text style={styles.tutorialWinPrimaryBtnText}>Go to Lobby</Text>
            </Pressable>

          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
  },
  headerTextWrap: { flex: 1 },
  headerTitle: {
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 22,
  },
  skipHeaderBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  skipHeaderText: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 15,
    fontWeight: '600',
  },
  body: { flex: 1, minHeight: 0, paddingHorizontal: 16, paddingBottom: 16 },
  errorText: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 60,
    paddingHorizontal: 20,
  },
  skipBtn: {
    alignSelf: 'center',
    marginTop: 20,
    backgroundColor: MOTIF_RED,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  skipBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  welcomeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    paddingBottom: 60,
  },
  welcomeCard: {
    marginHorizontal: 28,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 12,
  },
  welcomeSubtitle: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 4,
  },
  welcomeWordmark: {
    width: 280,
    height: 64,
    alignSelf: 'center',
    marginBottom: 8,
  },
  welcomeBody: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  welcomeSub: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  welcomeBtn: {
    backgroundColor: MOTIF_RED,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 0,
    marginTop: 6,
  },
  welcomeBtnText: {
    color: '#fff',
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 16,
    fontWeight: '700',
  },
  welcomeSkipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  welcomeSkipText: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 13,
    textAlign: 'center',
  },
  // ─── Tutorial Win Modal ──────────────────────────────────────
  tutorialWinOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tutorialWinContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 32,
    width: '85%',
    maxWidth: 400,
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  tutorialWinTitle: {
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 26,
    color: '#000',
    textAlign: 'center',
  },
  tutorialWinStats: { width: '100%', gap: 10 },
  tutorialWinStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tutorialWinStatLabel: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 15,
    color: '#666',
  },
  tutorialWinStatValue: {
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 18,
    color: '#000',
  },
  tutorialWinDivider: {
    width: '100%',
    height: 1,
    backgroundColor: '#e2e2e2',
    marginVertical: 4,
  },
  tutorialWinSectionLabel: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#888',
  },
  tutorialWinFeatureButtons: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
  },
  tutorialWinFeatureBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: MOTIF_RED,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  tutorialWinFeatureBtnTitle: {
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 14,
    color: '#000',
    textAlign: 'center',
  },
  tutorialWinFeatureBtnDesc: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    lineHeight: 15,
  },
  tutorialWinPrimaryBtn: {
    width: '100%',
    backgroundColor: MOTIF_RED,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  tutorialWinPrimaryBtnText: {
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 16,
    color: '#fff',
  },
});
