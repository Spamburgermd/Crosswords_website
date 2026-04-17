// crosswords_mobile/src/screens/tutorial/TutorialScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@src/navigation/AppNavigator';
import GameBoardPanel from '@src/components/GameBoardPanel';
import { buildKeyboardLetterStates } from '@src/lib/keyboardLetterStates';
import { buildIntersectionPositionsByTarget } from '@src/lib/boardRevealMap';
import TutorialSpotlight from './TutorialSpotlight';
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
import type { TutorialGameState, ZoneRect } from './types';
import useUIStore from '@src/stores/uiStore';
import { DESIGN_TOKEN_SETS } from '@src/theme/designTokens';
import { isAllSolved, countTotalGuesses } from './tutorialWin';
import { totalRevealMs } from '@src/animations/revealTiming';
import {
  beginRevealOwnership,
  resolveRevealTargetIndex,
  type RevealOwnership,
} from '@src/lib/revealOwnership';

const tAtlantic = DESIGN_TOKEN_SETS.atlantic;
const MOTIF_RED = '#E7131A';

type Props = NativeStackScreenProps<RootStackParamList, 'Tutorial'>;

const WORD_SLOTS = getTutorialWordSlots();

export default function TutorialScreen({ navigation, route }: Props) {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [activeTargetIndex, setActiveTargetIndex] = useState(0);
  const [guessText, setGuessText] = useState('');
  const [revealEpoch, setRevealEpoch] = useState(0);
  const [revealOwnership, setRevealOwnership] = useState<RevealOwnership | null>(null);
  const [spotlightHidden, setSpotlightHidden] = useState(false);
  const [spotlightRetryHint, setSpotlightRetryHint] = useState<string | undefined>(undefined);
  const scrollRef = useRef<ScrollView>(null);
  const boardRef = useRef<View>(null);
  const revealResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [boardWidth, setBoardWidth] = useState<number | null>(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [showWinModal, setShowWinModal] = useState(false);
  const tutorialCompletionRecordedRef = useRef(false);
  const hasCompletedTutorial = useUIStore(s => s.hasCompletedTutorial);
  const setHasCompletedTutorial = useUIStore(s => s.setHasCompletedTutorial);
  const isFirstLaunch = route.params?.firstLaunch ?? false;
  const revealTargetIndex = resolveRevealTargetIndex(revealOwnership, Date.now());

  const startRevealWindow = useCallback((targetIndex: number, wordLength: number) => {
    const delay = totalRevealMs(wordLength);

    if (revealResetTimeoutRef.current) {
      clearTimeout(revealResetTimeoutRef.current);
    }

    setRevealOwnership(beginRevealOwnership(targetIndex, Date.now(), delay));
    revealResetTimeoutRef.current = setTimeout(() => {
      setRevealOwnership((current) => (current?.targetIndex === targetIndex ? null : current));
      revealResetTimeoutRef.current = null;
    }, delay);
  }, []);

  useEffect(() => {
    return () => {
      if (revealResetTimeoutRef.current) {
        clearTimeout(revealResetTimeoutRef.current);
      }
    };
  }, []);

  // ── Zone rects for spotlight (populated via onLayout) ─────────
  const [zoneRects, setZoneRects] = useState<Record<string, ZoneRect>>({});
  const [rootHeight, setRootHeight] = useState(0);

  const handleZoneLayout = useCallback((zone: string, e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    setZoneRects(prev => {
      const existing = prev[zone];
      if (existing && existing.x === x && existing.y === y &&
          existing.width === width && existing.height === height) {
        return prev;
      }
      return { ...prev, [zone]: { x, y, width, height } };
    });
  }, []);

  // Game state
  const game = useTutorialGameState(activeTargetIndex);
  const intersectionPositionsByTarget = useMemo(
    () => buildIntersectionPositionsByTarget(WORD_SLOTS),
    [],
  );

  // Derive blueTickerLetters from blueTickerEntries
  const blueTickerLetters = game.blueTickerEntries.map(([letter]) => letter);

  // Derive letterStates for keyboard coloring
  const letterStates = useMemo(
    () => buildKeyboardLetterStates(TUTORIAL_WORDS, Array.from(game.combinedHistoryByTarget.values()).flat()),
    [game.combinedHistoryByTarget],
  );

  const greenLettersForActive = game.cardDisplayState.greenPlaceholdersByTarget[activeTargetIndex] ?? {};

  // Win detection
  useEffect(() => {
    if (isAllSolved(game.solvedFlags)) {
      if (!tutorialCompletionRecordedRef.current && !hasCompletedTutorial) {
        tutorialCompletionRecordedRef.current = true;
        setHasCompletedTutorial(true);
      }
      setShowWinModal(true);
    }
  }, [game.solvedFlags, hasCompletedTutorial, setHasCompletedTutorial]);

  const totalGuesses = countTotalGuesses(game.combinedHistoryByTarget);
  const solvedCount = Object.values(game.solvedFlags).filter(Boolean).length;
  const totalWords = TUTORIAL_WORDS.length;

  const handleWinGoToStats = useCallback(() => {
    if (!hasCompletedTutorial) {
      setHasCompletedTutorial(true);
    }
    navigation.navigate('Stats');
  }, [hasCompletedTutorial, navigation, setHasCompletedTutorial]);

  const handleWinGoToGameModes = useCallback(() => {
    if (!hasCompletedTutorial) {
      setHasCompletedTutorial(true);
    }
    navigation.navigate('GameModes');
  }, [hasCompletedTutorial, navigation, setHasCompletedTutorial]);

  const handleWinGoToLobby = useCallback(() => {
    if (!hasCompletedTutorial) {
      setHasCompletedTutorial(true);
    }
    if (isFirstLaunch) {
      navigation.replace('Lobby');
    } else {
      navigation.navigate('Lobby');
    }
  }, [hasCompletedTutorial, isFirstLaunch, navigation, setHasCompletedTutorial]);

  const handleSkipTutorial = useCallback(() => {
    if (!hasCompletedTutorial) {
      setHasCompletedTutorial(true);
    }
    if (isFirstLaunch) {
      navigation.replace('Lobby');
    } else {
      navigation.goBack();
    }
  }, [hasCompletedTutorial, isFirstLaunch, navigation, setHasCompletedTutorial]);

  // Step machine
  const tutorialGameState: TutorialGameState = {
    guessCountByTarget: Object.fromEntries(
      Array.from(game.wordSnapshotsByTarget.entries()).map(([k, snapshot]) => [k, snapshot.nativeHistoryRows.length]),
    ),
    lastGuessByTarget: Object.fromEntries(
      Array.from(game.wordSnapshotsByTarget.entries()).map(([k, snapshot]) => [k, (snapshot.latestLiteralGuess ?? '').toUpperCase()]),
    ),
    activeTargetIndex,
  };
  const { activeStep, dismiss } = useTutorialStepMachine(TUTORIAL_STEPS, tutorialGameState);

  // Reset spotlight visibility and retry hint when step changes
  useEffect(() => {
    setSpotlightHidden(false);
    setSpotlightRetryHint(undefined);
  }, [activeStep?.id]);

  // Pre-fill: apply when the active step has a preFill for the current word
  useEffect(() => {
    if (activeStep?.preFillTargetIndex === undefined) return;
    if (activeStep.preFillTargetIndex === activeTargetIndex && activeStep.preFill) {
      setGuessText((prev) => (prev === '' ? activeStep.preFill! : prev));
    }
  }, [activeTargetIndex, activeStep]);

  // Emphasis props derived from active step
  const emphasizeKeyboard    = activeStep?.highlightTarget === 'submit-button' || !!activeStep?.emphasizeKeyboard;
  const emphasizeBoard       = activeStep?.highlightTarget === 'intersection-tile';
  const emphasizedRailTarget =
    activeStep?.highlightTarget === 'word-tabs'
      ? (activeStep.highlightTargetIndex ?? null)
      : null;

  // Resolve spotlight zone rect for the active step
  const activeZoneRect: ZoneRect | null =
    activeStep?.spotlightZone ? (zoneRects[activeStep.spotlightZone] ?? null) : null;

  // Guess submission
  const handleSubmit = useCallback(() => {
    const trimmed = guessText.trim().toUpperCase();
    if (trimmed.length === 0) return;
    const prefillData = TUTORIAL_PREFILLS[activeTargetIndex];
    const codes =
      prefillData && trimmed === prefillData.guess
        ? prefillData.codes
        : computeFallbackCodes(trimmed, TUTORIAL_WORDS[activeTargetIndex] ?? '');
    game.injectScriptedGuess(activeTargetIndex, trimmed, codes);
    // Mirror BoardScreen's reveal contract so newly confirmed letters render
    // through the shared reveal animation path instead of the idle path.
    setRevealEpoch((epoch) => epoch + 1);
    startRevealWindow(activeTargetIndex, trimmed.length);
    setGuessText('');

    // Re-show the hint card if this is a gated action step and the guess was wrong
    if (spotlightHidden && activeStep?.hint.isAction) {
      setSpotlightHidden(false);
      setSpotlightRetryHint('Try typing PATTER.');
    }
  }, [guessText, activeTargetIndex, game, spotlightHidden, activeStep, startRevealWindow]);

  // Tile / rail press (word switching)
  const handleTilePress = useCallback((targetIndex: number) => {
    setActiveTargetIndex(targetIndex);
    if (activeStep?.preFillTargetIndex === targetIndex && activeStep?.preFill) {
      setGuessText(activeStep.preFill);
    } else {
      setGuessText('');
    }
  }, [activeStep]);

  const handleRailPress = useCallback((targetIndex: number) => {
    setActiveTargetIndex(targetIndex);
    if (activeStep?.preFillTargetIndex === targetIndex && activeStep?.preFill) {
      setGuessText(activeStep.preFill);
    } else {
      setGuessText('');
    }
  }, [activeStep]);

  // History rows for stage panel
  const historyItems = game.cardDisplayState.detailRowsForSelectedTarget;

  // History interactions (preview + lock)
  const handleHistoryPress = useCallback((guessIdx: number) => {
    const entry = historyItems[guessIdx];
    if (!entry || entry.interactive === false) return;
    game.previewGuessRow(activeTargetIndex, entry.rowId);
  }, [game, activeTargetIndex, historyItems]);

  const handleHistoryLongPress = useCallback((guessIdx: number) => {
    const entry = historyItems[guessIdx];
    if (!entry || entry.interactive === false) return;
    if (entry.isLocked) {
      game.unlockGuessView(activeTargetIndex);
      return;
    }
    game.lockGuessRow(activeTargetIndex, entry.rowId);
  }, [game, activeTargetIndex, historyItems]);

  const wordLength = TUTORIAL_WORDS[activeTargetIndex]?.length ?? 5;

  return (
    <View
      style={styles.root}
      onLayout={(e) => setRootHeight(e.nativeEvent.layout.height)}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
        keyboardShouldPersistTaps="always"
      >
        <GameBoardPanel
          maskedSegments={TUTORIAL_MASKED_SEGMENTS}
          revealedCoords={TUTORIAL_REVEALED_COORDS}
          activeTargetIndex={activeTargetIndex}
          boardTilesByCoord={game.boardTilesByCoord}
          boardDiagnostics={game.boardDiagnostics}
          targetsMeta={TUTORIAL_TARGETS_META}
          revealTargetIndex={revealTargetIndex}
          revealEpoch={revealEpoch}
          onTilePress={handleTilePress}
          boardRef={boardRef}
          boardWidth={boardWidth}
          onBoardWidthChange={setBoardWidth}
          compact={false}
          windowHeight={windowHeight}
          blueLetters={blueTickerLetters}
          wordSlots={WORD_SLOTS}
          solvedFlags={Object.values(game.solvedFlags)}
          selectedTargetIndex={activeTargetIndex}
          intersectionPositionsByTarget={intersectionPositionsByTarget}
          onRailPress={handleRailPress}
          historyItems={historyItems}
          onHistoryPress={handleHistoryPress}
          onHistoryLongPress={handleHistoryLongPress}
          showGuessInput
          guessText={guessText}
          wordLength={wordLength}
          greenLetters={greenLettersForActive}
          onKey={activeStep?.lockPreFill ? () => {} : (k) => setGuessText((t) => (t.length < wordLength ? t + k : t))}
          onBackspace={activeStep?.lockPreFill ? () => {} : () => setGuessText((t) => t.slice(0, -1))}
          onSubmit={handleSubmit}
          letterStates={letterStates}
          safeAreaBottom={insets.bottom}
          emphasizeKeyboard={emphasizeKeyboard}
          emphasizeBoard={emphasizeBoard}
          emphasizedRailTargetIndex={emphasizedRailTarget}
          onZoneLayout={handleZoneLayout}
        />
      </ScrollView>

      {activeStep && (
        <TutorialSpotlight
          step={activeStep}
          zoneRect={activeZoneRect}
          parentHeight={rootHeight}
          onDismiss={dismiss}
          hidden={spotlightHidden}
          onHide={() => { setSpotlightHidden(true); setSpotlightRetryHint(undefined); }}
          retryHint={spotlightRetryHint}
          safeAreaBottom={insets.bottom}
        />
      )}

      {/* ─── Welcome Overlay ("Modal 0") ──────────────────────── */}
      {showWelcome && (
        <View style={styles.welcomeOverlay}>
          <View style={styles.welcomeCard}>
            <Text style={styles.welcomeSubtitle}>Welcome to</Text>
            <Image
              source={require('../../../assets/design/icons/CrosswordsBlackRedBent90.png')}
              style={styles.welcomeWordmark}
              resizeMode="contain"
            />
            <Text style={styles.welcomeBody}>Wit is your weapon.</Text>
            <Pressable
              onPress={() => setShowWelcome(false)}
              style={({ pressed }) => [styles.welcomeBtn, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
            >
              <Text style={styles.welcomeBtnText}>En Gardé!</Text>
            </Pressable>
            <Pressable
              onPress={handleSkipTutorial}
              style={({ pressed }) => [styles.welcomeSkipBtn, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel="Skip tutorial"
            >
              <Text style={styles.welcomeSkipText}>Skip Primer</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ─── Tutorial Win Modal ─────────────────────────────────── */}
      <Modal visible={showWinModal} transparent animationType="fade">
        <View style={styles.winOverlay}>
          <View style={styles.winContent}>
            <Text style={styles.winTitle}>You're a Natural! 🎉</Text>

            <View style={styles.winStats}>
              <View style={styles.winStatRow}>
                <Text style={styles.winStatLabel}>Words Solved:</Text>
                <Text style={styles.winStatValue}>{solvedCount}/{totalWords}</Text>
              </View>
              <View style={styles.winStatRow}>
                <Text style={styles.winStatLabel}>Total Guesses:</Text>
                <Text style={styles.winStatValue}>{totalGuesses}</Text>
              </View>
            </View>

            <View style={styles.winDivider} />

            <Text style={styles.winSectionLabel}>Explore What's Next</Text>

            <View style={styles.winFeatureButtons}>
              <Pressable
                style={({ pressed }) => [styles.winFeatureBtn, pressed && { opacity: 0.7 }]}
                onPress={handleWinGoToStats}
                accessibilityRole="button"
                accessibilityLabel="Go to Ledger"
              >
                <Text style={styles.winFeatureBtnTitle}>Ledger</Text>
                <Text style={styles.winFeatureBtnDesc}>Track your wins and streaks</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.winFeatureBtn, pressed && { opacity: 0.7 }]}
                onPress={handleWinGoToGameModes}
                accessibilityRole="button"
                accessibilityLabel="Go to Game Modes"
              >
                <Text style={styles.winFeatureBtnTitle}>Game Modes</Text>
                <Text style={styles.winFeatureBtnDesc}>Bot Duel, Challenges & more</Text>
              </Pressable>
            </View>

            <Pressable
              style={({ pressed }) => [styles.winPrimaryBtn, pressed && { opacity: 0.85 }]}
              onPress={handleWinGoToLobby}
              accessibilityRole="button"
              accessibilityLabel="Go to Lobby"
            >
              <Text style={styles.winPrimaryBtnText}>Go to Lobby</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/**
 * Fallback scorer for free-play guesses that override the pre-fill.
 * Produces G/Y/R codes only — no cross-word B detection intentionally,
 * since we only have the active target word available here.
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
    paddingTop: 0,
    flexGrow: 1,
  },
  // ─── Welcome Overlay ─────────────────────────────────
  welcomeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    zIndex: 1000,
    paddingBottom: 60,
  },
  welcomeCard: {
    backgroundColor: '#fff',
    marginHorizontal: 28,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center' as const,
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
    textAlign: 'center' as const,
    color: '#000',
    marginBottom: 4,
  },
  welcomeWordmark: {
    width: 280,
    height: 64,
    alignSelf: 'center' as const,
    marginBottom: 8,
  },
  welcomeBody: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center' as const,
    color: '#333',
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
    fontWeight: '700' as const,
  },
  welcomeSkipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  welcomeSkipText: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 13,
    textAlign: 'center' as const,
    color: '#888',
  },
  // ─── Win Modal ──────────────────────────────────────
  winOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  winContent: {
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
  winTitle: {
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 26,
    color: '#000',
    textAlign: 'center',
  },
  winStats: { width: '100%', gap: 10 },
  winStatRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  winStatLabel: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 15,
    color: '#666',
  },
  winStatValue: {
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 18,
    color: '#000',
  },
  winDivider: {
    width: '100%',
    height: 1,
    backgroundColor: '#e2e2e2',
    marginVertical: 4,
  },
  winSectionLabel: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: '#888',
  },
  winFeatureButtons: {
    width: '100%',
    flexDirection: 'row' as const,
    gap: 10,
  },
  winFeatureBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: MOTIF_RED,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center' as const,
    gap: 4,
  },
  winFeatureBtnTitle: {
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 14,
    color: '#000',
    textAlign: 'center' as const,
  },
  winFeatureBtnDesc: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 11,
    color: '#666',
    textAlign: 'center' as const,
    lineHeight: 15,
  },
  winPrimaryBtn: {
    width: '100%',
    backgroundColor: MOTIF_RED,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center' as const,
  },
  winPrimaryBtnText: {
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 16,
    color: '#fff',
  },
});
