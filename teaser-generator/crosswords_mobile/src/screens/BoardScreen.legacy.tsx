/**
 * LEGACY FILE — archived on purpose. Not imported anywhere. Do not revive without explicit decision.
 * src/screens/BoardScreen.tsx (legacy)
 * ---------------------------------------------
 * Historic non-Atlantic layout retained for reference only.
 */

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';

import BoardView from '@components/BoardView';
import GuessBar from '@components/GuessBar';
import ThemePicker from '@components/ThemePicker';
import { USE_ATLANTIC_SKIN } from '@src/flags';
import { RootStackParamList } from '@src/navigation/AppNavigator';
import { DESIGN_TOKEN_SETS } from '@src/theme/designTokens';
import Banner from '@src/ui/Banner';
import RopeRule from '@src/ui/RopeRule';
import colors from '@src/theme/colors';
import { submitGuess } from '@lib/api';
import type { GuessEntry, MaskedSegment } from '@schemas/api';
import { useGameState } from '@hooks/useGameState';
import useSessionStore from '@stores/sessionStore';
import useUserStore from '@stores/userStore';
import {
  buildCanonicalWordSlots,
  buildPathSignature,
  type CanonicalWordSlot,
  type TargetMeta,
} from '@src/utils/wordSlots';

const tAtlantic = DESIGN_TOKEN_SETS.atlantic;
const MOTIF_RED = '#E7131A';

const CLUE_LIST_LEFT = [
  '1. Duelist meeting at crossroads.',
  '6. Toast shared after a narrow win.',
  '8. Whispered hint passed beneath the table.',
];
const CLUE_LIST_RIGHT = [
  '3. Glinting emerald marking the key square.',
  '9. Opponent biding time before a strike.',
  '10. Triumphant sip once the grid is conquered.',
];

const ICON_PLACEHOLDERS = [0, 1, 2, 3];

type BoardScreenNavigation = NativeStackNavigationProp<RootStackParamList, 'Board'>;

type WordSlot = CanonicalWordSlot;

type GuessTargetSelectorProps = {
  slots: WordSlot[];
  activeTargetIndex: number | null;
  onSelect: (targetIndex: number) => void;
};

// Presents the red “word cards” as simple pills. We drive selection by targetIndex
// (the backend’s stable identity) so across/down twins that share the same start
// cell never collide or highlight the wrong direction.
function GuessTargetSelector({
  slots,
  activeTargetIndex,
  onSelect,
}: GuessTargetSelectorProps): React.JSX.Element {
  return (
    <View style={styles.targetSelectorRow}>
      {slots.map((slot) => (
        <Pressable
          key={`target-${slot.targetIndex}`}
          onPress={() => onSelect(slot.targetIndex)}
          style={({ pressed }) => [
            styles.targetPill,
            activeTargetIndex === slot.targetIndex && styles.targetPillActive,
            pressed && styles.targetPillPressed,
          ]}
        >
          <Text style={styles.targetPillText}>{slot.displayIndex}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function BoardScreen(): React.JSX.Element {
  const navigation = useNavigation<BoardScreenNavigation>();
  const username = useUserStore((state) => state.username) || 'Player';
  const { apiKey, activeGameId } = useSessionStore();

  const { data: gameState, error, invalidate } = useGameState(
    apiKey.trim().length > 0 ? apiKey : null,
    activeGameId,
  );

  const { selectedGuessIndexByWord, setSelectedGuessIndex } = useSessionStore();
  const [stageMode, setStageMode] = useState<'list' | 'detail'>('list');
  const lastTapRef = useRef<{ targetIndex: number; ts: number } | null>(null);
  const DOUBLE_TAP_MS = 300;
  const [guessText, setGuessText] = useState('');
  const [guessError, setGuessError] = useState<string | null>(null);
  const guessInputRef = useRef<TextInput | null>(null);
  const historyScrollRef = useRef<ScrollView | null>(null);
  const [boardWidth, setBoardWidth] = useState<number | null>(null);
  const { height: windowHeight } = useWindowDimensions();

  const maskedSegments = useMemo<MaskedSegment[]>(
    () => gameState?.opponent_masked ?? [],
    [gameState?.opponent_masked],
  );
  const revealedCoords = useMemo<number[][]>(
    () => gameState?.revealed_coords ?? [],
    [gameState?.revealed_coords],
  );
  const targetsMeta = useMemo<TargetMeta[]>(() => gameState?.targets_meta ?? [], [gameState?.targets_meta]);
  const wordSlots = useMemo<WordSlot[]>(
    // Build a stable, ordered list of target slots that both the board and guess UI share.
    () => buildCanonicalWordSlots(maskedSegments, targetsMeta),
    [maskedSegments, targetsMeta],
  );
  const developerTargetWords = useMemo<string[]>(() => {
    // Dev-only helper: surface the opponent/bot's submitted words when the backend sends them.
    // Backend only exposes these when DEBUG_REVEAL_SOLUTIONS is enabled, so we guard for null.
    const words = gameState?.debug_solution_words ?? gameState?.debug_bot_words ?? null;
    if (!words || !Array.isArray(words)) {
      return [];
    }
    return words.filter(Boolean);
  }, [gameState?.debug_solution_words, gameState?.debug_bot_words]);
  const shouldShowDeveloperBox = __DEV__ && !!gameState;

  const targetLengths = useMemo<number[]>(
    () => gameState?.target_lengths ?? [],
    [gameState?.target_lengths],
  );
  const metaLengthByTargetIndex = useMemo(() => {
    const map = new Map<number, number>();
    (targetsMeta ?? []).forEach((meta) => {
      if (typeof meta.target_index === 'number') {
        map.set(meta.target_index, meta.length);
      }
    });
    return map;
  }, [targetsMeta]);
  const lengthByTargetIndex = useMemo(() => {
    // Map backend target_index -> known length from canonical slots (safer than relying on target_lengths list order).
    const map = new Map<number, number>();
    (wordSlots ?? []).forEach((slot) => {
      if (typeof slot.targetIndex === 'number') {
        map.set(slot.targetIndex, slot.length);
      }
    });
    return map;
  }, [wordSlots]);
  const solvedFlags = useMemo<boolean[]>(
    () => gameState?.your_solved ?? [],
    [gameState?.your_solved],
  );

  useEffect(() => {
    if (!__DEV__ || wordSlots.length === 0) {
      return;
    }
    // TEMP DEBUG: inspect canonical slot signature mapping
    console.log(
      'CANONICAL SLOTS:',
      wordSlots.map((s, index) => ({
        displayWord: index + 1,
        key: s.key,
        clue: s.clueNumber,
        dir: s.direction,
        len: s.length,
        start: s.coords?.[0],
        signature: s.signature,
        targetIndex: s.targetIndex,
      })),
    );
  }, [wordSlots]);

  useEffect(() => {
    if (!__DEV__ || targetsMeta.length === 0) {
      return;
    }
    // TEMP DEBUG: inspect backend target metadata
    console.log('=== BACKEND TARGET SIGNATURES ===');
    targetsMeta.forEach((meta) => {
      const sig = buildPathSignature(meta.dir as 'A' | 'D', meta.coords ?? []);
      console.log({
        targetIndex: meta.target_index,
        dir: meta.dir,
        len: meta.length,
        signature: sig,
        coords: meta.coords,
      });
    });
  }, [targetsMeta]);

  const wordsByKey = useMemo(() => new Map(wordSlots.map((slot) => [slot.key, slot])), [wordSlots]);
  const wordKeyByTargetIndex = useMemo(
    () => new Map(wordSlots.map((slot) => [slot.targetIndex, slot.key])),
    [wordSlots],
  );
  const slotByTargetIndex = useMemo(
    () => new Map(wordSlots.map((slot) => [slot.targetIndex, slot])),
    [wordSlots],
  );

  const primaryWordSlot = wordSlots[0];
  const [selectedTargetIndex, setSelectedTargetIndex] = useState<number | null>(null);
  useEffect(() => {
    if (!primaryWordSlot) {
      return;
    }
    if (selectedTargetIndex == null || !slotByTargetIndex.has(selectedTargetIndex)) {
      setSelectedTargetIndex(primaryWordSlot.targetIndex);
    }
  }, [primaryWordSlot, selectedTargetIndex, slotByTargetIndex]);

  const selectedWordSlot =
    (selectedTargetIndex != null ? slotByTargetIndex.get(selectedTargetIndex) : undefined) ??
    primaryWordSlot;
  // The selection resolves through the backend target index so across/down pairs at the same start
  // never fight for the same highlight.
  const resolvedSelectedTargetIndex =
    selectedWordSlot?.targetIndex ?? primaryWordSlot?.targetIndex ?? 0;
  const selectedDisplayIndex =
    selectedWordSlot?.displayIndex ?? primaryWordSlot?.displayIndex ?? 1;
  const selectedSlotLength =
    selectedWordSlot?.length ?? targetLengths[resolvedSelectedTargetIndex] ?? undefined;

  const isGameWon = useMemo(() => {
    if (!gameState) {
      return false;
    }
    return solvedFlags.length > 0 && solvedFlags.every(Boolean);
  }, [gameState, solvedFlags]);

  const handleGuessChange = useCallback(
    (value: string) => {
      // Prefer canonical slot length; fall back to server target_lengths list and finally a safe default.
    const mappedLen =
      (selectedWordSlot?.targetIndex != null
        ? lengthByTargetIndex.get(selectedWordSlot.targetIndex)
        : undefined) ?? targetLengths[resolvedSelectedTargetIndex];
      const maxLen = Math.max(1, selectedWordSlot?.length ?? mappedLen ?? 10);
      const lettersOnly = value.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, maxLen);
      setGuessText(lettersOnly);
    },
    [setGuessText, selectedWordSlot, resolvedSelectedTargetIndex, targetLengths, lengthByTargetIndex],
  );

  const canSubmitGuess = useMemo(() => {
    if (!gameState || isGameWon) {
      return false;
    }
    if (gameState.status !== 'active') {
      return false;
    }
    return gameState.current_turn_user_id === gameState.me.user_id;
  }, [gameState, isGameWon]);

  const handleBoardTilePress = useCallback(
    (targetIdx: number) => {
      setSelectedTargetIndex(targetIdx);
      setStageMode('detail');
      lastTapRef.current = null;
    },
    [setSelectedTargetIndex],
  );

  const guessMutation = useMutation({
    mutationFn: (payload: { targetIndex: number; guess: string; targetSignature?: string }) => {
      if (!activeGameId) {
        throw new Error('No active game.');
      }
      return submitGuess(apiKey.trim(), activeGameId, {
        target_index: payload.targetIndex,
        guess: payload.guess,
        target_signature: payload.targetSignature,
      });
    },
    onSuccess: () => {
      setGuessText('');
      setGuessError(null);
      invalidate();
    },
    onError: (err: Error) => setGuessError(err.message),
  });

  const handleSubmitGuess = useCallback(() => {
    const slot = selectedWordSlot ?? primaryWordSlot;
    if (!slot) {
      setGuessError('No target word selected.');
      return;
    }
    const raw = guessText ?? '';
    const cleaned = raw.trim().toUpperCase();
    const lettersOnly = cleaned.replace(/[^A-Z]/g, '');
    if (lettersOnly !== cleaned) {
      setGuessError('Letters only (A–Z).');
      return;
    }
    const expectedLen = slot.length ?? targetLengths[slot.targetIndex] ?? 0;
    const backendExpectedLen =
      slot.targetIndex != null
        ? metaLengthByTargetIndex.get(slot.targetIndex) ??
          gameState?.target_lengths?.[slot.targetIndex]
        : undefined;
    if (
      Number.isFinite(backendExpectedLen) &&
      backendExpectedLen !== expectedLen
    ) {
      setGuessError(
        `Internal mismatch: UI says ${expectedLen} letters but server expects ${backendExpectedLen} for targetIndex ${slot.targetIndex}.`,
      );
      return;
    }
    if (lettersOnly.length !== expectedLen) {
      setGuessError(`Must be exactly ${expectedLen} letters.`);
      return;
    }
    setGuessError(null);
    console.log('SUBMIT_FULL', {
      displayWord: selectedDisplayIndex,
      key: slot.key,
      targetIndex: slot.targetIndex,
      targetSignature: slot.signature,
      expectedLen,
      backendExpectedLen,
      guess: lettersOnly,
      guessLen: lettersOnly.length,
    });
    guessMutation.mutate({
      targetIndex: Number(slot.targetIndex),
      guess: lettersOnly,
      targetSignature: slot.signature,
    });
  }, [
    gameState,
    guessMutation,
    guessText,
    metaLengthByTargetIndex,
    primaryWordSlot,
    selectedDisplayIndex,
    selectedWordSlot,
    targetLengths,
  ]);

  const isBoardUnlocked = gameState?.status === 'active';
  const boardTargetIndex = isGameWon ? null : resolvedSelectedTargetIndex;
  const boardTargetClue =
    isGameWon
      ? null
      : selectedWordSlot?.clueNumber ?? primaryWordSlot?.clueNumber ?? null;

  const groupedHistoryMap = useMemo(() => {
    // Build a stable history map keyed by the canonical word key.
    const map = new Map<string, GuessEntry[]>();
    const grouped = gameState?.your_history_grouped ?? {};
    for (const [rawKey, guesses] of Object.entries(grouped)) {
      const normalizedKey = String(rawKey);
      const numericKey = Number(normalizedKey);
      const slotKey =
        (!Number.isNaN(numericKey) && wordKeyByTargetIndex.has(numericKey)
          ? wordKeyByTargetIndex.get(numericKey)
          : undefined) ??
        (wordsByKey.has(normalizedKey) ? normalizedKey : undefined) ??
        wordSlots.find((slot) => slot.key === normalizedKey)?.key;
      if (!slotKey) {
        continue;
      }
      map.set(slotKey, guesses as GuessEntry[]);
    }
    return map;
  }, [gameState?.your_history_grouped, wordKeyByTargetIndex, wordsByKey, wordSlots]);

  const groupedHistoryList = useMemo(
    () =>
      wordSlots.map((slot) => ({
        slot,
        guesses: groupedHistoryMap.get(slot.key) ?? [],
      })),
    [wordSlots, groupedHistoryMap],
  );

  const solvedWordsByTarget = useMemo(() => {
    const map: Record<number, string> = {};
    groupedHistoryList.forEach(({ slot, guesses }) => {
      const targetIdx = slot.targetIndex;
      const expectedLen = slot.length ?? targetLengths[targetIdx] ?? 0;
      if (!expectedLen) return;
      const solvedEntry = guesses.find(
        (entry) =>
          (entry.codes?.length ?? 0) === expectedLen &&
          (entry.guess?.length ?? 0) === expectedLen &&
          (entry.codes || []).every((code) => code === 'G'),
      );
      if (solvedEntry?.guess) {
        map[targetIdx] = solvedEntry.guess.toUpperCase();
      }
    });
    return map;
  }, [groupedHistoryList, targetLengths]);

  const getCodePalette = useCallback((code: string) => {
    const blueColor = colors.blue ?? '#2F6FED';
    switch ((code || '').toUpperCase()) {
      case 'G':
        return {
          background: colors.green,
          text: colors.parchment,
          label: 'Correct letter in the correct spot',
        };
      case 'Y':
        return {
          background: colors.yellow,
          text: colors.ink,
          label: 'Letter exists but in a different position',
        };
      case 'R':
        return {
          background: colors.red,
          text: colors.parchment,
          label: 'Letter not present in the opponent word',
        };
      case 'B':
        return {
          background: blueColor,
          text: colors.parchment,
          label: 'Blue hint tile',
        };
      default:
        return {
          background: colors.muted,
          text: colors.parchment,
          label: 'Feedback unavailable',
        };
    }
  }, []);

  const renderCodes = useCallback(
    (codes: string[], useAtlanticStyles = false, guessText?: string, wrapTiles = false) => {
      const values = codes && codes.length > 0 ? codes : ['-'];
      const rowStyle = useAtlanticStyles
        ? (wrapTiles ? atlanticStyles.codeRowWrapped : atlanticStyles.codeRow)
        : styles.codeRow;
      const cellStyle = useAtlanticStyles ? atlanticStyles.codeCell : styles.codeCell;
      const letterStyle = useAtlanticStyles ? atlanticStyles.codeLetter : styles.codeLetter;
      return (
        <View style={rowStyle}>
          {values.map((rawCode, codeIndex) => {
            const palette = getCodePalette(rawCode);
            const display = guessText && codeIndex < guessText.length
              ? guessText[codeIndex].toUpperCase()
              : (rawCode || '-').toUpperCase();
            return (
              <View
                key={`code-${codeIndex}`}
                style={[cellStyle, { backgroundColor: palette.background }]}
                accessibilityLabel={palette.label}
              >
                <Text style={[letterStyle, { color: palette.text }]}>{display}</Text>
              </View>
            );
          })}
        </View>
      );
    },
    [getCodePalette],
  );

  const getGuessesForKey = useCallback(
    (wordKey: string) => groupedHistoryMap.get(wordKey) ?? [],
    [groupedHistoryMap],
  );

  const getPreferredOrLatestGuessForKey = useCallback(
    (wordKey: string): GuessEntry | null => {
      const guesses = getGuessesForKey(wordKey);
      if (guesses.length === 0) return null;
      const targetIndex = wordSlots.find((slot) => slot.key === wordKey)?.targetIndex ?? 0;
      const preferredIdx = selectedGuessIndexByWord[targetIndex];
      if (preferredIdx != null && preferredIdx >= 0 && preferredIdx < guesses.length) {
        return guesses[preferredIdx]!;
      }
      return guesses[guesses.length - 1]!;
    },
    [getGuessesForKey, selectedGuessIndexByWord, wordSlots],
  );

  const blueLetterEntries = useMemo(() => {
    const confirmedCount: Record<string, number> = {};
    const greenPlacedCount: Record<string, number> = {};

    // Each guess entry proves a lower bound on letter counts for non-grey feedback.
    // We track the strongest (max) non-grey count per letter across entries so the blues remain count-aware.
    for (const guesses of groupedHistoryMap.values()) {
      for (const entry of guesses) {
        const codes = entry.codes ?? [];
        const guess = (entry.guess ?? '').toUpperCase();
        const len = Math.min(codes.length, guess.length);
        const entryNonGreyCount: Record<string, number> = {};

        for (let pos = 0; pos < len; pos++) {
          const code = (codes[pos] ?? '').toUpperCase();
          const letter = guess[pos];
          if (!letter || !/[A-Z]/.test(letter)) continue;

          if (code === 'G') {
            // Greens represent letters already placed, so they reduce the available global blue supply.
            greenPlacedCount[letter] = (greenPlacedCount[letter] ?? 0) + 1;
          }

          if (code === 'G' || code === 'Y' || code === 'B') {
            // Non-grey codes prove the letter exists in the puzzle; track how many occurrences this entry confirmed.
            entryNonGreyCount[letter] = (entryNonGreyCount[letter] ?? 0) + 1;
          }
        }

        for (const [letter, count] of Object.entries(entryNonGreyCount)) {
          confirmedCount[letter] = Math.max(confirmedCount[letter] ?? 0, count);
        }
      }
    }

    const availableBlues: Array<[string, number]> = [];
    for (const [letter, confirmed] of Object.entries(confirmedCount)) {
      const placedGreens = greenPlacedCount[letter] ?? 0;
      // Yellows have already proved the letter exists but do not subtract from the blue inventory.
      const available = Math.max(0, confirmed - placedGreens);
      if (available > 0) {
        availableBlues.push([letter, available]);
      }
    }

    // Alphabetical order keeps the UI predictable for a novice.
    return availableBlues.sort(([a], [b]) => a.localeCompare(b));
  }, [groupedHistoryMap]);

  // Wordle-on-board: preferred-or-latest guess + codes for the selected target word, for board overlay
  const selectedWordKeyValue = selectedWordSlot?.key ?? primaryWordSlot?.key ?? '';
  const { latestGuessText, latestGuessCodes } = useMemo(() => {
    const entry = getPreferredOrLatestGuessForKey(selectedWordKeyValue);
    return {
      latestGuessText: entry?.guess ?? '',
      latestGuessCodes: entry?.codes ?? [],
    };
  }, [getPreferredOrLatestGuessForKey, selectedWordKeyValue]);

  const bannerSubtitle = useMemo(() => {
    if (!activeGameId) {
      return 'Create or join a duel to reveal the board.';
    }
    if (!gameState) {
      return 'Preparing opponent layout...';
    }
    const statusLabel = (gameState.status ?? 'waiting').toUpperCase();
    return canSubmitGuess ? `Status: ${statusLabel} - Your turn` : `Status: ${statusLabel} - Opponent thinking`;
  }, [activeGameId, gameState, canSubmitGuess]);

  const turnTitle = canSubmitGuess
    ? `Your turn, ${username}!`
    : `Waiting on ${gameState?.opponent?.user_id ? `Player ${gameState.opponent.user_id}` : 'opponent'}`;
  const boardStatusLabel = (gameState?.status ?? 'waiting').toUpperCase();

  // Atlantic skin: layout matches AtlanticBoardPreview (header, turn banner, board frame, clues)
  if (USE_ATLANTIC_SKIN) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={atlanticStyles.screen}>
        <ScrollView contentContainerStyle={atlanticStyles.scroll}>
          <View style={atlanticStyles.header}>
            <Pressable onPress={() => navigation.navigate('Lobby')} style={atlanticStyles.headerAction}>
              <Text style={atlanticStyles.headerActionText}>{'←'}</Text>
            </Pressable>
            <View style={atlanticStyles.headerCenter}>
              <Text style={atlanticStyles.headerBrand}>CrosSwords</Text>
              <Text style={atlanticStyles.headerSub}>
                • GAME {activeGameId ?? '—'}
              </Text>
            </View>
            <View style={atlanticStyles.headerAction} />
          </View>

          {!activeGameId ? (
            <View style={atlanticStyles.card}>
              <Text style={atlanticStyles.bodyText}>Join or create a game to unlock the board.</Text>
              <Pressable onPress={() => navigation.navigate('Lobby')} style={atlanticStyles.ctaButton}>
                <Text style={atlanticStyles.ctaButtonText}>Go to Lobby</Text>
              </Pressable>
            </View>
          ) : error ? (
            <View style={atlanticStyles.card}>
              <Text style={atlanticStyles.errorText}>{error.message}</Text>
              <Pressable onPress={() => invalidate()} style={atlanticStyles.ctaButton}>
                <Text style={atlanticStyles.ctaButtonText}>Retry</Text>
              </Pressable>
            </View>
          ) : !gameState ? (
            <View style={atlanticStyles.card}>
              <Text style={atlanticStyles.bodyMuted}>Loading game state…</Text>
              <Pressable onPress={() => invalidate()} style={atlanticStyles.ctaButton}>
                <Text style={atlanticStyles.ctaButtonText}>Refresh</Text>
              </Pressable>
            </View>
          ) : isBoardUnlocked ? (
            <>
              {isGameWon ? (
                <View style={atlanticStyles.card}>
                  <Text style={atlanticStyles.cardHeading}>Victory secured!</Text>
                  <Text style={atlanticStyles.bodyMuted}>All five opponent words are solved.</Text>
                  <Pressable onPress={() => navigation.navigate('Lobby')} style={atlanticStyles.ctaButton}>
                    <Text style={atlanticStyles.ctaButtonText}>Return to lobby</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  {/* Atlantic: Duel section + turn banner — clean card rhythm, no borders */}
                  <View style={atlanticStyles.duelCard}>
                    <Text style={atlanticStyles.duelTitle}>Duel!</Text>
                    <Text style={atlanticStyles.duelSubtitle}>
                      {canSubmitGuess ? 'YOUR TURN' : 'OPPONENT THINKING'}
                    </Text>
                  </View>
                  <View style={[atlanticStyles.turnBanner, !canSubmitGuess && atlanticStyles.turnBannerMuted]}>
                    <Text style={atlanticStyles.turnText}>
                      {canSubmitGuess ? 'YOUR TURN' : 'OPPONENT TURN'}
                    </Text>
                  </View>
                  {__DEV__ && (gameState?.debug_bot_words?.length ?? 0) > 0 ? (
                    <View style={atlanticStyles.debugBotWordsCard}>
                      <Text style={atlanticStyles.debugBotWordsHeader}>BOT WORDS</Text>
                      <Text style={atlanticStyles.debugBotWordsBody}>
                        {gameState!.debug_bot_words!.join(' · ')}
                      </Text>
                    </View>
                  ) : null}
                  <View style={atlanticStyles.boardFrame}>
                    <View
                      style={[
                        atlanticStyles.boardCenterWrap,
                        { minHeight: Math.max(320, windowHeight * 0.45) },
                      ]}
                    >
                      {maskedSegments.length > 0 ? (
                          <View
                            style={{ width: '100%', alignItems: 'center' }}
                            onLayout={(e) => setBoardWidth(e.nativeEvent.layout.width)}
                          >
                            <BoardView
                              maskedSegments={maskedSegments}
                              revealedCoords={revealedCoords}
                              activeTargetIndex={boardTargetIndex ?? undefined}
                              activeClueNumber={boardTargetClue ?? undefined}
                              activeGuessText={latestGuessText}
                              activeGuessCodes={latestGuessCodes}
                              targetsMeta={targetsMeta}
                              availableWidth={boardWidth ?? undefined}
                              solvedWordsByTarget={solvedWordsByTarget}
                              onTilePress={handleBoardTilePress}
                              useAtlanticMode
                          />
                        </View>
                      ) : (
                        <Text style={atlanticStyles.bodyMuted}>Opponent board unlocking…</Text>
                      )}
                    </View>
                  </View>
                  {/* Left rail + right stage: rail = numbers; stage = list (default) or detail */}
                  <View style={atlanticStyles.wordCardsCard}>
                    <View style={atlanticStyles.railRow}>
                      <View style={atlanticStyles.rail}>
                        {wordSlots.map((slot) => {
                          const isSelected = resolvedSelectedTargetIndex === slot.targetIndex;
                          return (
                            <Pressable
                              key={`rail-${slot.key}`}
                              onPress={() => {
                                const now = Date.now();
                                const last = lastTapRef.current;
                                const isDouble =
                                  last != null &&
                                  last.targetIndex === slot.targetIndex &&
                                  now - last.ts < DOUBLE_TAP_MS &&
                                  slot.targetIndex === resolvedSelectedTargetIndex &&
                                  stageMode === 'detail';
                                if (isDouble) {
                                  setStageMode('list');
                                  lastTapRef.current = null;
                                  return;
                                }
                                setSelectedTargetIndex(slot.targetIndex);
                                setStageMode('detail');
                                lastTapRef.current = { targetIndex: slot.targetIndex, ts: now };
                              }}
                              style={[
                                atlanticStyles.railBadge,
                                isSelected && atlanticStyles.railBadgeSelected,
                              ]}
                            >
                              <Text style={atlanticStyles.railBadgeText}>{slot.displayIndex}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                                            <View style={atlanticStyles.stagePanel}>
                        <ScrollView
                          style={atlanticStyles.stageScroll}
                          contentContainerStyle={atlanticStyles.stageScrollContent}
                          showsVerticalScrollIndicator
                        >
                          {stageMode === 'list' ? (
                            <View style={atlanticStyles.listStage}>
                              {wordSlots.map((slot) => {
                                const preferred = getPreferredOrLatestGuessForKey(slot.key);
                                return (
                                  <Pressable
                                    key={`list-row-${slot.key}`}
                                    style={atlanticStyles.listRow}
                                    onPress={() => {
                                      setSelectedTargetIndex(slot.targetIndex);
                                      setStageMode('detail');
                                      guessInputRef.current?.focus();
                                    }}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Select word ${slot.displayIndex}`}
                                  >
                                    {preferred != null ? (
                                      renderCodes(preferred.codes || [], true, preferred.guess ?? '', true)
                                    ) : (
                                      <View style={atlanticStyles.codeRowWrapped}>
                                        {Array.from({
                                          length: Math.max(1, slot.length ?? targetLengths[slot.targetIndex] ?? 5),
                                        }).map((_, idx) => (
                                          <View key={`placeholder-${slot.key}-${idx}`} style={[atlanticStyles.codeCell, atlanticStyles.codeCellPlaceholder]}>
                                            <Text style={atlanticStyles.codeLetter}>{' '}</Text>
                                          </View>
                                        ))}
                                      </View>
                                    )}
                                  </Pressable>
                                );
                              })}
                            </View>
                          ) : (
                            <View style={atlanticStyles.detailStage}>
                              <View style={atlanticStyles.detailHeaderRow}>
                                <Text style={atlanticStyles.detailHeaderText}>
                                  {selectedSlotLength ?? '-'} letters
                                  {solvedFlags[resolvedSelectedTargetIndex] ? ' • Solved ✓' : ''}
                                </Text>
                                {selectedGuessIndexByWord[resolvedSelectedTargetIndex] != null && (
                                  <Pressable
                                    onPress={() => setSelectedGuessIndex(resolvedSelectedTargetIndex, null)}
                                    style={atlanticStyles.clearLockButton}
                                    hitSlop={8}
                                  >
                                    <Text style={atlanticStyles.clearLockText}>⇧</Text>
                                  </Pressable>
                                )}
                              </View>
                              {(() => {
                                const guesses = getGuessesForKey(selectedWordKeyValue);
                                const lockedIndex = selectedGuessIndexByWord[resolvedSelectedTargetIndex];
                                const lockedEntry =
                                  typeof lockedIndex === 'number' ? guesses[lockedIndex] : undefined;
                                const otherGuesses =
                                  typeof lockedIndex === 'number'
                                    ? guesses.filter((_, idx) => idx !== lockedIndex)
                                    : guesses;

                                return (
                                  <>
                                    {lockedEntry ? (
                                      <Pressable
                                        key={`hist-${selectedWordKeyValue}-locked`}
                                        style={[atlanticStyles.guessRow, atlanticStyles.guessRowLocked]}
                                        onLongPress={() => setSelectedGuessIndex(resolvedSelectedTargetIndex, null)}
                                        accessibilityLabel="Locked guess (long press to unlock)"
                                      >
                                        {renderCodes(lockedEntry.codes || [], true, lockedEntry.guess, true)}
                                      </Pressable>
                                    ) : null}
                                    {otherGuesses.length > 0 ? (
                                      <ScrollView
                                        ref={historyScrollRef}
                                        style={atlanticStyles.historyScrollArea}
                                        contentContainerStyle={atlanticStyles.historyScrollContent}
                                        onContentSizeChange={() => historyScrollRef.current?.scrollToEnd({ animated: true })}
                                        showsVerticalScrollIndicator
                                      >
                                        {otherGuesses.map((entry, gIdx) => {
                                          return (
                                            <Pressable
                                              key={`hist-${selectedWordKeyValue}-${gIdx}`}
                                              onPress={() => {
                                                const originalIndex =
                                                  typeof lockedIndex === 'number' && gIdx >= lockedIndex
                                                    ? gIdx + 1
                                                    : gIdx;
                                                setSelectedGuessIndex(resolvedSelectedTargetIndex, originalIndex);
                                              }}
                                              style={[atlanticStyles.guessRow]}
                                            >
                                              {renderCodes(entry.codes || [], true, entry.guess, true)}
                                            </Pressable>
                                          );
                                        })}
                                      </ScrollView>
                                    ) : (
                                      <View style={atlanticStyles.codeRowWrapped}>
                                        {Array.from({
                                          length: Math.max(1, selectedSlotLength ?? targetLengths[resolvedSelectedTargetIndex] ?? 5),
                                        }).map((_, idx) => (
                                          <View key={`placeholder-detail-${selectedWordKeyValue}-${idx}`} style={[atlanticStyles.codeCell, atlanticStyles.codeCellPlaceholder]}>
                                            <Text style={atlanticStyles.codeLetter}>{' '}</Text>
                                          </View>
                                        ))}
                                      </View>
                                    )}
                                  </>
                                );
                              })()}
                              {blueLetterEntries.length > 0 && (
                                <View style={atlanticStyles.blueChipsRow}>
                                  {blueLetterEntries.map(([letter, count]) => (
                                    <View key={letter} style={atlanticStyles.blueChip}>
                                      <Text style={atlanticStyles.blueChipText}>{letter}: {count}</Text>
                                    </View>
                                  ))}
                                </View>
                              )}
                            </View>
                          )}
                        </ScrollView>
                        {stageMode === 'detail' ? (
                          <View style={atlanticStyles.guessFooter}>
                            <Pressable
                              onPress={() => guessInputRef.current?.focus()}
                              style={[
                                atlanticStyles.letterRow,
                                (!canSubmitGuess || guessMutation.isPending) && atlanticStyles.guessBarDisabled,
                              ]}
                              accessibilityRole="button"
                              accessibilityLabel="Enter your guess"
                            >
                              {Array.from({ length: Math.max(1, selectedSlotLength ?? 5) }).map((_, idx) => {
                                const char = guessText[idx] ?? '';
                                return (
                                  <View key={`letter-${idx}`} style={atlanticStyles.letterBox}>
                                    <Text style={atlanticStyles.letterBoxText}>{char || ' '}</Text>
                                  </View>
                                );
                              })}
                            </Pressable>
                            <TextInput
                              ref={guessInputRef}
                              style={atlanticStyles.hiddenInput}
                              value={guessText}
                              onChangeText={handleGuessChange}
                              maxLength={Math.max(1, selectedSlotLength ?? 10)}
                              autoCapitalize="characters"
                              autoCorrect={false}
                              editable={!guessMutation.isPending}
                              onSubmitEditing={handleSubmitGuess}
                              blurOnSubmit={false}
                            />
                            <Pressable
                              onPress={handleSubmitGuess}
                              disabled={!canSubmitGuess || guessMutation.isPending || guessText.length === 0}
                              style={({ pressed }) => [
                                atlanticStyles.ctaButton,
                                (!canSubmitGuess || guessMutation.isPending || guessText.length === 0) &&
                                  atlanticStyles.guessBarDisabled,
                                pressed && atlanticStyles.ctaButtonPressed,
                              ]}
                            >
                              <Text style={atlanticStyles.ctaButtonText}>Submit</Text>
                            </Pressable>
                            {guessError ? <Text style={atlanticStyles.errorText}>{guessError}</Text> : null}
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>
                    {/* Dev helper box: shows the opponent/bot submissions while debugging. */}
                    {shouldShowDeveloperBox ? (
                      <View style={atlanticStyles.devBox}>
                        <Text style={atlanticStyles.devBoxHeader}>DEVELOPER VIEW — TARGET WORDS</Text>
                        <Text style={atlanticStyles.devBoxNote}>
                          Shows the opponent/bot submissions so you can sanity-check scoring. This only renders in dev.
                        </Text>
                        {developerTargetWords.length > 0 ? (
                          <View style={atlanticStyles.devPillRow}>
                            {developerTargetWords.map((word) => (
                              <View key={`dev-word-${word}`} style={atlanticStyles.devPill}>
                                <Text style={atlanticStyles.devPillText}>{word}</Text>
                              </View>
                            ))}
                          </View>
                        ) : (
                          <Text style={atlanticStyles.devBoxNote}>
                            No debug words from the server. Enable DEBUG_REVEAL_SOLUTIONS in FastAPI to reveal them.
                          </Text>
                        )}
                      </View>
                    ) : null}
                </>
              )}
            </>
          ) : (
            <View style={atlanticStyles.card}>
              <Text style={atlanticStyles.cardHeading}>
                {gameState?.status === 'finished' ? 'Game over' : 'Board locked'}
              </Text>
              <Text style={atlanticStyles.bodyMuted}>
                {gameState?.status === 'finished'
                  ? 'Return to lobby to start a new game.'
                  : 'Submit words and mark Ready in Pre-Game.'}
              </Text>
              <Pressable
                onPress={() => navigation.navigate(gameState?.status === 'finished' ? 'Lobby' : 'PreGame')}
                style={atlanticStyles.ctaButton}
              >
                <Text style={atlanticStyles.ctaButtonText}>
                  {gameState?.status === 'finished' ? 'Return to Lobby' : 'Go to Pre-Game'}
                </Text>
              </Pressable>
            </View>
          )}

          <ThemePicker />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <RopeRule thin />
        <Banner title="CrosSwords Board" subtitle={bannerSubtitle} />
        {!activeGameId ? (
          <Text style={styles.infoText}>Join or create a game from the lobby to unlock the board.</Text>
        ) : null}
        {error ? <Text style={[styles.infoText, styles.errorText]}>{error.message}</Text> : null}

        {!gameState || error ? (
          <View style={styles.lockedCard}>
            <Text style={styles.lockedHeading}>Board unavailable</Text>
            <Text style={styles.lockedCopy}>Submit words and mark Ready in the lobby to kick things off.</Text>
            <Pressable
              onPress={() => invalidate()}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.secondaryButtonPressed,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Refresh state</Text>
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('Lobby')}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.secondaryButtonPressed,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Return to lobby</Text>
            </Pressable>
          </View>
        ) : null}

        {gameState && isBoardUnlocked ? (
          <View style={styles.boardCard}>
            {isGameWon ? (
              <View style={styles.victoryCard}>
                <Text style={styles.victoryTitle}>Victory secured!</Text>
                <Text style={styles.victoryCopy}>All five opponent words are solved. Great work!</Text>
                <Pressable
                  onPress={() => navigation.navigate('Lobby')}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.victoryButton,
                    pressed && styles.victoryButtonPressed,
                  ]}
                >
                  <Text style={styles.victoryButtonText}>Return to lobby</Text>
                </Pressable>
              </View>
            ) : (
              <Banner title={turnTitle} subtitle={`Status: ${boardStatusLabel}`} />
            )}

            <RopeRule />

            {maskedSegments.length === 0 ? (
              <Text style={styles.infoText}>Opponent board will unlock once they submit their words.</Text>
            ) : (
              <View style={styles.boardViewSection}>
                <BoardView
                  maskedSegments={maskedSegments}
                  revealedCoords={revealedCoords}
                  activeTargetIndex={boardTargetIndex ?? undefined}
                  activeClueNumber={boardTargetClue ?? undefined}
                  solvedWordsByTarget={solvedWordsByTarget}
                  onTilePress={handleBoardTilePress}
                  targetsMeta={targetsMeta}
                />
              </View>
            )}

            <RopeRule />

            <View style={styles.clueSection}>
              <Text style={styles.clueHeading}>Clue Scrolls</Text>
              <View style={styles.clueColumns}>
                {[CLUE_LIST_LEFT, CLUE_LIST_RIGHT].map((list, columnIndex) => (
                  <View key={`clue-column-${columnIndex}`} style={styles.clueColumn}>
                    {list.map((entry) => (
                      <Text key={entry} style={styles.clueText}>
                        {entry}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            </View>

            {!isGameWon ? (
              <View style={styles.guessSection}>
                <Text style={styles.sectionHeading}>Submit a guess</Text>
                <Text style={styles.infoText}>Choose the target word slot (1-5) then type your guess.</Text>
                <GuessTargetSelector
                  slots={wordSlots}
                  activeTargetIndex={resolvedSelectedTargetIndex}
                  onSelect={setSelectedTargetIndex}
                />
                <Text style={styles.infoText}>
                  Guess length: {(selectedSlotLength ?? 5)} letters
                </Text>
                <GuessBar
                  value={guessText}
                  onChangeText={handleGuessChange}
                  onSubmitGuess={handleSubmitGuess}
                  disabled={!canSubmitGuess || guessMutation.isPending}
                />
                {guessError ? <Text style={[styles.infoText, styles.errorText]}>{guessError}</Text> : null}
                {!canSubmitGuess ? (
                  <Text style={styles.infoText}>Guessing unlocks when it is your turn and the game is active.</Text>
                ) : null}
              </View>
            ) : null}

            <View style={styles.historySection}>
              <Text style={styles.sectionHeading}>Your guess history</Text>
              {groupedHistoryList.length === 0 ? (
                <Text style={styles.infoText}>No guesses yet.</Text>
              ) : (
                groupedHistoryList.map(({ slot, guesses }) => {
                  const targetLength = slot.length ?? targetLengths[slot.targetIndex] ?? '?';
                  const isSolved = solvedFlags[slot.targetIndex] ?? false;
                  return (
                    <View key={`history-${slot.key}`} style={styles.historyGroup}>
                      <View style={styles.historyHeaderRow}>
                        <Text style={styles.historyTitle}>Word {slot.displayIndex}</Text>
                        <View style={styles.historyMetaRow}>
                          <Text style={styles.historyMetaText}>Length: {targetLength}</Text>
                          {isSolved ? <Text style={styles.solvedBadge}>Solved</Text> : null}
                        </View>
                      </View>
                      {guesses.map((entry, idx) => (
                        <View key={`guess-${slot.key}-${idx}`} style={styles.historyRow}>
                          <View style={styles.historyGuessBlock}>
                            <Text style={styles.historyGuess}>{entry.guess}</Text>
                            <Text style={styles.historyTime}>{new Date(entry.created_at).toLocaleTimeString()}</Text>
                          </View>
                          {renderCodes(entry.codes || [])}
                        </View>
                      ))}
                    </View>
                  );
                })
              )}
            </View>
          </View>
        ) : null}

        {/* Dev helper box: surfaces the opponent/bot submissions while debugging. */}
        {shouldShowDeveloperBox ? (
          <View style={styles.devBox}>
            <Text style={styles.devBoxHeader}>Developer view — target words</Text>
            <Text style={styles.devBoxNote}>
              This temporary box surfaces the opponent/bot submissions so you can verify feedback while debugging.
            </Text>
            {developerTargetWords.length > 0 ? (
              <View style={styles.devPillRow}>
                {developerTargetWords.map((word) => (
                  <View key={`dev-word-${word}`} style={styles.devPill}>
                    <Text style={styles.devPillText}>{word}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.devBoxNote}>
                No debug words available from the server. Turn on DEBUG_REVEAL_SOLUTIONS to populate this list.
              </Text>
            )}
          </View>
        ) : null}

        <RopeRule thin />
        <View style={styles.iconShelf}>
          {ICON_PLACEHOLDERS.map((slot) => (
            <View key={`icon-placeholder-${slot}`} style={styles.iconPlaceholder} />
          ))}
        </View>
        <Text style={styles.iconCaption}>Relic slots - artwork arriving soon.</Text>

        <ThemePicker />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.parchment,
  },
  container: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 24,
    backgroundColor: colors.parchment,
  },
  infoText: {
    fontFamily: 'LibreBaskerville_400Regular',
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
  },
  errorText: {
    color: colors.red,
  },
  lockedCard: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderRadius: 0,
    paddingVertical: 24,
    paddingHorizontal: 12,
    gap: 16,
    alignItems: 'center',
  },
  lockedHeading: {
    fontFamily: 'CinzelDecorative_700Bold',
    fontSize: 22,
    color: colors.ink,
  },
  lockedCopy: {
    fontFamily: 'LibreBaskerville_400Regular',
    fontSize: 15,
    color: colors.muted,
    textAlign: 'center',
  },
  secondaryButton: {
    width: '100%',
    borderRadius: 0,
    borderWidth: 1,
    borderColor: colors.rope,
    backgroundColor: '#FBF1DD',
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonPressed: {
    opacity: 0.85,
  },
  secondaryButtonText: {
    fontFamily: 'LibreBaskerville_400Regular',
    fontSize: 15,
    color: colors.ink,
  },
  boardCard: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderRadius: 0,
    paddingVertical: 24,
    paddingHorizontal: 0,
    gap: 24,
  },
  boardViewSection: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  clueSection: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderRadius: 0,
    paddingVertical: 12,
    paddingHorizontal: 0,
    gap: 12,
  },
  clueHeading: {
    fontFamily: 'CinzelDecorative_700Bold',
    fontSize: 20,
    color: colors.ink,
    textAlign: 'center',
  },
  clueColumns: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 24,
  },
  clueColumn: {
    flex: 1,
    gap: 8,
  },
  clueText: {
    fontFamily: 'LibreBaskerville_400Regular',
    fontSize: 14,
    color: colors.ink,
    lineHeight: 20,
  },
  guessSection: {
    gap: 12,
    borderWidth: 0,
    borderRadius: 0,
    paddingVertical: 18,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
  },
  sectionHeading: {
    fontFamily: 'CinzelDecorative_700Bold',
    fontSize: 18,
    color: colors.ink,
    textAlign: 'center',
  },
  targetSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  targetPill: {
    width: 54,
    height: 54,
    borderRadius: 0,
    borderWidth: 2,
    borderColor: colors.rope,
    backgroundColor: '#FFF5E4',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 0,
    elevation: 2,
  },
  targetPillActive: {
    backgroundColor: colors.gold,
    borderColor: colors.ink,
    shadowOpacity: 0.9,
  },
  targetPillPressed: {
    opacity: 0.85,
  },
  targetPillText: {
    fontFamily: 'CinzelDecorative_700Bold',
    fontSize: 22,
    color: colors.ink,
  },
  historySection: {
    gap: 12,
  },
  historyGroup: {
    borderWidth: 0,
    borderRadius: 0,
    paddingVertical: 12,
    paddingHorizontal: 0,
    gap: 10,
    backgroundColor: 'transparent',
  },
  historyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyMetaText: {
    fontFamily: 'LibreBaskerville_400Regular',
    fontSize: 12,
    color: colors.muted,
  },
  historyTitle: {
    fontFamily: 'CinzelDecorative_700Bold',
    fontSize: 16,
    color: colors.ink,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  historyGuessBlock: {
    gap: 4,
  },
  historyGuess: {
    fontFamily: 'CinzelDecorative_700Bold',
    fontSize: 16,
    color: colors.ink,
    letterSpacing: 1,
  },
  historyTime: {
    fontFamily: 'LibreBaskerville_400Regular',
    fontSize: 12,
    color: colors.muted,
  },
  codeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  codeCell: {
    minWidth: 28,
    minHeight: 28,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  codeLetter: {
    fontFamily: 'CinzelDecorative_700Bold',
    fontSize: 13,
    color: colors.ink,
  },
  solvedBadge: {
    borderRadius: 0,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.gold,
    color: colors.ink,
    fontFamily: 'CinzelDecorative_700Bold',
    fontSize: 12,
  },
  victoryCard: {
    borderWidth: 0,
    borderRadius: 0,
    paddingVertical: 18,
    gap: 12,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  victoryTitle: {
    fontFamily: 'CinzelDecorative_700Bold',
    fontSize: 22,
    color: colors.ink,
    textAlign: 'center',
  },
  victoryCopy: {
    fontFamily: 'LibreBaskerville_400Regular',
    fontSize: 15,
    color: colors.muted,
    textAlign: 'center',
  },
  victoryButton: {
    borderRadius: 0,
    backgroundColor: colors.gold,
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: 'center',
  },
  victoryButtonPressed: {
    opacity: 0.85,
  },
  victoryButtonText: {
    fontFamily: 'CinzelDecorative_700Bold',
    fontSize: 16,
    color: colors.ink,
  },
  devBox: {
    marginTop: 16,
    padding: 12,
    borderWidth: 2,
    borderColor: colors.rope,
    backgroundColor: '#FFF9EC',
    gap: 8,
  },
  devBoxHeader: {
    fontFamily: 'CinzelDecorative_700Bold',
    fontSize: 14,
    color: colors.ink,
  },
  devBoxNote: {
    fontFamily: 'LibreBaskerville_400Regular',
    fontSize: 12,
    color: colors.muted,
  },
  devPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  devPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#ECE6D6',
    borderWidth: 1,
    borderColor: colors.ink,
  },
  devPillText: {
    fontFamily: 'CinzelDecorative_700Bold',
    fontSize: 13,
    color: colors.ink,
    letterSpacing: 0.5,
  },
  iconShelf: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  iconPlaceholder: {
    flex: 1,
    height: 68,
    borderRadius: 0,
    borderWidth: 2,
    borderColor: colors.rope,
    backgroundColor: '#FBF1DD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCaption: {
    fontFamily: 'LibreBaskerville_400Regular',
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
  },
});

// Atlantic skin styles — clean, spacious, minimal, high-contrast. Card rhythm: padding 16, gap 12.
const atlanticStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f0f0f0' },
  scroll: { flexGrow: 1, paddingHorizontal: 16, paddingBottom: 32, gap: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  headerAction: { width: 50, alignItems: 'center' },
  headerActionText: { fontSize: 18, color: '#000' },
  headerCenter: { alignItems: 'center', flex: 1 },
  headerBrand: {
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 14,
    letterSpacing: 1,
    color: '#000',
  },
  headerSub: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 12,
    letterSpacing: 1,
    color: '#000',
  },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    gap: 12,
  },
  duelCard: {
    backgroundColor: '#fff',
    padding: 16,
    gap: 4,
  },
  duelTitle: {
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 22,
    letterSpacing: 1,
    color: '#000',
  },
  duelSubtitle: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 12,
    letterSpacing: 1,
    color: '#555',
  },
  turnBanner: {
    backgroundColor: MOTIF_RED,
    paddingVertical: 10,
    alignItems: 'center',
  },
  turnBannerMuted: { backgroundColor: '#888' },
  turnText: {
    color: '#fff',
    fontFamily: tAtlantic.typography.displayFamily,
    letterSpacing: 1.5,
    fontSize: 14,
  },
  boardFrame: {
    backgroundColor: '#fff',
    padding: 16,
    gap: 8,
    alignItems: 'center',
  },
  boardCenterWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  boardViewSection: {
    alignItems: 'center',
    maxWidth: '100%',
  },
  cardHeading: {
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 14,
    letterSpacing: 1,
    color: '#000',
  },
  bodyText: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 14,
    color: '#000',
    lineHeight: 20,
  },
  bodyMuted: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 12,
    color: '#555',
    lineHeight: 18,
  },
  wordCardsCard: {
    backgroundColor: '#fff',
    padding: 16,
    gap: 12,
  },
  railRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  rail: {
    width: 56,
    flexShrink: 0,
    flexDirection: 'column',
    gap: 12,
    alignItems: 'center',
  },
  railBadge: {
    width: 36,
    height: 36,
    backgroundColor: MOTIF_RED,
    justifyContent: 'center',
    alignItems: 'center',
  },
  railBadgeSelected: {
    borderWidth: 2,
    borderColor: '#000',
  },
  railBadgeText: {
    color: '#fff',
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 16,
  },
  stagePanel: {
    flex: 1,
    minWidth: 0,
    paddingLeft: 12,
  },
  stageScroll: {
    maxHeight: 320,
  },
  stageScrollContent: {
    paddingBottom: 12,
    gap: 8,
  },
  listStage: {
    flexDirection: 'column',
    gap: 12,
  },
  listRow: {
    minHeight: 36,
    justifyContent: 'center',
  },
  listPromptLine: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 12,
    letterSpacing: 1,
    color: '#999',
  },
  detailStage: {
    gap: 6,
  },
  historyScrollArea: {
    maxHeight: 220,
  },
  historyScrollContent: {
    gap: 6,
    paddingBottom: 6,
  },
  detailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailHeaderText: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 12,
    color: '#555',
  },
  clearLockButton: {
    padding: 4,
  },
  clearLockText: {
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 14,
    color: MOTIF_RED,
  },
  blueChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  blueChip: {
    backgroundColor: '#2F6FED',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  blueChipText: {
    color: '#fff',
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 12,
    letterSpacing: 1,
  },
  debugBotWordsCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e2e2',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  debugBotWordsHeader: {
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 11,
    letterSpacing: 1,
    color: '#666',
    marginBottom: 4,
  },
  debugBotWordsBody: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 14,
    color: '#333',
    flexWrap: 'wrap',
  },
  devBox: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e2e2',
    marginHorizontal: 16,
    marginTop: -4,
    gap: 8,
  },
  devBoxHeader: {
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 13,
    letterSpacing: 1,
    color: '#000',
  },
  devBoxNote: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 12,
    color: '#666',
  },
  devPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  devPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#eef2ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5ff',
  },
  devPillText: {
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 13,
    color: '#111',
    letterSpacing: 0.8,
  },
  guessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  guessRowLocked: {
    borderColor: MOTIF_RED,
    backgroundColor: '#fffbfb',
  },
  wordCardsList: { gap: 8 },
  wordCardBlock: { gap: 0 },
  promptLine: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 12,
    letterSpacing: 1,
    color: '#999',
  },
  accordionPanel: {
    paddingTop: 12,
    paddingLeft: 44,
    gap: 8,
  },
  accordionHeading: {
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 12,
    letterSpacing: 1,
    color: '#333',
  },
  wordCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  wordCardRowSelected: {
    borderColor: MOTIF_RED,
    backgroundColor: '#fffbfb',
  },
  wordCardBadge: {
    width: 32,
    height: 32,
    backgroundColor: MOTIF_RED,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wordCardBadgeText: {
    color: '#fff',
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 14,
  },
  wordCardTextBlock: { flex: 1, gap: 2 },
  wordCardTitle: {
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 14,
    letterSpacing: 1,
    color: '#000',
  },
  wordCardSubtitle: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 12,
    color: '#555',
  },
  hintsCard: {
    backgroundColor: '#fff',
    padding: 16,
    gap: 12,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hintGuessText: {
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 14,
    color: '#000',
    letterSpacing: 1,
    minWidth: 80,
  },
  codeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  codeRowWrapped: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  codeCell: {
    minWidth: 28,
    minHeight: 28,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  codeLetter: {
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 13,
  },
  codeCellPlaceholder: {
    borderColor: '#000',
    borderWidth: 1,
  },
  guessSection: {
    backgroundColor: '#fff',
    padding: 16,
    gap: 12,
  },
  guessLabel: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 12,
    color: '#555',
  },
  guessBarDisabled: { opacity: 0.65 },
  guessFooter: {
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: '#e7e7e7',
  },
  letterRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  letterBox: {
    width: 30,
    height: 30,
    borderWidth: 1,
    borderRadius: 4,
    borderColor: '#000',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  letterBoxText: {
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 16,
    letterSpacing: 1,
    color: '#000',
  },
  hiddenInput: { position: 'absolute', opacity: 0, height: 1, width: 1 },
  ctaButtonPressed: { opacity: 0.9 },
  ctaButton: {
    backgroundColor: MOTIF_RED,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  ctaButtonText: {
    color: '#fff',
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 16,
  },
  errorText: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 14,
    color: MOTIF_RED,
  },
});
/**
 * LEGACY FILE — archived on purpose. Not imported anywhere. Do not revive without explicit decision.
 */
