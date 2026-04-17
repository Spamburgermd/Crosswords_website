/**
 * src/screens/BoardScreen.tsx
 * ---------------------------------------------
 * Atlantic-only board screen. The legacy/non-Atlantic UI is archived in
 * src/screens/BoardScreen.legacy.tsx to prevent accidental reintroduction.
 */

import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated as RNAnimated,
  Easing,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';

import BoardView from '@components/BoardView';
import GameKeyboard from '@components/GameKeyboard';
import ThemePicker from '@components/ThemePicker';
import { RootStackParamList } from '@src/navigation/AppNavigator';
import { isServerFunctionsEnabled, SHOW_DEV_TARGET_WORDS } from '@src/flags';
import { DESIGN_TOKEN_SETS } from '@src/theme/designTokens';
import colors from '@src/theme/colors';
import { useTilePalette, codeToTileFromPalette } from '@src/theme/tilePalette';
import { buildCardDisplayState, type CardDetailRow } from '@src/lib/cardDisplayState';
import { scoreGuess } from '@lib/guessScoring';
import { type FeedbackGuessEntry } from '@lib/evidenceFeedback';
import {
  buildIntersectionMap,
  buildIntersectionPositionsByTarget,
  buildFullIntersectionMap,
} from '@src/lib/boardRevealMap';
import {
  buildConfirmedLettersByTargetFromCoordMap,
} from '@src/lib/confirmedBoardLetters';
import { buildBoardSplitHistory } from '@src/lib/boardHistoryPipeline';
import { computeBlueTickerEntries } from '@src/lib/blueTickerLogic';
import { collectNewGreenIntersectionMotifs } from '@src/lib/greenMotifTrigger';
import { buildKeyboardLetterStates } from '@src/lib/keyboardLetterStates';
import {
  getPerfNow,
  type DevUiPerfMetrics,
  type DevUiPerfRenderCounts,
} from '@src/lib/devUiPerf';
import {
  formatDevUiPerfLog,
  type DevUiPerfLogEntry,
} from '@src/lib/devUiPerfLog';
import { isNetworkPvPMode, shouldForceLocalScoring } from '@src/lib/modeGuards';
import { getTargetWordsForGame } from '@src/lib/targetWordsProvider';
import type { GuessEntry, MaskedSegment } from '@schemas/api';
import { useGameState } from '@hooks/useGameState';
import useSessionStore from '@stores/sessionStore';
import useUIStore from '@stores/uiStore';
import { appendLocalGuessResult, deleteSession, getSession, getBotSession, subscribe, updateBotSession, recordResultFromSession, recordBotResult } from '@src/localChallenge/localChallengeStore';
import { isCurrentDailySession, reconcileDailySessions } from '@src/localChallenge/dailyLifecycle';
import {
  canonicalizeDictionaryId,
  getDictionaryMeta,
  getGuessValidationDictionaryId,
  getWordsForDictionary,
  isValidGuessWord,
} from '@src/dictionary/dictionaryAdapter';
import {
  buildCanonicalWordSlots,
  type CanonicalWordSlot,
  type TargetMeta,
} from '@src/utils/wordSlots';
import AlphabetSidePanel from '@components/AlphabetSidePanel';
import MotifDropOverlay from '@components/MotifDropOverlay';
import { useMotifDrop } from '@src/animations/useMotifDrop';
import { totalRevealMs } from '@src/animations/revealTiming';
import { generateBotMove, getBotThinkingDelay } from '@src/bots/botEngine';
import { createShuffledPool } from '@src/utils/shuffledPool';
import {
  beginRevealOwnership,
  resolveRevealTargetIndex,
  type RevealOwnership,
} from '@src/lib/revealOwnership';

const tAtlantic = DESIGN_TOKEN_SETS.atlantic;
const MOTIF_RED = '#E7131A';
const EMPTY_DEV_RENDER_COUNTS: DevUiPerfRenderCounts = {
  boardScreen: 0,
  boardView: 0,
  detailStage: 0,
};
const EMPTY_DEV_UI_PERF: DevUiPerfMetrics = {
  pendingActionLabel: null,
  lastActionLabel: null,
  lastActionToCommitMs: null,
  lastAfterPaintMs: null,
  lastRevealCompleteMs: null,
  lastExpectedRevealMs: null,
  lastRevealOverrunMs: null,
  splitHistoryMs: null,
  cardDisplayMs: null,
  boardTileCount: 0,
  boardDiagnosticsCount: 0,
  detailRowCount: 0,
  combinedRowCount: 0,
  selectedTargetIndex: null,
  revealTargetIndex: null,
  renderCounts: EMPTY_DEV_RENDER_COUNTS,
};
const DUEL_PLAYER_TURN_TAUNTS = [
  'En garde, wordsmith!',
  'I hope you\'ve been practicing.',
  'Prepare yourself — I shan\'t go easy.',
  'Draw your letters. I draw mine.',
  'Another challenger approaches. Charming.',
  'Shall we dance?',
  'You look nervous. Good.',
  'The game is afoot!',
  'Steel yourself. The duel begins.',
  'Let us see what mettle you carry today.',
  'I\'ve been warming up all day for this.',
  'Was that a guess or a cry for help?',
  'My grandmother guesses with more precision.',
  'A miss! Perhaps try opening your eyes?',
  'Bold strategy — guessing blindfolded.',
  'I\'ve seen better attempts from a parrot.',
  'Your technique is... unorthodox. And wrong.',
  'Surely you jest.',
  'Is that your final answer? How unfortunate.',
  'That guess had all the elegance of a falling anvil.',
  'You swing wide, friend. Very wide.',
  'I admire the confidence, if not the accuracy.',
  'Ticktock. The hourglass weeps for you.',
  'You\'re stalling. I can feel it.',
  'Nervous? You should be.',
  'Are you thinking, or have you fallen asleep?',
  'Do you always take this long to think?',
  'The Force is not with you today.',
  'Search your feelings. You know that guess was wrong.',
  'I\'ve got a bad feeling about this... for you.',
  'You keep using that word. I do not think it means what you think it means.',
  'Truly, you have a dizzying intellect.',
  'Life is pain, highness. So is that guess.',
  'You rush a word game, you get rotten words.',
  'As you wish... to be defeated.',
  'Once more unto the breach, dear friend!',
  'If words be the food of victory, play on!',
  'Cry havoc, and let slip the words of war!',
  'Now is the winter of your discontent.',
  'The lady doth guess too wildly, methinks.',
  'Lord, what fools these guessers be!',
  'There are more letters in heaven and earth than are dreamt of in your guesses.',
  'All the world\'s a stage, and you\'re fumbling your lines.',
  'To guess or not to guess — that is the question. And you\'re choosing poorly.',
  'Brevity is the soul of wit. So why are you taking so long?',
  'Something is rotten in the state of your vocabulary.',
  'Double, double, toil and trouble — your guesses bubble.',
  'It\'s a fine day for a duel, wouldn\'t you say?',
  'Stand and deliver — your five letters, if you please.',
  'My dear fellow, even a blindfolded pirate could do better.',
  'You swing like a man who\'s never held a sword — or a dictionary.',
  'I\'ve crossed swords with kings and pirates. You\'ll do for a warm-up.',
  'There\'s a shortage of perfect words in this world. Let\'s not waste yours.',
  'You should have stayed in whatever system you crawled out of.',
  'You came at the king, you best not miss. And you missed.',
  'You better wake up. The world you live in is just a sugar-coated topping.',
];
const DUEL_BOT_TURN_TAUNTS = [
  'I could solve this with my eyes closed.',
  'My wit is sharper than any blade.',
  'This is the part where you panic.',
  'Some are born to the blade. Others... fumble.',
  'You remind me of a young duelist I once defeated. Easily.',
  'The suspense is killing me. Well, it\'s killing you.',
  'I once bested three wordsmiths before breakfast.',
  'I am not left-handed either.',
  'I find your lack of vowels disturbing.',
  'You fell victim to one of the classic blunders!',
  'Have fun storming the castle! ...You\'ll need it.',
  'There\'s not a lot of money in revenge. But word games? Priceless.',
  'Anybody want a peanut? No? Back to the game then.',
  'You\'re trying to trick me into giving away the answer. It won\'t work.',
  'Stay on target... stay on target...',
  'It\'s a trap! Oh wait, that\'s just your strategy.',
  'You underestimate the power of the dark side of the alphabet.',
  'Do or do not. There is no try. And you are not doing.',
  'I sense great fear in you, wordsmith.',
  'The Force is strong with this one. Me, I mean.',
  'There are worse things out tonight than vampires. Like me.',
  'You\'re not a threat. You\'re a snack.',
  'The Daywalker doesn\'t lose. Neither do I.',
  'I could fight you and pour a glass of wine at the same time.',
  'You\'re outmatched, outclassed, and outvoweled.',
  'I\'ve dueled better opponents while swinging from a chandelier.',
  'What a piece of work is man — and what a piece of work was that guess.',
  'I have studied my words. You clearly have not.',
  'I make this look easy because, for me, it is.',
];
const DUEL_PLAYER_WIN_LINES = [
  'Well played. Enjoy it — it won\'t happen again.',
  'You got lucky. Luck is a fickle ally.',
  'I let you win. For morale.',
  'A touch! I acknowledge it. This time.',
  'Impressive. Perhaps you\'re not entirely hopeless.',
  'You win this round. But the war is far from over.',
  'Even the finest blade slips now and then.',
  'A worthy hit! I salute you... grudgingly.',
  'Don\'t let it go to your head. I have a long memory.',
  'Bravo. Now do it again. I dare you.',
  'Strong with the Force, you are. For now.',
  'The apprentice has bested the master. Temporarily.',
  'You got heart, kid. I\'ll give you that.',
  'As you wish. This round is yours.',
  'I admit it — you are better than I am.',
  'Death cannot stop true love. And apparently neither can I.',
  'O happy dagger — wait, that\'s yours. Well played.',
  'Though she be but little, she is fierce. And so are you.',
  'I tip my hat to you. But I\'m keeping my sword.',
  'You\'ve bested me — this time. I\'ll be back with a better mustache and sharper words.',
  'Not bad. But the night is still young.',
];
const DUEL_BOT_WIN_LINES = [
  'My name is not important. What matters is — I win.',
  'A fine duel! You nearly had me. Nearly.',
  'The better blade prevails. As is tradition.',
  'Bow before the superior wordsmith.',
  'Another victory. I shall add it to the collection.',
  'Good night, sweet prince. Your words have failed you.',
  'Alas, poor player — I knew your weakness well.',
  'Bravo! Well fought. But not well enough.',
  'And so the curtain falls — on you.',
  'I\'d offer a rematch, but why embarrass you twice?',
  'Too easy. I expected more from you.',
  'You seem a decent fellow. I hate to beat you.',
  'There is nothing like a good thrust, wouldn\'t you say?',
  'My blade finds its mark. As always.',
  'Ah, the sweet taste of a word well-won.',
  'Did you see that? Poetry in motion.',
  'I\'d apologize, but I\'m not sorry.',
  'Point! Perhaps you\'d prefer a simpler game?',
  'Swift. Clean. Devastating. That\'s my style.',
  'The steel sings true!',
  'I almost feel guilty. Almost.',
  'And the crowd goes silent...',
  'That, my friend, is how it\'s done.',
  'Another touch! I could do this all day.',
  'The circle is now complete. I am the master.',
  'I have the high ground. And the right letters.',
  'This is the way.',
  'Inconceivable that you thought you\'d win this one.',
  'Get used to disappointment.',
  'The quality of mercy is not strained. But my patience is.',
  'I came, I saw, I conquered — your word.',
  'Some achieve greatness. I just guessed it.',
  'Another letter falls to my rapier wit.',
  'A clean hit! The crowd loves it — and so do I.',
  'The dark side of the alphabet is a pathway to many words some consider... unguessable.',
  'Your journey to the dark side is complete. You\'ve lost.',
  'I want my five letters back, you son of a wordsmith.',
  'Thank you. I\'ve been waiting for this duel my whole life.',
  'The rest is silence... yours, specifically.',
  'Off with their consonants!',
  'Parting is such sweet sorrow. For you. I feel great.',
  'A more dashing victory you\'ll never see.',
  'Another day, another duel won with style.',
  'Game over, daywalker.',
  'Some people frost. I bring the whole blizzard.',
  'Mischief managed. And by mischief, I mean you.',
  'You thought you could ice-skate uphill? Against me?',
];
// Shuffle pools — module-level so they persist across matches for the app session.
const playerTurnPool = createShuffledPool(DUEL_PLAYER_TURN_TAUNTS);
const botTurnPool = createShuffledPool(DUEL_BOT_TURN_TAUNTS);
const playerWinPool = createShuffledPool(DUEL_PLAYER_WIN_LINES);
const botWinPool = createShuffledPool(DUEL_BOT_WIN_LINES);
// Atlantic density knobs for quick tuning.
const TILE = 28;
const TILE_COMPACT = 24; // History tiles: tighter density.
const ROW_PAD = 6;
const ROW_PAD_COMPACT = 4; // History rows: tighter touch area but still tappable.

type DetailHistoryStageItem = CardDetailRow<{
  rowId: string;
  guess: string;
  codes: string[];
  provenance?: string;
}>;

type DetailHistoryStageProps = {
  detailHistoryItems: DetailHistoryStageItem[];
  selectedTargetIndex: number;
  intersectionPositions?: Set<number>;
  renderCodes: (
    codes: string[],
    useAtlanticStyles?: boolean,
    guessText?: string,
    wrapTiles?: boolean,
    compact?: boolean,
    crossPositions?: Set<number>,
    tight?: boolean,
  ) => React.ReactNode;
  onPreviewRow: (rowId: string) => void;
  onToggleLockRow: (rowId: string, isLocked: boolean) => void;
  devRenderCountsRef?: React.MutableRefObject<DevUiPerfRenderCounts> | null;
};

const DetailHistoryStage = React.memo(function DetailHistoryStage({
  detailHistoryItems,
  selectedTargetIndex,
  intersectionPositions,
  renderCodes,
  onPreviewRow,
  onToggleLockRow,
  devRenderCountsRef,
}: DetailHistoryStageProps): React.JSX.Element {
  if (__DEV__ && devRenderCountsRef) {
    devRenderCountsRef.current.detailStage += 1;
  }

  return (
    <View style={atlanticStyles.detailStage}>
      {detailHistoryItems.length > 0 &&
        detailHistoryItems.map((entry, historyIndex) => {
          const isLast = historyIndex === detailHistoryItems.length - 1;
          const isInformational = entry.provenance === 'shadow';
          return (
            <Pressable
              key={`hist-${selectedTargetIndex}-${entry.rowId}`}
              onPress={() => {
                if (isInformational || (entry.isPreviewed && !entry.isLocked)) {
                  return;
                }
                onPreviewRow(entry.rowId);
              }}
              onLongPress={() => {
                if (isInformational) {
                  return;
                }
                onToggleLockRow(entry.rowId, entry.isLocked);
              }}
              accessibilityLabel={
                isInformational
                  ? 'Informational cross-history row'
                  : entry.isLocked
                    ? 'Locked guess row'
                    : 'Guess row'
              }
              style={[
                atlanticStyles.guessRow,
                atlanticStyles.guessRowCompact,
                isInformational && atlanticStyles.guessRowInformational,
                isLast && { borderBottomWidth: 0, paddingBottom: ROW_PAD_COMPACT },
              ]}
            >
              <View style={atlanticStyles.historyContentCluster}>
                {renderCodes(
                  entry.codes || [],
                  true,
                  entry.guess,
                  true,
                  true,
                  intersectionPositions,
                  true,
                )}
                <View style={atlanticStyles.historyMarkerGutter}>
                  {isInformational ? (
                    <Text style={atlanticStyles.historyInfoLabel}>INFO</Text>
                  ) : null}
                  {entry.isLocked ? <View style={atlanticStyles.historyLockBullet} /> : null}
                </View>
              </View>
            </Pressable>
          );
        })}
    </View>
  );
});
// Corner accent knobs (L brackets around board) — independent axes for easy tuning.
// CORNER_INSET_H = 0: left/right edges flush with boardFrame, matching statusRail width.
// CORNER_INSET_V = 2: minimal top/bottom inset — just enough breathing room from frame edge.
// Body paddingHorizontal:16 keeps right corner 16dp from screen — clear of Samsung Edge panel.
const CORNER_INSET_H = 0;
const CORNER_INSET_V = 2;
const CORNER_OUTER_WIDTH = 70;   // horizontal run length
const CORNER_OUTER_HEIGHT = 220;  // vertical run length
const CORNER_OUTER_STROKE_H = 3; // horizontal stroke thickness
const CORNER_OUTER_STROKE_V = 3; // vertical stroke thickness
const CORNER_INNER_GAP = 6;
const CORNER_INNER_WIDTH = CORNER_OUTER_WIDTH - CORNER_INNER_GAP * 2;
const CORNER_INNER_HEIGHT = CORNER_OUTER_HEIGHT - CORNER_INNER_GAP * 2;
const CORNER_INNER_STROKE_H = 2;
const CORNER_INNER_STROKE_V = 2;
const CORNER_RADIUS = 2;
const MOTIF_BLUE = colors.blue ?? '#2F6FED';

function getWordPoolByDictionaryId(raw: string | null | undefined): string[] {
  return getWordsForDictionary(canonicalizeDictionaryId(raw));
}

type BoardScreenNavigation = NativeStackNavigationProp<RootStackParamList, 'Board'>;
type BoardRoute = RouteProp<RootStackParamList, 'Board'>;

type WordSlot = CanonicalWordSlot;

export default function BoardScreen(): React.JSX.Element {
  const navigation = useNavigation<BoardScreenNavigation>();
  const route = useRoute<BoardRoute>();
  const mode: 'pvp' | 'solo' | 'bot' = route.params?.mode ?? 'pvp';
  const sessionId = route.params?.sessionId ?? null;
  const serverEnabled = isServerFunctionsEnabled();
  const networkPvPMode = isNetworkPvPMode(mode, serverEnabled);
  const { apiKey, activeGameId } = useSessionStore();
  const localNumericId =
    mode === 'pvp'
      ? null
      : Number.parseInt(String(sessionId ?? '').replace(/\D/g, '').slice(-6) || '1', 10);
  const activeIdForUI = mode === 'pvp' ? activeGameId : localNumericId;
  const insets = useSafeAreaInsets(); // Keep bottom content above Android gesture bar.
  const [isAlphaOpen, setIsAlphaOpen] = useState(false);
  const [revealEpoch, setRevealEpoch] = useState(0);
  const [revealOwnership, setRevealOwnership] = useState<RevealOwnership | null>(null);
  const [crossHistoryBlockedTarget, setCrossHistoryBlockedTarget] = useState<number | null>(null);
  const revealResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const crossHistoryResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRevealPerfRef = useRef<{
    startedAtMs: number;
    targetIndex: number;
    expectedDurationMs: number;
  } | null>(null);
  const revealTargetIndex = resolveRevealTargetIndex(revealOwnership, Date.now());

  const startRevealWindow = useCallback((targetIndex: number, wordLength: number) => {
    const delay = totalRevealMs(wordLength);

    if (revealResetTimeoutRef.current) {
      clearTimeout(revealResetTimeoutRef.current);
    }
    if (crossHistoryResetTimeoutRef.current) {
      clearTimeout(crossHistoryResetTimeoutRef.current);
    }

    if (__DEV__) {
      pendingRevealPerfRef.current = {
        startedAtMs: getPerfNow(),
        targetIndex,
        expectedDurationMs: delay,
      };
    }
    setRevealOwnership(beginRevealOwnership(targetIndex, Date.now(), delay));
    setCrossHistoryBlockedTarget(targetIndex);

    revealResetTimeoutRef.current = setTimeout(() => {
      setRevealOwnership((current) => (current?.targetIndex === targetIndex ? null : current));
      revealResetTimeoutRef.current = null;
    }, delay);

    crossHistoryResetTimeoutRef.current = setTimeout(() => {
      setCrossHistoryBlockedTarget((current) => (current === targetIndex ? null : current));
      crossHistoryResetTimeoutRef.current = null;
    }, delay);
  }, []);

  useEffect(() => {
    return () => {
      if (revealResetTimeoutRef.current) {
        clearTimeout(revealResetTimeoutRef.current);
      }
      if (crossHistoryResetTimeoutRef.current) {
        clearTimeout(crossHistoryResetTimeoutRef.current);
      }
      pendingRevealPerfRef.current = null;
    };
  }, []);

  const apiKeyForServer = networkPvPMode && apiKey.trim().length > 0 ? apiKey : null;
  const activeIdForServer = networkPvPMode ? activeGameId : null;

  const { data: serverGameState, error: serverError, invalidate } = useGameState(
    apiKeyForServer,
    activeIdForServer,
  );

  const localSession = networkPvPMode ? null : getSession(sessionId);
  const soloSession = mode === 'solo' && localSession && localSession.mode !== 'bot' ? localSession : null;

  // ─── Daily puzzle turn-limit tracking ────────────────────
  const isDailyPuzzle = !!(soloSession?.dailyDate);
  const dailyTurnLimit = soloSession?.guessTurnLimit ?? null;
  const totalGuessesUsed = soloSession?.state.guessesByTarget
    ? soloSession.state.guessesByTarget.reduce((sum, g) => sum + g.length, 0)
    : 0;

  // Make botSession reactive to updates
  const [botSessionSnapshot, setBotSessionSnapshot] = useState<ReturnType<typeof getBotSession>>(
    mode === 'bot' ? getBotSession(sessionId) : null
  );

  useEffect(() => {
    if (mode !== 'bot') return;

    // Subscribe to session changes
    const unsubscribe = subscribe(() => {
      const updated = getBotSession(sessionId);
      setBotSessionSnapshot(updated);
    });

    return unsubscribe;
  }, [mode, sessionId]);

  const botSession = mode === 'bot' ? botSessionSnapshot : null;
  const [isBotThinking, setIsBotThinking] = useState(false);
  const botBanterEnabled = useUIStore((s) => s.botBanterEnabled);
  const darkModeEnabled = useUIStore((s) => s.darkModeEnabled);
  const tilePalette = useTilePalette();
  const boardScreenBg = darkModeEnabled ? '#121212' : tAtlantic.colors.screenBackground;
  const darkCard = darkModeEnabled ? { backgroundColor: '#1b1b1b', borderColor: '#2d2d2d' } : null;
  const darkText = darkModeEnabled ? { color: '#f2f2f2' } : null;
  const darkMuted = darkModeEnabled ? { color: '#b8b8b8' } : null;
  const darkDivider = darkModeEnabled ? { borderColor: '#303030' } : null;
  const darkInputBox = darkModeEnabled ? { backgroundColor: '#202020', borderColor: '#3a3a3a' } : null;
  const [dailyEntryValidated, setDailyEntryValidated] = useState(() =>
    !(mode === 'solo' && !!soloSession?.dailyDate),
  );

  useEffect(() => {
    if (mode !== 'solo' || !soloSession?.dailyDate) {
      setDailyEntryValidated(true);
      return;
    }

    let cancelled = false;
    const now = new Date();
    setDailyEntryValidated(false);

    void reconcileDailySessions(now)
      .then(() => {
        if (cancelled) return;
        const currentSession = getSession(sessionId);
        if (!isCurrentDailySession(currentSession, now)) {
          navigation.replace('Lobby');
          return;
        }
        setDailyEntryValidated(true);
      })
      .catch(() => {
        if (cancelled) return;
        const currentSession = getSession(sessionId);
        if (!isCurrentDailySession(currentSession, now)) {
          navigation.replace('Lobby');
          return;
        }
        setDailyEntryValidated(true);
      });

    return () => {
      cancelled = true;
    };
  }, [mode, navigation, sessionId, soloSession?.dailyDate]);

  const localGameState = useMemo(() => {
    // For bot mode, use player's state
    if (mode === 'bot' && botSession) {
      const state = botSession.playerState as any;
      return state
        ? {
            ...state,
            status: botSession.status === 'active' ? 'active' : 'finished',
            your_solved: state.your_solved ?? state.solvedByTarget ?? [],
            me: state.me ?? { user_id: 1, words_submitted: true, ready: true },
            opponent: state.opponent ?? { user_id: 2 },
          }
        : null;
    }

    // For solo/pvp mode, use regular session
    if (!soloSession) return null;
    const state = soloSession.state as any;
    return state
      ? {
          ...state,
          status: 'active' as const,
          your_solved: state.your_solved ?? state.solvedByTarget ?? [],
          me: state.me ?? { user_id: 1, words_submitted: true, ready: true },
          opponent: state.opponent ?? { user_id: 2 },
        }
      : null;
  }, [soloSession, botSession, mode]);

  const gameState = networkPvPMode ? serverGameState : localGameState;
  const error = networkPvPMode ? serverError : null;
  const localTargetWords = useMemo(() => {
    if (mode === 'bot') return botSession?.playerTargets ?? null;
    if (mode === 'solo') return soloSession?.targets ?? null;
    return null;
  }, [mode, botSession?.playerTargets, soloSession?.targets]);

  useEffect(() => {
    if (mode === 'pvp' && !serverEnabled) {
      // Defensive guard: a pvp board cannot run without server features.
      navigation.replace('Lobby');
    }
  }, [mode, serverEnabled, navigation]);

  const {
    guessViewStateByTarget,
    previewGuessByRowId,
    lockGuessByRowId,
    unlockGuess,
    clearGuessView,
    setActiveGameId,
  } = useSessionStore();
  const [stageMode, setStageMode] = useState<'list' | 'detail'>('list');
  const lastTapRef = useRef<{ targetIndex: number; ts: number } | null>(null);
  const DOUBLE_TAP_MS = 300;
  const [guessText, setGuessText] = useState('');
  const [guessError, setGuessError] = useState<string | null>(null);
  const stageScrollRef = useRef<ScrollView | null>(null);
  const GUESS_FOOTER_HEIGHT = 66;
  const [scrollAreaHeight, setScrollAreaHeight] = useState(0);
  const devUiPerfEnabled = __DEV__;
  const pendingUiPerfActionRef = useRef<{ label: string; startedAtMs: number } | null>(null);
  const splitHistoryPerfMsRef = useRef<number | null>(null);
  const cardDisplayPerfMsRef = useRef<number | null>(null);
  const devRenderCountsRef = useRef<DevUiPerfRenderCounts>({ ...EMPTY_DEV_RENDER_COUNTS });
  const [isDevUiPerfLogging, setIsDevUiPerfLogging] = useState(false);
  const [devUiPerfLogEntries, setDevUiPerfLogEntries] = useState<DevUiPerfLogEntry[]>([]);
  const [devUiPerf, setDevUiPerf] = useState<DevUiPerfMetrics | null>(
    devUiPerfEnabled ? { ...EMPTY_DEV_UI_PERF } : null,
  );
  if (devUiPerfEnabled) {
    devRenderCountsRef.current.boardScreen += 1;
  }
  const scrollMaxHeight =
    scrollAreaHeight > 0
      ? Math.max(0, scrollAreaHeight - (stageMode === 'detail' ? GUESS_FOOTER_HEIGHT : 0))
      : null;
  const [boardWidth, setBoardWidth] = useState<number | null>(null);
  const [computedTileSize, setComputedTileSize] = useState<number | null>(null);
  const [boardCropInfo, setBoardCropInfo] = useState<{ minRow: number; minCol: number; rows: number; cols: number } | null>(null);
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const listBoardHeight = Math.min(320, windowHeight * 0.45);
  const scrollStageToEnd = useCallback(() => {
    stageScrollRef.current?.scrollToEnd({ animated: true });
  }, []);
  const markDevUiPerfAction = useCallback((label: string) => {
    if (!devUiPerfEnabled) return;
    const startedAtMs = getPerfNow();
    pendingUiPerfActionRef.current = { label, startedAtMs };
    setDevUiPerf((prev) => ({
      ...(prev ?? EMPTY_DEV_UI_PERF),
      pendingActionLabel: label,
    }));
  }, [devUiPerfEnabled]);
  const clearDevUiPerfAction = useCallback((label?: string) => {
    if (!devUiPerfEnabled) return;
    pendingUiPerfActionRef.current = null;
    setDevUiPerf((prev) => ({
      ...(prev ?? EMPTY_DEV_UI_PERF),
      pendingActionLabel: null,
      lastActionLabel: label ?? prev?.lastActionLabel ?? null,
      lastActionToCommitMs: null,
      lastAfterPaintMs: null,
    }));
  }, [devUiPerfEnabled]);
  const appendDevUiPerfLogEntry = useCallback((entry: DevUiPerfLogEntry) => {
    if (!devUiPerfEnabled || !isDevUiPerfLogging) return;
    setDevUiPerfLogEntries((prev) => [...prev, entry]);
  }, [devUiPerfEnabled, isDevUiPerfLogging]);
  const handleCopyDevUiPerfLog = useCallback(async () => {
    if (!devUiPerfEnabled) return;
    if (devUiPerfLogEntries.length === 0) {
      Alert.alert('No log entries', 'Run a few interactions before copying the UI perf log.');
      return;
    }
    try {
      await Clipboard.setStringAsync(formatDevUiPerfLog(devUiPerfLogEntries));
      Alert.alert('UI perf log copied', 'The JSON log is now on the clipboard.');
    } catch (error) {
      Alert.alert('Copy failed', error instanceof Error ? error.message : 'Could not copy the UI perf log.');
    }
  }, [devUiPerfEnabled, devUiPerfLogEntries]);
  const handleClearDevUiPerfLog = useCallback(() => {
    setDevUiPerfLogEntries([]);
  }, []);

  // Scroll to latest guess when entering detail mode.
  useEffect(() => {
    if (stageMode === 'detail') {
      setTimeout(() => scrollStageToEnd(), 50);
    }
  }, [stageMode, scrollStageToEnd]);

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

  const wordsByKey = useMemo(() => new Map(wordSlots.map((slot) => [slot.key, slot])), [wordSlots]);
  const wordKeyByTargetIndex = useMemo(
    () => new Map(wordSlots.map((slot) => [slot.targetIndex, slot.key])),
    [wordSlots],
  );
  const slotByTargetIndex = useMemo(
    () => new Map(wordSlots.map((slot) => [slot.targetIndex, slot])),
    [wordSlots],
  );

  // ── Motif drop animation (pool of 3 for concurrent intersection drops) ──
  const motifDrop0 = useMotifDrop();
  const motifDrop1 = useMotifDrop();
  const motifDrop2 = useMotifDrop();
  const motifDropPool = useMemo(() => [motifDrop0, motifDrop1, motifDrop2], [motifDrop0, motifDrop1, motifDrop2]);
  const motifDropNextRef = useRef(0);
  const triggerNextMotif = useCallback((x: number, y: number, size: number, delay: number) => {
    const idx = motifDropNextRef.current % motifDropPool.length;
    motifDropNextRef.current = idx + 1;
    motifDropPool[idx].trigger(x, y, size, delay);
  }, [motifDropPool]);

  const boardContainerRef = useRef<View>(null);
  const prevSolvedRef = useRef<boolean[]>([]);
  const solvedMotifInitRef = useRef(true);
  const greenMotifInitRef = useRef(true);
  const prevGreenIntersectionCoordsRef = useRef(new Set<string>());
  // Shared coord-level celebration guard: once any motif path schedules a drop
  // for an intersection tile, no later path may schedule that same coord again.
  const motifFiredCoordsRef = useRef(new Set<string>());

  // Build coord→targetIndices lookup for intersection detection
  const coordToTargetIndices = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const slot of wordSlots) {
      for (const [r, c] of slot.coords) {
        const key = `${r}:${c}`;
        const existing = map.get(key) ?? [];
        existing.push(slot.targetIndex);
        map.set(key, existing);
      }
    }
    return map;
  }, [wordSlots]);

  const intersectionMap = useMemo(() => buildIntersectionMap(wordSlots), [wordSlots]);
  const fullIntersectionMap = useMemo(() => buildFullIntersectionMap(wordSlots), [wordSlots]);
  const intersectionPositionsByTarget = useMemo(
    () => buildIntersectionPositionsByTarget(wordSlots),
    [wordSlots],
  );

  // Fire motif drop on the first intersection tile when a word is solved
  useEffect(() => {
    const prev = prevSolvedRef.current;
    if (solvedFlags.length === 0) return;
    if (solvedMotifInitRef.current) {
      solvedMotifInitRef.current = false;
      prevSolvedRef.current = [...solvedFlags];
      return;
    }

    for (let ti = 0; ti < solvedFlags.length; ti++) {
      if (!solvedFlags[ti] || prev[ti]) continue; // not newly solved

      const slot = slotByTargetIndex.get(ti);
      if (!slot) continue;

      // Collect ALL intersection coords (shared squares) in this word
      const intersections: [number, number][] = [];
      for (const [r, c] of slot.coords) {
        const key = `${r}:${c}`;
        const targets = coordToTargetIndices.get(key);
        if (targets && targets.length >= 2) intersections.push([r, c]);
      }
      if (intersections.length === 0) continue;


      const GRID_SIZE = 10;
      const GAP = 2; // ATLANTIC_GAP
      const tileSize = computedTileSize ?? 32;

      // Normalize raw server coords the same way BoardView does:
      // center the puzzle in the 10×10 grid.
      // Must include revealedCoords in extents — BoardView does.
      let minRow = Infinity, minCol = Infinity;
      let maxRow = -Infinity, maxCol = -Infinity;
      for (const ws of wordSlots) {
        for (const [wr, wc] of ws.coords) {
          if (wr < minRow) minRow = wr;
          if (wc < minCol) minCol = wc;
          if (wr > maxRow) maxRow = wr;
          if (wc > maxCol) maxCol = wc;
        }
      }
      for (const [rr, rc] of revealedCoords) {
        if (rr < minRow) minRow = rr;
        if (rc < minCol) minCol = rc;
        if (rr > maxRow) maxRow = rr;
        if (rc > maxCol) maxCol = rc;
      }
      const nHeight = Math.max(1, maxRow - minRow + 1);
      const nWidth = Math.max(1, maxCol - minCol + 1);
      const center = Math.floor(GRID_SIZE / 2);
      const clamp = (off: number, span: number) => {
        if (span >= GRID_SIZE) return 0;
        let a = off;
        if (a < 0) a = 0;
        if (a + span - 1 >= GRID_SIZE) a = GRID_SIZE - span;
        return a;
      };
      const rowOff = clamp(Math.round(center - (nHeight - 1) / 2), nHeight);
      const colOff = clamp(Math.round(center - (nWidth - 1) / 2), nWidth);

      // Use crop info from BoardView (defaults to full 10×10 if unavailable)
      const crop = boardCropInfo ?? { minRow: 0, minCol: 0, rows: GRID_SIZE, cols: GRID_SIZE };
      const stageW = crop.cols * tileSize + (crop.cols - 1) * GAP;
      const stageH = crop.rows * tileSize + (crop.rows - 1) * GAP;
      // Capture board position now — all triggers fired synchronously so overlay
      // mounts before any flip starts, avoiding mid-flip re-render pauses.
      boardContainerRef.current?.measureInWindow((bx, by, bw, bh) => {
        if (bx == null || by == null) return;

        const gridOffX = bw != null ? (bw - stageW) / 2 : 0;
        const gridOffY = bh != null ? (bh - stageH) / 2 : 0;

        // Fire motif on the first unseen intersection only. This shared
        // coord-level guard also blocks later green-triggered celebrations
        // for the same tile when the crossing word resolves.
        for (const [r, c] of intersections) {
          const coordKey = `${r}:${c}`;
          if (motifFiredCoordsRef.current.has(coordKey)) continue;
          motifFiredCoordsRef.current.add(coordKey);

          const normRow = (r - minRow) + rowOff;
          const normCol = (c - minCol) + colOff;

          const tileLocalX = (normCol - crop.minCol) * (tileSize + GAP) + tileSize / 2;
          const tileLocalY = (normRow - crop.minRow) * (tileSize + GAP) + tileSize / 2;
          const screenX = bx + gridOffX + tileLocalX;
          const screenY = by + gridOffY + tileLocalY;

          // Delay motif until after this tile's flip completes
          const posInWord = slot.coords.findIndex(([wr, wc]) => wr === r && wc === c);
          const tileFlipEndMs = (posInWord >= 0 ? posInWord : 0) * 320 + 400;
          triggerNextMotif(screenX, screenY, tileSize - 2, tileFlipEndMs);
        }
      });
    }

    prevSolvedRef.current = [...solvedFlags];
  }, [solvedFlags, slotByTargetIndex, coordToTargetIndices, computedTileSize, triggerNextMotif, wordSlots, revealedCoords, boardCropInfo]);

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

  // Bot orchestration supports both:
  // - race: continuous bot loop (simultaneous feel)
  // - turns: one bot move only when activeTurn === 'bot'
  const botSessionId = botSession?.id ?? null;
  const botSessionStatus = botSession?.status ?? null;
  const botPlayStyle = botSession?.playStyle ?? 'race';
  const botActiveTurn = botSession?.activeTurn ?? 'player';
  const botDictionaryId = canonicalizeDictionaryId(botSession?.dictionaryId ?? 'core');
  const botCandidateWordsByLength = useMemo(() => {
    const source = getWordPoolByDictionaryId(botDictionaryId);
    const byLength = new Map<number, string[]>();
    for (const word of source as string[]) {
      const len = word.length;
      const list = byLength.get(len);
      if (list) list.push(word);
      else byLength.set(len, [word]);
    }
    return byLength;
  }, [botDictionaryId]);

  useEffect(() => {
    if (mode !== 'bot' || !botSessionId || botSessionStatus !== 'active') return;

    let cancelled = false;

    const runSingleBotMove = async () => {
      const current = getBotSession(sessionId);
      if (!current || current.status !== 'active') return;
      const botTargetWords = current.botState.targetWords ?? [];
      const botSolved = current.botState.solvedByTarget ?? [];
      const unsolvedIndex = botTargetWords.findIndex((_: string, idx: number) => !botSolved[idx]);
      if (unsolvedIndex === -1) return;

      const targetWord = botTargetWords[unsolvedIndex];
      const targetLength = targetWord.length;
      const previousGuesses = (current.botState.guessesByTarget[unsolvedIndex] ?? [])
        .map((g: any) => typeof g === 'string' ? g : g.guess);
      const previousFeedback = (current.botState.guessesByTarget[unsolvedIndex] ?? [])
        .filter((g: any) => typeof g !== 'string' && g.codes)
        .map((g: any) => ({ guess: g.guess, codes: g.codes }));

      // Wait for player's tile reveal animation to finish before bot starts thinking.
      const revealWait = revealWaitMsRef.current;
      if (revealWait > 0) {
        await new Promise((resolve) => setTimeout(resolve, revealWait));
        revealWaitMsRef.current = 0;
        if (cancelled) return;
      }

      const delay = getBotThinkingDelay(current.difficulty);
      setIsBotThinking(true);
      await new Promise((resolve) => setTimeout(resolve, delay));
      if (cancelled) return;

      const move = await generateBotMove({
        targetIndex: unsolvedIndex,
        targetLength,
        previousGuesses,
        previousFeedback,
        dictionaryId: current.dictionaryId,
        difficulty: current.difficulty,
        candidatePool: botCandidateWordsByLength.get(targetLength) ?? [],
      });
      if (cancelled) return;

      updateBotSession(current.id, 'bot', unsolvedIndex, move.guess);
    };

    if (botPlayStyle === 'turns') {
      if (botActiveTurn !== 'bot') {
        setIsBotThinking(false);
        return;
      }
      runSingleBotMove()
        .catch((error) => console.error('BOT_MOVE_ERROR', error))
        .finally(() => {
          if (!cancelled) setIsBotThinking(false);
        });

      return () => {
        cancelled = true;
      };
    }

    const runBotLoop = async () => {
      while (!cancelled) {
        // Re-fetch the latest session state each iteration
        const current = getBotSession(sessionId);
        if (!current || current.status !== 'active') break;

        // Find an unsolved bot target
        const botTargetWords = current.botState.targetWords ?? [];
        const botSolved = current.botState.solvedByTarget ?? [];
        const unsolvedIndex = botTargetWords.findIndex((_: string, idx: number) => !botSolved[idx]);

        if (unsolvedIndex === -1) {
          break;
        }

        const targetWord = botTargetWords[unsolvedIndex];
        const targetLength = targetWord.length;

        // Gather previous feedback for this target
        const previousGuesses = (current.botState.guessesByTarget[unsolvedIndex] ?? [])
          .map((g: any) => typeof g === 'string' ? g : g.guess);
        const previousFeedback = (current.botState.guessesByTarget[unsolvedIndex] ?? [])
          .filter((g: any) => typeof g !== 'string' && g.codes)
          .map((g: any) => ({ guess: g.guess, codes: g.codes }));

        // Wait before making a move (thinking delay)
        const delay = getBotThinkingDelay(current.difficulty);
        setIsBotThinking(true);
        await new Promise((resolve) => setTimeout(resolve, delay));
        if (cancelled) break;

        try {
          // Generate bot move
          const move = await generateBotMove({
            targetIndex: unsolvedIndex,
            targetLength,
            previousGuesses,
            previousFeedback,
            dictionaryId: current.dictionaryId,
            difficulty: current.difficulty,
            candidatePool: botCandidateWordsByLength.get(targetLength) ?? [],
          });

          if (cancelled) break;

          updateBotSession(
            current.id,
            'bot',
            unsolvedIndex,
            move.guess,
          );
          if (!cancelled) setIsBotThinking(false);
        } catch (error) {
          console.error('BOT_MOVE_ERROR', error);
          if (!cancelled) setIsBotThinking(false);
          // Small delay before retrying on error
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    };

    runBotLoop();

    return () => {
      cancelled = true;
    };
  }, [mode, sessionId, botSessionId, botSessionStatus, botCandidateWordsByLength, botPlayStyle, botActiveTurn]);

  const [duelTauntText, setDuelTauntText] = useState('');
  const duelTauntAnim = useRef(new RNAnimated.Value(16)).current;
  const lastTurnRef = useRef<'player' | 'bot' | null>(null);
  // How long (ms) the most recent player reveal animation takes — bot waits for this.
  const revealWaitMsRef = useRef(0);
  const showDuelTicker =
    mode === 'bot' &&
    !!botSession &&
    botSession.playStyle === 'turns' &&
    botBanterEnabled &&
    duelTauntText.length > 0;

  useEffect(() => {
    if (mode !== 'bot' || !botSession || botSession.playStyle !== 'turns' || !botBanterEnabled) {
      setDuelTauntText('');
      lastTurnRef.current = null;
      return;
    }

    if (botSession.status !== 'active') {
      setDuelTauntText(botSession.winner === 'player' ? playerWinPool.next() : botWinPool.next());
      lastTurnRef.current = null;
      return;
    }

    const currentTurn = botSession.activeTurn;
    const previousTurn = lastTurnRef.current;
    const changed = previousTurn !== null && previousTurn !== currentTurn;
    const firstSeen = previousTurn === null;

    if (changed || firstSeen) {
      const text =
        currentTurn === 'player'
          ? (Math.random() < 0.4 ? 'Your turn.' : `Your turn — ${playerTurnPool.next()}`)
          : (Math.random() < 0.4 ? 'Bot turn.' : `Bot turn — ${botTurnPool.next()}`);

      // When switching to bot turn, delay the taunt until tile reveal animation finishes.
      const wait = currentTurn === 'bot' ? revealWaitMsRef.current : 0;
      if (wait > 0) {
        const tid = setTimeout(() => setDuelTauntText(text), wait);
        lastTurnRef.current = currentTurn;
        return () => clearTimeout(tid);
      }
      setDuelTauntText(text);
    }

    lastTurnRef.current = currentTurn;
  }, [mode, botSession, botBanterEnabled]);

  useEffect(() => {
    if (!showDuelTicker) return;
    duelTauntAnim.setValue(windowWidth);
    RNAnimated.timing(duelTauntAnim, {
      toValue: -windowWidth * 2,
      duration: Math.max(12000, duelTauntText.length * 240),
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
  }, [showDuelTicker, duelTauntText, duelTauntAnim, windowWidth]);

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

  const isDailyOutOfGuesses =
    isDailyPuzzle &&
    dailyTurnLimit != null &&
    totalGuessesUsed >= dailyTurnLimit &&
    !isGameWon;

  // ── Stats: record results at all completion paths ──────────────────
  const resultRecordedRef = useRef<string | null>(null);

  // Solo/PvP win
  useEffect(() => {
    if (!soloSession || !isGameWon) return;
    if (resultRecordedRef.current === soloSession.id) return;
    resultRecordedRef.current = soloSession.id;
    recordResultFromSession(soloSession, { completedAtMs: Date.now() });
  }, [soloSession, isGameWon]);

  // Daily puzzle failure (out of guesses)
  useEffect(() => {
    if (!isDailyOutOfGuesses || !soloSession) return;
    if (resultRecordedRef.current === soloSession.id) return;
    resultRecordedRef.current = soloSession.id;
    recordResultFromSession(soloSession, { completedAtMs: Date.now(), forceCompleted: 'lose' });
  }, [isDailyOutOfGuesses, soloSession]);

  // Bot duel completion
  useEffect(() => {
    if (!botSession || botSession.status === 'active') return;
    if (resultRecordedRef.current === botSession.id) return;
    resultRecordedRef.current = botSession.id;
    recordBotResult(botSession);
  }, [botSession?.status, botSession?.id]);

  const handleLogoPress = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleCompletedSessionExit = useCallback((destination: 'Lobby' | 'Stats') => {
    // Clear any lingering server-mode session banner so the lobby shows a clean slate.
    setActiveGameId(null);

    // Free-play solo sessions should stop advertising "Resume Game" once completed.
    if (soloSession && !soloSession.dailyDate) {
      deleteSession(soloSession.id);
    }

    // Finished bot duels should also disappear from the lobby resume card.
    if (botSession && botSession.status !== 'active') {
      deleteSession(botSession.id);
    }

    navigation.replace(destination);
  }, [navigation, setActiveGameId, soloSession, botSession]);

  const handleKeyPress = useCallback(
    (letter: string) => {
      setGuessText((prev) => {
        const mappedLen =
          (selectedWordSlot?.targetIndex != null
            ? lengthByTargetIndex.get(selectedWordSlot.targetIndex)
            : undefined) ?? targetLengths[resolvedSelectedTargetIndex];
        const maxLen = Math.max(1, selectedWordSlot?.length ?? mappedLen ?? 10);
        if (prev.length >= maxLen) return prev;
        return prev + letter;
      });
    },
    [selectedWordSlot, resolvedSelectedTargetIndex, targetLengths, lengthByTargetIndex],
  );

  const handleKeyBackspace = useCallback(() => {
    setGuessText((prev) => prev.slice(0, -1));
  }, []);

  const canSubmitGuess = useMemo(() => {
    // Bot mode:
    // - race: allow guesses anytime while active
    // - turns: only allow on player's turn
    if (mode === 'bot' && botSession) {
      if (botSession.status !== 'active') return false;
      if (botSession.playStyle === 'turns') return botSession.activeTurn === 'player';
      return true;
    }

    // Solo mode: allow guesses unless the daily turn limit is exhausted
    if (mode === 'solo' && soloSession) {
      if (isDailyOutOfGuesses) return false;
      return localGameState?.status === 'active';
    }

    // PvP mode: check turn order
    if (!gameState || isGameWon) {
      return false;
    }
    if (gameState.status !== 'active') {
      return false;
    }
    return gameState.current_turn_user_id === gameState.me.user_id;
  }, [gameState, isGameWon, mode, botSession, soloSession, localGameState?.status]);

  const handleBoardTilePress = useCallback(
    (targetIdx: number) => {
      const isNoopSelection =
        targetIdx === resolvedSelectedTargetIndex && stageMode === 'detail';
      if (isNoopSelection) {
        return;
      }
      markDevUiPerfAction('board-select');
      setSelectedTargetIndex(targetIdx);
      setStageMode('detail');
      lastTapRef.current = null;
    },
    [markDevUiPerfAction, resolvedSelectedTargetIndex, setSelectedTargetIndex, stageMode],
  );

  type GuessPayload = { targetIndex: number; guess: string; targetSignature?: string };
  type GuessResult = { ok: true; codes: string[] };

  const normalizeCodes = (codes: string[] | undefined): string[] =>
    (codes ?? []).map((c) => (c ? c[0]?.toUpperCase() : '') || '');

  const guessMutation = useMutation<GuessResult, Error, GuessPayload>({
    mutationFn: (payload) => {
      const forceLocal = shouldForceLocalScoring(mode, serverEnabled);
      if (!forceLocal && !activeIdForUI) {
        throw new Error('No active game.');
      }
      /**
       * Adapter call: server mode still posts to FastAPI; serverless-local mode
       * computes feedback on-device using the engine (see lib/guessScoring.ts).
       * The return shape matches the original submitGuess response ({ ok, codes }).
       * We force the serverless path in Solo/Bot/offline modes to avoid any network calls.
       */
      const localGameId = forceLocal ? (activeIdForUI ?? 0) : (activeIdForUI as number);
      // Extract targets based on session type (SoloOrPvPSession has 'targets', BotChallengeSession has 'playerTargets')
      const targetWords = soloSession
        ? soloSession.targets
        : undefined;
      return scoreGuess({
        apiKey: apiKey.trim(),
        gameId: localGameId,
        targetIndex: payload.targetIndex,
        targetSignature: payload.targetSignature,
        guess: payload.guess,
        gameState,
        targetWords,
        forceServerless: forceLocal,
      });
    },
    onSuccess: (res, vars) => {
      setGuessText('');
      setGuessError(null);
      clearGuessView(vars.targetIndex);
      // Trigger tile reveal animation for the submitted word.
      setRevealEpoch((e) => e + 1);
      const slot = wordSlots.find((s) => s.targetIndex === vars.targetIndex);
      startRevealWindow(vars.targetIndex, slot?.length ?? vars.guess.length);
      const forceLocal = shouldForceLocalScoring(mode, serverEnabled);
      if (forceLocal) {
        if (!soloSession?.id) {
          console.error('Missing local session for guess persistence');
          return;
        }
        // Persist directly into the local session so the UI re-renders without server state.
        appendLocalGuessResult({
          sessionId: soloSession.id,
          targetIndex: vars.targetIndex,
          guess: vars.guess,
          codes: normalizeCodes(res.codes),
        });
        return; // do not call invalidate in local mode
      }
      invalidate();
    },
    onError: (err: Error) => {
      clearDevUiPerfAction('submit-error');
      setGuessError(err.message);
    },
  });

  const handleSubmitGuess = useCallback(() => {
    if (!canSubmitGuess) return;
    const slot = selectedWordSlot ?? primaryWordSlot;
    if (!slot) {
      setGuessError('No target word selected.');
      return;
    }
    const raw = guessText ?? '';
    const cleaned = raw.trim().toUpperCase();
    const lettersOnly = cleaned.replace(/[^A-Z]/g, '');
    if (lettersOnly !== cleaned) {
      setGuessError('Letters only (Aâ€"Z).');
      setGuessText(''); // Clear invalid input
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
      setGuessText(''); // Clear invalid input
      return;
    }
    if (lettersOnly.length !== expectedLen) {
      setGuessError(`Must be exactly ${expectedLen} letters.`);
      setGuessText(''); // Clear incomplete input
      return;
    }

    // Validate word is in dictionary
    const rawDictionaryId =
      mode === 'bot' && botSession
        ? botSession.dictionaryId
        : soloSession?.dictionaryId ?? 'core';
    const dictionaryId = canonicalizeDictionaryId(rawDictionaryId);

    if (!isValidGuessWord(lettersOnly, dictionaryId)) {
      const validationTier = getGuessValidationDictionaryId(dictionaryId);
      const label = getDictionaryMeta(validationTier).label;
      setGuessError(`"${lettersOnly}" is not in the ${label} dictionary.`);
      setGuessText(''); // Clear invalid input so user can type a new word
      return;
    }

    setGuessError(null);
    markDevUiPerfAction('submit');

    // Bot mode: use updateBotSession() for player guesses
    if (mode === 'bot' && botSession) {
      try {
        updateBotSession(
          botSession.id,
          'player',
          Number(slot.targetIndex),
          lettersOnly,
        );

        setGuessText('');
        clearGuessView(Number(slot.targetIndex));
        setRevealEpoch((e) => e + 1);
        startRevealWindow(Number(slot.targetIndex), lettersOnly.length);
        // Record how long the reveal animation will take so bot waits for it.
        revealWaitMsRef.current = totalRevealMs(lettersOnly.length) + 100;
      } catch (error) {
        clearDevUiPerfAction('submit-error');
        console.error('Bot mode guess failed:', error);
        setGuessError(error instanceof Error ? error.message : 'Guess failed');
      }
    } else {
      // PvP/Solo mode: use regular mutation
      guessMutation.mutate({
        targetIndex: Number(slot.targetIndex),
        guess: lettersOnly,
        targetSignature: slot.signature,
      });
    }
  }, [
    gameState,
    guessMutation,
    guessText,
    primaryWordSlot,
    selectedDisplayIndex,
    selectedWordSlot,
    targetLengths,
    mode,
    botSession,
    canSubmitGuess,
    clearGuessView,
    clearDevUiPerfAction,
    markDevUiPerfAction,
    metaLengthByTargetIndex,
    soloSession?.dictionaryId,
  ]);

  const isLocalMode = !networkPvPMode;
  const hasGeometry =
    (wordSlots?.length ?? 0) > 0 || (maskedSegments?.length ?? 0) > 0;
  const isBoardUnlocked = isLocalMode ? hasGeometry : gameState?.status === 'active';
  const boardTargetIndex = isGameWon ? null : resolvedSelectedTargetIndex;

  const resolvedTargetWords = useMemo(() => {
    if (localTargetWords && localTargetWords.length > 0) return localTargetWords;
    return getTargetWordsForGame(gameState as any, activeIdForUI ?? undefined);
  }, [localTargetWords, gameState, activeIdForUI]);

  const rawHistoryByTarget = useMemo(() => {
    // Build a stable history map keyed by targetIndex so the reconciler can work
    // from canonical puzzle targets before the UI converts back to word keys.
    const map = new Map<number, FeedbackGuessEntry[]>();

    if (networkPvPMode) {
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
        if (!slotKey) continue;
        const targetIndex = wordSlots.find((slot) => slot.key === slotKey)?.targetIndex;
        if (targetIndex == null) continue;
        map.set(
          targetIndex,
          (guesses as GuessEntry[]).map((entry) => ({
            guess: entry.guess,
            codes: normalizeCodes(entry.codes),
          })),
        );
      }
      return map;
    }

    // Local modes: only use local session state to avoid duplicate entries and id mismatches.
    // For bot mode, use playerState; for solo mode, use localSession.state
    const stateToRead = mode === 'bot' && botSession
      ? botSession.playerState
      : soloSession?.state;

    if (stateToRead?.guessesByTarget) {
      stateToRead.guessesByTarget.forEach((entries: any, targetIdx: number) => {
        if (!entries) return;
        const existing = map.get(targetIdx) ?? [];
        const normalized = (entries as any[]).map((e) => ({
          guess: e.guess,
          codes: normalizeCodes(e.codes),
        })) as FeedbackGuessEntry[];

        map.set(targetIdx, [...existing, ...normalized]);
      });
    }

    return map;
  }, [gameState?.your_history_grouped, wordKeyByTargetIndex, wordsByKey, wordSlots, networkPvPMode, soloSession, botSession]);

  const splitHistory = useMemo(
    () => {
      const startedAtMs = devUiPerfEnabled ? getPerfNow() : 0;
      const nextSplitHistory = buildBoardSplitHistory({
        rawHistoryByTarget,
        wordSlots,
        targetWords: resolvedTargetWords,
        solvedFlags,
        intersectionMap,
        fullIntersectionMap,
        blockedSourceTarget: crossHistoryBlockedTarget,
      });
      if (devUiPerfEnabled) {
        splitHistoryPerfMsRef.current = getPerfNow() - startedAtMs;
      }
      return nextSplitHistory;
    },
    [
      rawHistoryByTarget,
      wordSlots,
      resolvedTargetWords,
      solvedFlags,
      intersectionMap,
      fullIntersectionMap,
      crossHistoryBlockedTarget,
      devUiPerfEnabled,
    ],
  );

  /** Combined history (native + shadow) — for history UI, ticker, and detail surfaces. */
  const combinedHistoryByTarget = splitHistory.combinedHistoryByTarget;

  const groupedHistoryMap = useMemo(() => {
    const map = new Map<string, GuessEntry[]>();
    for (const slot of wordSlots) {
      const guesses = combinedHistoryByTarget.get(slot.targetIndex) ?? [];
      map.set(
        slot.key,
        guesses.map((entry) => ({
          target_index: slot.targetIndex,
          guess: entry.guess,
          codes: entry.codes,
          created_at: '',
        })),
      );
    }
    return map;
  }, [wordSlots, combinedHistoryByTarget]);

  const groupedHistoryList = useMemo(
    () =>
      wordSlots.map((slot) => ({
        slot,
        guesses: groupedHistoryMap.get(slot.key) ?? [],
      })),
    [wordSlots, groupedHistoryMap],
  );

  const flatMergedHistory = useMemo(
    () => Array.from(combinedHistoryByTarget.values()).flat(),
    [combinedHistoryByTarget],
  );

  const wordSnapshotsByTarget = splitHistory.wordSnapshotsByTarget;
  const confirmedBoardLettersByCoord = splitHistory.confirmedBoardLettersByCoord;
  const boardTilesByCoord = splitHistory.boardTilesByCoord;
  const boardDiagnostics = splitHistory.boardDiagnostics;
  const cardDisplayState = useMemo(
    () => {
      const startedAtMs = devUiPerfEnabled ? getPerfNow() : 0;
      const nextCardDisplayState = buildCardDisplayState({
        wordSnapshotsByTarget,
        guessViewStateByTarget,
        selectedTargetIndex: resolvedSelectedTargetIndex,
        confirmedBoardLettersByCoord,
        wordSlots,
      });
      if (devUiPerfEnabled) {
        cardDisplayPerfMsRef.current = getPerfNow() - startedAtMs;
      }
      return nextCardDisplayState;
    },
    [
      wordSnapshotsByTarget,
      guessViewStateByTarget,
      resolvedSelectedTargetIndex,
      confirmedBoardLettersByCoord,
      wordSlots,
      devUiPerfEnabled,
    ],
  );

  const discoveredBlueLetters = useMemo(() => {
    const discovered = new Set<string>();
    for (const entries of combinedHistoryByTarget.values()) {
      for (const entry of entries) {
        const guess = (entry.guess ?? '').toUpperCase();
        const codes = entry.codes ?? [];
        const len = Math.min(guess.length, codes.length);
        for (let i = 0; i < len; i++) {
          const letter = guess[i];
          if (codes[i] === 'B' && letter && letter >= 'A' && letter <= 'Z') {
            discovered.add(letter);
          }
        }
      }
    }
    return discovered;
  }, [combinedHistoryByTarget]);

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

  const blueTickerEntries = useMemo(
    () => computeBlueTickerEntries({
      groupedHistoryList,
      resolvedTargetWords,
      solvedFlags,
      solvedWordsByTarget,
      discoveredBlueLetters,
      intersectionMap,
    }),
    [groupedHistoryList, resolvedTargetWords, solvedFlags, solvedWordsByTarget, discoveredBlueLetters, intersectionMap],
  );

  const blueTickerLetters = useMemo(
    () => blueTickerEntries.map(([letter]) => letter),
    [blueTickerEntries],
  );

  const letterStates = useMemo(
    () => buildKeyboardLetterStates(resolvedTargetWords, flatMergedHistory),
    [resolvedTargetWords, flatMergedHistory],
  );

  const greenLettersByTarget = useMemo<Record<number, Record<number, string>>>(() => {
    return buildConfirmedLettersByTargetFromCoordMap(confirmedBoardLettersByCoord, wordSlots);
  }, [confirmedBoardLettersByCoord, wordSlots]);

  // Fire motif drop when an intersection tile first turns green (individual letter solve).
  useEffect(() => {
    if (greenMotifInitRef.current) {
      greenMotifInitRef.current = false;
      prevGreenIntersectionCoordsRef.current = new Set(confirmedBoardLettersByCoord.keys());
      for (const key of confirmedBoardLettersByCoord.keys()) {
        const targets = coordToTargetIndices.get(key);
        if (targets && targets.length >= 2) {
          motifFiredCoordsRef.current.add(key);
        }
      }
      return;
    }

    const GRID_SIZE = 10;
    const GAP = 2;
    const tileSize = computedTileSize ?? 32;

    let minRow = Infinity, minCol = Infinity;
    let maxRow = -Infinity, maxCol = -Infinity;
    for (const ws of wordSlots) {
      for (const [wr, wc] of ws.coords) {
        if (wr < minRow) minRow = wr;
        if (wc < minCol) minCol = wc;
        if (wr > maxRow) maxRow = wr;
        if (wc > maxCol) maxCol = wc;
      }
    }
    for (const [rr, rc] of revealedCoords) {
      if (rr < minRow) minRow = rr;
      if (rc < minCol) minCol = rc;
      if (rr > maxRow) maxRow = rr;
      if (rc > maxCol) maxCol = rc;
    }
    if (!Number.isFinite(minRow)) return;

    const nHeight = Math.max(1, maxRow - minRow + 1);
    const nWidth = Math.max(1, maxCol - minCol + 1);
    const center = Math.floor(GRID_SIZE / 2);
    const clamp = (off: number, span: number) => {
      if (span >= GRID_SIZE) return 0;
      let a = off;
      if (a < 0) a = 0;
      if (a + span - 1 >= GRID_SIZE) a = GRID_SIZE - span;
      return a;
    };
    const rowOff = clamp(Math.round(center - (nHeight - 1) / 2), nHeight);
    const colOff = clamp(Math.round(center - (nWidth - 1) / 2), nWidth);
    const crop = boardCropInfo ?? { minRow: 0, minCol: 0, rows: GRID_SIZE, cols: GRID_SIZE };
    const stageW = crop.cols * tileSize + (crop.cols - 1) * GAP;
    const stageH = crop.rows * tileSize + (crop.rows - 1) * GAP;

    const newGreenCoords = collectNewGreenIntersectionMotifs({
      previousConfirmedCoords: prevGreenIntersectionCoordsRef.current,
      confirmedBoardLettersByCoord,
      coordToTargetIndices,
      slotByTargetIndex: new Map(
        Array.from(slotByTargetIndex.entries()).map(([targetIndex, slot]) => [
          targetIndex,
          {
            targetIndex: slot.targetIndex,
            coords: slot.coords,
            length: slot.length,
          },
        ]),
      ),
      greenLettersByTarget,
      motifFiredCoords: motifFiredCoordsRef.current,
      revealTargetIndex,
    });

    prevGreenIntersectionCoordsRef.current = new Set(confirmedBoardLettersByCoord.keys());

    for (const { coordKey } of newGreenCoords) {
      motifFiredCoordsRef.current.add(coordKey);
    }

    if (newGreenCoords.length === 0) return;

    boardContainerRef.current?.measureInWindow((bx, by, bw, bh) => {
      if (bx == null || by == null) return;
      newGreenCoords.forEach(({ row, col, positionInWord }) => {
        const normRow = (row - minRow) + rowOff;
        const normCol = (col - minCol) + colOff;
        const delay = positionInWord * 320 + 200 * 2 + 430;
        setTimeout(() => {
          const gridOffX = bw != null ? (bw - stageW) / 2 : 0;
          const gridOffY = bh != null ? (bh - stageH) / 2 : 0;
          const tileLocalX = (normCol - crop.minCol) * (tileSize + GAP) + tileSize / 2;
          const tileLocalY = (normRow - crop.minRow) * (tileSize + GAP) + tileSize / 2;
          triggerNextMotif(bx + gridOffX + tileLocalX, by + gridOffY + tileLocalY, tileSize - 2, 0);
        }, delay);
      });
    });
  }, [confirmedBoardLettersByCoord, greenLettersByTarget, slotByTargetIndex, coordToTargetIndices, computedTileSize, triggerNextMotif, wordSlots, revealedCoords, boardCropInfo, revealTargetIndex]);

  const getCodePalette = useCallback((code: string, _letter?: string) => {
    const upper = (code || '').toUpperCase();
    const entry = codeToTileFromPalette(upper, tilePalette);
    const labels: Record<string, string> = {
      G: 'Correct letter in the correct spot',
      Y: 'Letter exists but in a different position',
      R: 'Letter not present in the puzzle',
      B: 'Letter exists in another unsolved word',
    };
    return { background: entry.bg, text: entry.letter, label: labels[upper] ?? 'Feedback' };
  }, [tilePalette]);

  const renderCodes = useCallback(
    (
      codes: string[],
      useAtlanticStyles = false,
      guessText?: string,
      wrapTiles = false,
      compact = false,
      crossPositions?: Set<number>,
      tight = false,
    ) => {
      const values = codes && codes.length > 0 ? codes : ['-'];
      const rowStyle = tight
        ? atlanticStyles.codeRowInline
        : useAtlanticStyles
          ? (wrapTiles ? atlanticStyles.codeRowWrapped : atlanticStyles.codeRow)
          : atlanticStyles.codeRow;
      const cellStyle = useAtlanticStyles
        ? compact
          ? atlanticStyles.codeCellCompact
          : atlanticStyles.codeCell
        : atlanticStyles.codeCell;
      const letterStyle = useAtlanticStyles
        ? compact
          ? atlanticStyles.codeLetterCompact
          : atlanticStyles.codeLetter
        : atlanticStyles.codeLetter;
      return (
        <View style={rowStyle}>
          {values.map((rawCode, codeIndex) => {
            const letter = guessText && codeIndex < guessText.length ? guessText[codeIndex] : undefined;
            const palette = getCodePalette(rawCode, letter);
            const display = letter
              ? letter.toUpperCase()
              : (rawCode || '-').toUpperCase();
            return (
              <View
                key={`code-${codeIndex}`}
                style={[
                  cellStyle,
                  { backgroundColor: palette.background },
                ]}
                accessibilityLabel={palette.label}
              >
                {crossPositions?.has(codeIndex) ? (
                  <View pointerEvents="none" style={atlanticStyles.codeCellCrossOutline} />
                ) : null}
                <Text style={[letterStyle, { color: palette.text }]}>{display}</Text>
              </View>
            );
          })}
        </View>
      );
    },
    [getCodePalette],
  );

  const detailHistoryItems = useMemo(
    () => cardDisplayState.detailRowsForSelectedTarget,
    [cardDisplayState.detailRowsForSelectedTarget],
  );
  const detailStageIntersectionPositions = useMemo(
    () => intersectionPositionsByTarget.get(resolvedSelectedTargetIndex),
    [intersectionPositionsByTarget, resolvedSelectedTargetIndex],
  );
  const handlePreviewHistoryRow = useCallback((rowId: string) => {
    markDevUiPerfAction('history-preview');
    previewGuessByRowId(resolvedSelectedTargetIndex, rowId);
  }, [markDevUiPerfAction, previewGuessByRowId, resolvedSelectedTargetIndex]);
  const handleToggleLockHistoryRow = useCallback((rowId: string, isLocked: boolean) => {
    if (isLocked) {
      markDevUiPerfAction('history-unlock');
      unlockGuess(resolvedSelectedTargetIndex);
      return;
    }
    markDevUiPerfAction('history-lock');
    lockGuessByRowId(resolvedSelectedTargetIndex, rowId);
  }, [lockGuessByRowId, markDevUiPerfAction, resolvedSelectedTargetIndex, unlockGuess]);

  useEffect(() => {
    if (!devUiPerfEnabled) return;

    const pendingAction = pendingUiPerfActionRef.current;
    const pendingReveal = pendingRevealPerfRef.current;
    const committedAtMs = getPerfNow();
    const actionToCommitMs =
      pendingAction != null ? committedAtMs - pendingAction.startedAtMs : null;
    const expectedRevealMs = pendingReveal?.expectedDurationMs ?? null;
    const renderCounts = { ...devRenderCountsRef.current };

    setDevUiPerf((prev) => ({
      ...(prev ?? EMPTY_DEV_UI_PERF),
      pendingActionLabel: pendingAction?.label ?? null,
      lastActionLabel: pendingAction?.label ?? prev?.lastActionLabel ?? null,
      lastActionToCommitMs: actionToCommitMs ?? prev?.lastActionToCommitMs ?? null,
      lastExpectedRevealMs: expectedRevealMs ?? prev?.lastExpectedRevealMs ?? null,
      splitHistoryMs: splitHistoryPerfMsRef.current,
      cardDisplayMs: cardDisplayPerfMsRef.current,
      boardTileCount: boardTilesByCoord.size,
      boardDiagnosticsCount: boardDiagnostics.length,
      detailRowCount: detailHistoryItems.length,
      combinedRowCount: flatMergedHistory.length,
      selectedTargetIndex: resolvedSelectedTargetIndex,
      revealTargetIndex,
      renderCounts,
    }));

    if (!pendingAction) return;

    pendingUiPerfActionRef.current = null;
    requestAnimationFrame(() => {
      const afterPaintMs = getPerfNow() - pendingAction.startedAtMs;
      const actionLabel = pendingAction.label;
      const splitHistoryMs = splitHistoryPerfMsRef.current;
      const cardDisplayMs = cardDisplayPerfMsRef.current;
      const renderCountsAfterPaint = { ...devRenderCountsRef.current };
      setDevUiPerf((prev) => ({
        ...(prev ?? EMPTY_DEV_UI_PERF),
        pendingActionLabel: null,
        lastActionLabel: actionLabel,
        lastActionToCommitMs: actionToCommitMs,
        lastAfterPaintMs: afterPaintMs,
        lastExpectedRevealMs: expectedRevealMs ?? prev?.lastExpectedRevealMs ?? null,
        renderCounts: renderCountsAfterPaint,
      }));
      appendDevUiPerfLogEntry({
        timestampIso: new Date().toISOString(),
        actionLabel,
        commitMs: actionToCommitMs,
        paintMs: afterPaintMs,
        revealDoneMs: null,
        expectedRevealMs,
        revealOverrunMs: null,
        splitHistoryMs,
        cardDisplayMs,
        boardTileCount: boardTilesByCoord.size,
        detailRowCount: detailHistoryItems.length,
        combinedRowCount: flatMergedHistory.length,
        boardDiagnosticsCount: boardDiagnostics.length,
        selectedTargetIndex: resolvedSelectedTargetIndex,
        revealTargetIndex,
        renderCounts: renderCountsAfterPaint,
      });
    });
  }, [
    appendDevUiPerfLogEntry,
    boardDiagnostics.length,
    boardTilesByCoord,
    cardDisplayState,
    detailHistoryItems.length,
    devUiPerfEnabled,
    flatMergedHistory.length,
    revealTargetIndex,
    resolvedSelectedTargetIndex,
    splitHistory,
    stageMode,
  ]);

  useEffect(() => {
    if (!devUiPerfEnabled) return;
    const pendingReveal = pendingRevealPerfRef.current;
    if (!pendingReveal || revealTargetIndex != null) return;

    pendingRevealPerfRef.current = null;
    const revealDoneMs = getPerfNow() - pendingReveal.startedAtMs;
    const revealOverrunMs = revealDoneMs - pendingReveal.expectedDurationMs;
    const renderCounts = { ...devRenderCountsRef.current };
    setDevUiPerf((prev) => ({
      ...(prev ?? EMPTY_DEV_UI_PERF),
      lastRevealCompleteMs: revealDoneMs,
      lastExpectedRevealMs: pendingReveal.expectedDurationMs,
      lastRevealOverrunMs: revealOverrunMs,
      renderCounts,
    }));
    appendDevUiPerfLogEntry({
      timestampIso: new Date().toISOString(),
      actionLabel: 'reveal-complete',
      commitMs: null,
      paintMs: null,
      revealDoneMs,
      expectedRevealMs: pendingReveal.expectedDurationMs,
      revealOverrunMs,
      splitHistoryMs: splitHistoryPerfMsRef.current,
      cardDisplayMs: cardDisplayPerfMsRef.current,
      boardTileCount: boardTilesByCoord.size,
      detailRowCount: detailHistoryItems.length,
      combinedRowCount: flatMergedHistory.length,
      boardDiagnosticsCount: boardDiagnostics.length,
      selectedTargetIndex: resolvedSelectedTargetIndex,
      revealTargetIndex: pendingReveal.targetIndex,
      renderCounts,
    });
  }, [
    appendDevUiPerfLogEntry,
    boardDiagnostics.length,
    boardTilesByCoord,
    detailHistoryItems.length,
    devUiPerfEnabled,
    flatMergedHistory.length,
    revealTargetIndex,
    resolvedSelectedTargetIndex,
  ]);

  // Extract green letters from INTERSECTING words to show as placeholders in the input
  const alphabetShowBlueCounts = useUIStore((s) => s.alphabetShowBlueCounts);
  const showBlueTicker = useUIStore((s) => s.showBlueTicker);
  const greenLettersForSelected = useMemo(() => {
    if (resolvedSelectedTargetIndex == null) return [];
    const selectedSlot = wordSlots.find((s) => s.targetIndex === resolvedSelectedTargetIndex);
    if (!selectedSlot) return [];

    const placeholders = cardDisplayState.greenPlaceholdersByTarget[resolvedSelectedTargetIndex] ?? {};
    const letters: Array<string | undefined> = [];
    for (let i = 0; i < selectedSlot.coords.length; i++) {
      letters.push(placeholders[i]);
    }

    return letters;
  }, [cardDisplayState.greenPlaceholdersByTarget, resolvedSelectedTargetIndex, wordSlots]);

  const devTargetWords = SHOW_DEV_TARGET_WORDS ? (localTargetWords ?? undefined) : undefined;

  // When a new guess is added, scroll the history up so the latest guess stays
  // just above the pinned input row — older guesses disappear above the fold.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (stageMode === 'detail') {
      setTimeout(() => scrollStageToEnd(), 50);
    }
  }, [detailHistoryItems.length]);

  if (mode === 'solo' && isDailyPuzzle && !dailyEntryValidated) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={[atlanticStyles.screen, { backgroundColor: boardScreenBg }]} />
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[atlanticStyles.screen, { backgroundColor: boardScreenBg }]}>
      {/* Outer ScrollView removed so header/board stay fixed; only the word list panel scrolls. */}
      <View style={[atlanticStyles.root, { backgroundColor: boardScreenBg }]}>
        <View>
          <View style={[atlanticStyles.header, darkModeEnabled && { borderColor: '#2d2d2d', backgroundColor: '#121212' }]}>
            <Pressable onPress={handleLogoPress} style={atlanticStyles.headerAction}>
              <Image
                source={require('../../assets/design/icons/CWMotifRed.png')}
                style={[atlanticStyles.headerMotif, { tintColor: '#E7131A' }]}
                resizeMode="contain"
              />
            </Pressable>
            <View style={atlanticStyles.headerCenter}>
              <Text style={[atlanticStyles.headerBrand, darkModeEnabled && { color: '#f2f2f2' }]}>CROS<Text style={{ color: '#E7131A' }}>S</Text>WORD<Text style={{ color: '#E7131A' }}>S</Text></Text>
              {isDailyPuzzle && dailyTurnLimit != null && !isGameWon && !isDailyOutOfGuesses && (
                <Text style={[atlanticStyles.dailyGuessCounter, darkModeEnabled && { color: '#aaa' }]}>
                  {dailyTurnLimit - totalGuessesUsed}/{dailyTurnLimit} guesses left
                </Text>
              )}
            </View>
            <View style={atlanticStyles.headerAction} />
          </View>
        </View>

        <View
          style={[
            atlanticStyles.body,
            { paddingBottom: stageMode === 'detail' ? 0 : (insets.bottom ?? 0) + 8 },
          ]}
        >
          {mode === 'pvp' && !activeGameId ? (
            <View style={[atlanticStyles.card, darkCard]}>
              <Text style={[atlanticStyles.bodyText, darkText]}>Join or create a game to unlock the board.</Text>
              <Pressable onPress={() => navigation.navigate('Lobby')} style={atlanticStyles.ctaButton}>
                <Text style={atlanticStyles.ctaButtonText}>Go to Lobby</Text>
              </Pressable>
            </View>
          ) : error ? (
            <View style={[atlanticStyles.card, darkCard]}>
              <Text style={atlanticStyles.errorText}>{error.message}</Text>
              <Pressable onPress={() => invalidate()} style={atlanticStyles.ctaButton}>
                <Text style={atlanticStyles.ctaButtonText}>Retry</Text>
              </Pressable>
            </View>
          ) : !gameState ? (
            <View style={[atlanticStyles.card, darkCard]}>
              <Text style={[atlanticStyles.bodyMuted, darkMuted]}>Loading game state…</Text>
              <Pressable onPress={() => invalidate()} style={atlanticStyles.ctaButton}>
                <Text style={atlanticStyles.ctaButtonText}>Refresh</Text>
              </Pressable>
            </View>
          ) : isBoardUnlocked ? (
            <>
              {isGameWon ? (
                <View style={[atlanticStyles.card, darkCard]}>
                  <Text style={[atlanticStyles.cardHeading, darkText]}>Victory secured!</Text>
                  <Text style={[atlanticStyles.bodyMuted, darkMuted]}>All five opponent words are solved.</Text>
                  <Pressable onPress={() => navigation.navigate('Lobby')} style={atlanticStyles.ctaButton}>
                    <Text style={atlanticStyles.ctaButtonText}>Return to lobby</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <Animated.View style={[atlanticStyles.boardFrame, atlanticStyles.sectionSpacer, darkCard]}>
                    {/* Border-drawn corners avoid overlap between strokes */}
                    <View pointerEvents="none" style={atlanticStyles.boardCornerTL} />
                    <View pointerEvents="none" style={atlanticStyles.boardCornerTLInner} />
                    <View pointerEvents="none" style={atlanticStyles.boardCornerBR} />
                    <View pointerEvents="none" style={atlanticStyles.boardCornerBRInner} />
                    <View
                      style={[
                        atlanticStyles.boardCenterWrap,
                        stageMode === 'detail'
                          ? { height: Math.round(windowHeight * 0.33) }
                          : { height: listBoardHeight },
                      ]}
                    >
                      {maskedSegments.length > 0 ? (
                        <View
                          ref={boardContainerRef}
                          style={{ width: '100%', alignItems: 'center' }}
                          onLayout={(e) => setBoardWidth(e.nativeEvent.layout.width)}
                        >
                          <BoardView
                            maskedSegments={maskedSegments}
                            revealedCoords={revealedCoords}
                            activeTargetIndex={boardTargetIndex ?? undefined}
                            targetsMeta={targetsMeta}
                            availableWidth={boardWidth ?? undefined}
                            availableHeight={stageMode === 'detail' ? Math.round(windowHeight * 0.33) : listBoardHeight}
                            boardTilesByCoord={boardTilesByCoord}
                            boardDiagnostics={boardDiagnostics}
                            onTilePress={handleBoardTilePress}
                            useAtlanticMode
                            revealTargetIndex={revealTargetIndex}
                            revealEpoch={revealEpoch}
                            onTileSizeComputed={setComputedTileSize}
                            onCropComputed={setBoardCropInfo}
                            devRenderCountsRef={devRenderCountsRef}
                          />
                        </View>
                      ) : (
                        <Text style={[atlanticStyles.bodyMuted, darkMuted]}>Opponent board unlocking…</Text>
                      )}
                    </View>
                  </Animated.View>
                  {motifDropPool.map((md, i) => (
                    <MotifDropOverlay
                      key={i}
                      isAnimating={md.isAnimating}
                      targetX={md.targetX}
                      targetY={md.targetY}
                      finalSize={md.finalSize}
                      motifSize={md.motifSize}
                      motifAlpha={md.motifAlpha}
                      flashOpacity={md.flashOpacity}
                      particles={md.particles}
                      particleCount={md.particleCount}
                      containerWidth={md.containerWidth}
                      containerHeight={md.containerHeight}
                      containerScreenX={md.containerScreenX}
                      containerScreenY={md.containerScreenY}
                      onLayout={(e) => {
                        // Sync container dimensions across all pool instances
                        const { width, height } = e.nativeEvent.layout;
                        for (const m of motifDropPool) {
                          m.containerWidth.value = width;
                          m.containerHeight.value = height;
                        }
                      }}
                    />
                  ))}
                  {/* Combined status rail: bot summary + blue feedback letters */}
                  <View>
                    <View style={[atlanticStyles.statusRail, darkCard]}>
                      {mode === 'bot' && botSession ? (
                        <>
                          <View style={atlanticStyles.statusRailTopRow}>
                            <View style={atlanticStyles.statusRailBotGroup}>
                              <Text style={[atlanticStyles.statusRailBotLabel, darkText]}>
                                {botSession.difficulty === 'easy' ? 'Pupil' : botSession.difficulty === 'normal' ? 'Fencer' : 'Duelist'}
                              </Text>
                              <Text style={[atlanticStyles.statusRailBotCount, darkText]}>{botSession.botSolvedCount}/5</Text>
                            </View>
                            {showDuelTicker ? (
                              <View style={atlanticStyles.statusRailBanterWrap}>
                                <RNAnimated.Text
                                  numberOfLines={1}
                                  style={[
                                    atlanticStyles.statusRailBanterText,
                                    { width: windowWidth * 2, textAlign: 'left', transform: [{ translateX: duelTauntAnim }] },
                                  ]}
                                >
                                  {duelTauntText}
                                </RNAnimated.Text>
                              </View>
                            ) : (
                              <View style={atlanticStyles.statusRailBanterSpacer} />
                            )}
                          </View>
                          <View style={[atlanticStyles.statusRailDivider, darkDivider]} />
                        </>
                      ) : null}
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={atlanticStyles.statusRailLetters}
                      >
                        {showBlueTicker && blueTickerEntries
                          .map(([ch, count]) => (
                            <View key={ch} style={[atlanticStyles.statusRailLetterTile, { backgroundColor: tilePalette.notInWord.bg }]}>
                              <Text style={atlanticStyles.statusRailLetterText}>{ch}</Text>
                              {alphabetShowBlueCounts && count > 1 && (
                                <View style={atlanticStyles.statusRailCountBadge}>
                                  <Text style={atlanticStyles.statusRailCountBadgeText}>{count}</Text>
                                </View>
                              )}
                            </View>
                          ))}
                      </ScrollView>
                    </View>
                  </View>

                  <View style={[atlanticStyles.wordCardsCard, atlanticStyles.sectionSpacer, darkCard]}>
                    <View style={atlanticStyles.railRow}>
                      <ScrollView
                        style={atlanticStyles.rail}
                        contentContainerStyle={atlanticStyles.railContent}
                        showsVerticalScrollIndicator={false}
                        nestedScrollEnabled
                      >
                        {wordSlots.map((slot) => {
                          const isSelected = resolvedSelectedTargetIndex === slot.targetIndex;
                          const isSolved = solvedFlags[slot.targetIndex];
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
                                  markDevUiPerfAction('stage-list-toggle');
                                  setStageMode('list');
                                  lastTapRef.current = null;
                                  return;
                                }
                                if (slot.targetIndex === resolvedSelectedTargetIndex && stageMode === 'detail') {
                                  lastTapRef.current = { targetIndex: slot.targetIndex, ts: now };
                                  return;
                                }
                                markDevUiPerfAction('rail-select');
                                setSelectedTargetIndex(slot.targetIndex);
                                setStageMode('detail');
                                lastTapRef.current = { targetIndex: slot.targetIndex, ts: now };
                              }}
                              style={[
                                atlanticStyles.railBadgeWrap,
                                isSelected && atlanticStyles.railBadgeWrapSelected,
                              ]}
                            >
                              <View
                                style={[
                                  atlanticStyles.railBadge,
                                  isSolved && atlanticStyles.railBadgeSolved,
                                  isSelected && atlanticStyles.railBadgeSelectedInner,
                                ]}
                              >
                                <Text style={atlanticStyles.railBadgeText}>
                                  {slot.displayIndex}
                                </Text>
                              </View>
                            </Pressable>
                          );
                        })}
                      </ScrollView>

                      <View style={atlanticStyles.stagePanel}>
                        {stageMode === 'detail' ? (
                          <>
                            <View style={atlanticStyles.detailHeaderRow}>
                              {solvedFlags[resolvedSelectedTargetIndex] ? (
                                <Text style={atlanticStyles.detailHeaderText}>Solved ✓</Text>
                              ) : null}
                            </View>
                          </>
                        ) : null}

                        {/* Measured wrapper: ScrollView takes content height up to maxHeight,
                            then scrolls. Input "rains down" from top, pins when history fills. */}
                        <View
                          style={{ flex: 1, minHeight: 0 }}
                          onLayout={(e) => setScrollAreaHeight(e.nativeEvent.layout.height)}
                        >
                          <ScrollView
                            ref={stageScrollRef}
                            style={[
                              atlanticStyles.stageScroll,
                              scrollMaxHeight != null && { flex: 0, flexGrow: 0, maxHeight: scrollMaxHeight },
                            ]}
                            contentContainerStyle={[
                              atlanticStyles.stageScrollContent,
                              null,
                            ]}
                            nestedScrollEnabled
                            showsVerticalScrollIndicator
                            keyboardShouldPersistTaps="always"
                          >
                            {stageMode === 'list' ? (
                              <View style={atlanticStyles.listStage}>
                                {wordSlots.map((slot) => {
                                  const displayGuess = wordSnapshotsByTarget.get(slot.targetIndex)?.latestNativeRow ?? null;
                                  return (
                                    <Pressable
                                      key={`list-row-${slot.key}`}
                                      style={atlanticStyles.listRow}
                                      onPress={() => {
                                        markDevUiPerfAction('list-select');
                                        setSelectedTargetIndex(slot.targetIndex);
                                        setStageMode('detail');
                                      }}
                                      accessibilityRole="button"
                                      accessibilityLabel={`Select word ${slot.displayIndex}`}
                                    >
                                      {displayGuess != null ? (
                                        renderCodes(
                                          displayGuess.codes || [],
                                          true,
                                          displayGuess.guess ?? '',
                                          true,
                                          true,
                                          intersectionPositionsByTarget.get(slot.targetIndex),
                                          true,
                                        )
                                      ) : (
                                        <View style={atlanticStyles.codeRowInline}>
                                          {Array.from({
                                            length: Math.max(1, slot.length ?? targetLengths[slot.targetIndex] ?? 5),
                                          }).map((_, idx) => (
                                            <View
                                              key={`placeholder-${slot.key}-${idx}`}
                                              style={[atlanticStyles.codeCell, atlanticStyles.codeCellPlaceholder, darkModeEnabled && { backgroundColor: '#3a3a3a', borderColor: '#555' }]}
                                            >
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
                              <DetailHistoryStage
                                detailHistoryItems={detailHistoryItems}
                                selectedTargetIndex={resolvedSelectedTargetIndex}
                                intersectionPositions={detailStageIntersectionPositions}
                                renderCodes={renderCodes}
                                onPreviewRow={handlePreviewHistoryRow}
                                onToggleLockRow={handleToggleLockHistoryRow}
                                devRenderCountsRef={devRenderCountsRef}
                              />
                            )}
                          </ScrollView>

                          {/* Input row — sits right after history, pins at bottom when history fills */}
                          {stageMode === 'detail' && (
                            <View style={[atlanticStyles.guessFooter, darkDivider]}>
                              <View
                                style={[
                                  atlanticStyles.letterInputWrap,
                                  (!canSubmitGuess || guessMutation.isPending) && atlanticStyles.guessBarDisabled,
                                ]}
                              >
                                <View style={atlanticStyles.letterRow}>
                                  {Array.from({ length: Math.max(1, selectedSlotLength ?? 5) }).map((_, idx) => {
                                    const char = guessText[idx] ?? '';
                                    const greenLetter = greenLettersForSelected[idx];
                                    const displayChar = char || greenLetter || ' ';
                                    const isGreenPlaceholder = !char && greenLetter;
                                    return (
                                      <View key={`letter-${idx}`} style={[atlanticStyles.letterBox, darkInputBox]}>
                                        <Text style={[
                                          atlanticStyles.letterBoxText,
                                          darkText,
                                          isGreenPlaceholder && { color: tilePalette.correct.bg, opacity: 0.6 }
                                        ]}>
                                          {displayChar}
                                        </Text>
                                      </View>
                                    );
                                  })}
                                </View>
                              </View>
                              {guessError ? <Text style={atlanticStyles.errorText}>{guessError}</Text> : null}
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  </View>
                </>
              )}
            </>
          ) : (
            <View style={[atlanticStyles.card, darkCard]}>
              <Text style={[atlanticStyles.cardHeading, darkText]}>
                {gameState?.status === 'finished' ? 'Game over' : 'Board locked'}
              </Text>
              <Text style={[atlanticStyles.bodyMuted, darkMuted]}>
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
        </View>
        {stageMode === 'detail' && (
          <View style={{ paddingBottom: insets.bottom }}>
            <GameKeyboard
              onKey={handleKeyPress}
              onBackspace={handleKeyBackspace}
              onSubmit={handleSubmitGuess}
              letterStates={letterStates}
              disabled={guessMutation.isPending}
            />
          </View>
        )}
      </View>
      <AlphabetSidePanel
        isOpen={isAlphaOpen}
        onOpen={() => setIsAlphaOpen(true)}
        onClose={() => setIsAlphaOpen(false)}
        motifRed={MOTIF_RED}
        motifBlue={tilePalette.notInWord.bg}
        blueLetters={showBlueTicker ? blueTickerLetters : []}
        blueLetterCounts={showBlueTicker ? blueTickerEntries : []}
        devTargetWords={devTargetWords}
        devUiPerf={devUiPerfEnabled ? devUiPerf : null}
        isDevUiPerfLogging={devUiPerfEnabled ? isDevUiPerfLogging : false}
        devUiPerfLogCount={devUiPerfLogEntries.length}
        onToggleDevUiPerfLogging={() => setIsDevUiPerfLogging((prev) => !prev)}
        onCopyDevUiPerfLog={handleCopyDevUiPerfLog}
        onClearDevUiPerfLog={handleClearDevUiPerfLog}
      />

      {/* Bot Mode Win Modal */}
      {mode === 'bot' && botSession && botSession.status !== 'active' && (
        <Modal visible transparent animationType="fade">
          <View style={atlanticStyles.modalOverlay}>
            <View style={atlanticStyles.modalContent}>
              <Text style={atlanticStyles.modalTitle}>
                {botSession.winner === 'player' ? '🎉 You Win!' : '🤖 Bot Wins!'}
              </Text>
              <View style={atlanticStyles.modalStats}>
                <View style={atlanticStyles.statRow}>
                  <Text style={atlanticStyles.statLabel}>Your Guesses:</Text>
                  <Text style={atlanticStyles.statValue}>
                    {botSession.playerState.guessesByTarget.reduce((sum, guesses) => sum + guesses.length, 0)}
                  </Text>
                </View>
                <View style={atlanticStyles.statRow}>
                  <Text style={atlanticStyles.statLabel}>Bot Guesses:</Text>
                  <Text style={atlanticStyles.statValue}>
                    {botSession.botState.guessesByTarget.reduce((sum, guesses) => sum + guesses.length, 0)}
                  </Text>
                </View>
              </View>
              <View style={atlanticStyles.modalButtons}>
                <Pressable
                  style={[atlanticStyles.modalButton, atlanticStyles.modalButtonPrimary]}
                  onPress={() => {
                    handleCompletedSessionExit('Stats');
                  }}
                >
                  <Text style={atlanticStyles.modalButtonText}>View Stats</Text>
                </Pressable>
                <Pressable
                  style={[atlanticStyles.modalButton, atlanticStyles.modalButtonSecondary]}
                  onPress={() => {
                    handleCompletedSessionExit('Lobby');
                  }}
                >
                  <Text style={[atlanticStyles.modalButtonText, atlanticStyles.modalButtonTextSecondary]}>Back to Lobby</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Daily Puzzle Failure Modal */}
      {isDailyOutOfGuesses && soloSession && (
        <Modal visible transparent animationType="fade">
          <View style={atlanticStyles.modalOverlay}>
            <View style={atlanticStyles.modalContent}>
              <Text style={atlanticStyles.modalTitle}>Out of Guesses</Text>
              <View style={atlanticStyles.modalStats}>
                <View style={atlanticStyles.statRow}>
                  <Text style={atlanticStyles.statLabel}>Words Solved:</Text>
                  <Text style={atlanticStyles.statValue}>
                    {soloSession.state.solvedByTarget?.filter(Boolean).length ?? 0}/5
                  </Text>
                </View>
                <View style={atlanticStyles.statRow}>
                  <Text style={atlanticStyles.statLabel}>Guesses Used:</Text>
                  <Text style={atlanticStyles.statValue}>
                    {totalGuessesUsed}/{dailyTurnLimit}
                  </Text>
                </View>
              </View>
              <Text style={[atlanticStyles.bodyText, { marginBottom: 12 }]}>
                The words were:{' '}
                <Text style={{ fontWeight: '700' }}>
                  {soloSession.targets.join(' · ')}
                </Text>
              </Text>
              <View style={atlanticStyles.modalButtons}>
                <Pressable
                  style={[atlanticStyles.modalButton, atlanticStyles.modalButtonSecondary]}
                  onPress={() => navigation.navigate('Lobby')}
                >
                  <Text style={[atlanticStyles.modalButtonText, atlanticStyles.modalButtonTextSecondary]}>
                    Back to Lobby
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Solo/PvP Mode Win Modal */}
      {(mode === 'solo' || mode === 'pvp') && soloSession &&
       soloSession.state.solvedByTarget?.filter(Boolean).length === 5 && (
        <Modal visible transparent animationType="fade">
          <View style={atlanticStyles.modalOverlay}>
            <View style={atlanticStyles.modalContent}>
              <Text style={atlanticStyles.modalTitle}>
                🎉 Puzzle Complete!
              </Text>
              <View style={atlanticStyles.modalStats}>
                {isDailyPuzzle && soloSession.difficulty && (
                  <View style={atlanticStyles.statRow}>
                    <Text style={atlanticStyles.statLabel}>Mode:</Text>
                    <Text style={atlanticStyles.statValue}>
                      {soloSession.difficulty.charAt(0).toUpperCase() + soloSession.difficulty.slice(1)}
                    </Text>
                  </View>
                )}
                <View style={atlanticStyles.statRow}>
                  <Text style={atlanticStyles.statLabel}>Words Solved:</Text>
                  <Text style={atlanticStyles.statValue}>
                    {soloSession.state.solvedByTarget?.filter(Boolean).length ?? 0}/5
                  </Text>
                </View>
                <View style={atlanticStyles.statRow}>
                  <Text style={atlanticStyles.statLabel}>Total Guesses:</Text>
                  <Text style={atlanticStyles.statValue}>
                    {soloSession.state.guessesByTarget.reduce((sum, guesses) => sum + guesses.length, 0)}
                  </Text>
                </View>
              </View>
              <View style={atlanticStyles.modalButtons}>
                {!isDailyPuzzle && (
                  <Pressable
                    style={[atlanticStyles.modalButton, atlanticStyles.modalButtonPrimary]}
                    onPress={() => {
                      handleCompletedSessionExit('Stats');
                    }}
                  >
                    <Text style={atlanticStyles.modalButtonText}>View Stats</Text>
                  </Pressable>
                )}
                <Pressable
                  style={[
                    atlanticStyles.modalButton,
                    isDailyPuzzle ? atlanticStyles.modalButtonPrimary : atlanticStyles.modalButtonSecondary,
                  ]}
                  onPress={() => {
                    handleCompletedSessionExit('Lobby');
                  }}
                >
                  <Text
                    style={[
                      atlanticStyles.modalButtonText,
                      !isDailyPuzzle && atlanticStyles.modalButtonTextSecondary,
                    ]}
                  >
                    Back to Lobby
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

// Atlantic skin styles — clean, spacious, minimal, high-contrast. Card rhythm: padding 16.
const atlanticStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fdfdfd' },
  root: { flex: 1, backgroundColor: '#fdfdfd' },
  body: {
    flex: 1,
    minHeight: 0, // minHeight:0 lets the inner ScrollView scroll instead of forcing the parent to expand.
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  sectionSpacer: { marginTop: 2 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderColor: '#e2e2e2',
    backgroundColor: '#fff',
    marginHorizontal: 16,
  },
  headerAction: { width: 50, alignItems: 'center' },
  headerMotif: { width: 40, height: 40 },
  headerCenter: { alignItems: 'center', flex: 1 },
  headerBrand: {
    fontFamily: 'CinzelDecorative_700Bold',
    fontSize: 14,
    letterSpacing: 1,
    color: '#000',
  },
  dailyGuessCounter: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    marginTop: 2,
  },
  headerSub: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 12,
    letterSpacing: 1,
    color: '#000',
  },
  card: {
    backgroundColor: '#fff',
    padding: 14,
    gap: 10,
  },
  boardFrame: {
    backgroundColor: '#fff',
    padding: 8,
    gap: 6,
    alignItems: 'center',
    position: 'relative',
  },
  boardDivider: {
    height: 1,
    backgroundColor: '#e7e7e7',
    marginTop: 2,
    marginBottom: 2,
  },
  // Border-drawn corner brackets to prevent stroke overlap.
  boardCornerTL: {
    position: 'absolute',
    left: CORNER_INSET_H,
    top: CORNER_INSET_V,
    width: CORNER_OUTER_WIDTH,
    height: CORNER_OUTER_HEIGHT,
    borderLeftWidth: CORNER_OUTER_STROKE_V,
    borderTopWidth: CORNER_OUTER_STROKE_H,
    borderColor: MOTIF_RED,
    backgroundColor: 'transparent',
    borderRadius: CORNER_RADIUS,
  },
  boardCornerBR: {
    position: 'absolute',
    right: CORNER_INSET_H,
    bottom: CORNER_INSET_V,
    width: CORNER_OUTER_WIDTH,
    height: CORNER_OUTER_HEIGHT,
    borderRightWidth: CORNER_OUTER_STROKE_V,
    borderBottomWidth: CORNER_OUTER_STROKE_H,
    borderColor: MOTIF_RED,
    backgroundColor: 'transparent',
    borderRadius: CORNER_RADIUS,
  },
  boardCornerTLInner: {
    position: 'absolute',
    left: CORNER_INSET_H + CORNER_INNER_GAP,
    top: CORNER_INSET_V + CORNER_INNER_GAP,
    width: CORNER_INNER_WIDTH,
    height: CORNER_INNER_HEIGHT,
    borderLeftWidth: CORNER_INNER_STROKE_V,
    borderTopWidth: CORNER_INNER_STROKE_H,
    borderColor: MOTIF_RED,
    backgroundColor: 'transparent',
    borderRadius: CORNER_RADIUS,
  },
  boardCornerBRInner: {
    position: 'absolute',
    right: CORNER_INSET_H + CORNER_INNER_GAP,
    bottom: CORNER_INSET_V + CORNER_INNER_GAP,
    width: CORNER_INNER_WIDTH,
    height: CORNER_INNER_HEIGHT,
    borderRightWidth: CORNER_INNER_STROKE_V,
    borderBottomWidth: CORNER_INNER_STROKE_H,
    borderColor: MOTIF_RED,
    backgroundColor: 'transparent',
    borderRadius: CORNER_RADIUS,
  },
  boardCenterWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  statusRail: {
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 6,
    borderWidth: 1,
    borderColor: '#e7e7e7',
    borderLeftWidth: 3,
    borderLeftColor: MOTIF_RED,
    marginBottom: 2,
  },
  statusRailTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 4,
  },
  statusRailBotGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusRailBotLabel: {
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 14,
    color: '#000',
  },
  statusRailBotCount: {
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 14,
    color: '#000',
  },
  statusRailDifficulty: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 12,
    color: '#666',
  },
  statusRailBanterWrap: {
    flex: 1,
    marginHorizontal: 8,
    overflow: 'hidden',
    minHeight: 16,
    justifyContent: 'center',
  },
  statusRailBanterSpacer: {
    flex: 1,
  },
  statusRailBanterText: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 11,
    fontStyle: 'italic',
    color: '#555',
    textAlign: 'center',
  },
  statusRailDivider: {
    borderBottomWidth: 1,
    borderColor: '#e4e4e4',
    marginBottom: 4,
  },
  statusRailLetters: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 22,
  },
  statusRailLetterTile: {
    width: 22,
    height: 22,
    borderRadius: 4,
    backgroundColor: MOTIF_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusRailLetterText: {
    fontFamily: tAtlantic.typography.displayFamily,
    color: '#fff',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  statusRailCountBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#fff',
    borderRadius: 6,
    minWidth: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  statusRailCountBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#333',
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
    padding: 6,
    flex: 1,
    minHeight: 0, // Keeps space for the internal ScrollView without expanding the whole screen.
    gap: 8,
  },
  debugBotWordsCard: {
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e2e2',
    marginHorizontal: 0,
    marginBottom: 6,
  },
  debugBotWordsBody: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 12,
    color: '#444',
    letterSpacing: 0.3,
  },
  railRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    flex: 1,
    minHeight: 0,
  },
  rail: {
    width: 48,
    flexShrink: 0,
    flexGrow: 0,
  },
  railContent: {
    gap: 10,
    alignItems: 'center',
  },
  railBadgeWrap: {
    marginLeft: -14, // extend to left edge of wordCardsCard padding
    paddingLeft: 14,
    paddingRight: 4, // overlap right edge of badge
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  railBadgeWrapSelected: {
    backgroundColor: `${MOTIF_RED}4D`, // 30% opacity red
  },
  railBadge: {
    width: 34,
    height: 34,
    backgroundColor: MOTIF_RED,
    justifyContent: 'center',
    alignItems: 'center',
  },
  railBadgeSelectedInner: {
    opacity: 0.3,
  },
  railBadgeSolved: {
    opacity: 0.5,
  },
  railBadgeText: {
    color: '#fff',
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 16,
  },
  stagePanel: {
    flex: 1,
    minHeight: 0, // Allows the inner ScrollView to claim vertical space and scroll.
    paddingLeft: 8,
  },
  stageScroll: {
    flex: 1,
    minHeight: 0,
  },
  stageScrollContent: {
    gap: 8,
  },
  listStage: {
    flexDirection: 'column',
    gap: 10,
    alignItems: 'flex-start',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 6,
  },
  detailStage: {
    gap: 0,
  },
  detailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
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
  blueHintLabel: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 11,
    color: '#555',
    marginBottom: 4,
    letterSpacing: 0.8,
  },
  blueChip: {
    backgroundColor: '#3b62d4',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
  },
  blueChipText: {
    color: '#fff',
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  devBox: {
    // reserved for future debug surfaces; currently unused
  },
  guessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: ROW_PAD,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderColor: '#e7e7e7',
  },
  guessRowCompact: {
    paddingVertical: ROW_PAD_COMPACT,
  },
  guessRowInformational: {
    backgroundColor: '#f6f1ea',
  },
  historyContentCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    flexShrink: 1,
  },
  historyMarkerGutter: {
    width: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  historyLockBullet: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: MOTIF_RED,
  },
  historyInfoLabel: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 9,
    color: '#7a4b22',
    letterSpacing: 0.8,
  },
  codeRowWrapped: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  codeRowInline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flexShrink: 1,
  },
  codeRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'nowrap',
  },
  codeCell: {
    minWidth: TILE,
    minHeight: TILE,
    borderRadius: 4,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  codeCellCompact: {
    minWidth: TILE_COMPACT,
    minHeight: TILE_COMPACT,
    borderRadius: 4,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  codeCellCrossOutline: {
    position: 'absolute',
    top: -3,
    right: -3,
    bottom: -3,
    left: -3,
    borderWidth: 3,
    borderColor: MOTIF_RED,
    borderRadius: 7,
  },
  codeLetter: {
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 13,
  },
  codeLetterCompact: {
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 12,
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
    marginTop: 2,
    paddingTop: 6,
    borderTopWidth: 1.5,
    borderColor: '#E7131A',
  },
  letterInputWrap: {
    position: 'relative',
    alignSelf: 'flex-start',
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
  guessInputOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    // Keep this input "real" for Android keyboard reliability but invisible to the eye.
    color: 'transparent',
    backgroundColor: 'transparent',
    borderWidth: 0,
    opacity: 0.02,
  },
  ctaButtonPressed: { opacity: 0.9 },
  ctaButton: {
    backgroundColor: MOTIF_RED,
    paddingVertical: 8,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  ctaButtonDisabled: {
    opacity: 0.5,
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
  // Bot Win Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 32,
    width: '85%',
    maxWidth: 400,
    alignItems: 'center',
    gap: 20,
  },
  modalTitle: {
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 28,
    color: '#000',
    textAlign: 'center',
  },
  modalStats: {
    width: '100%',
    gap: 12,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 16,
    color: '#666',
  },
  statValue: {
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 20,
    color: '#000',
    fontWeight: 'bold',
  },
  modalButtons: {
    width: '100%',
    gap: 12,
  },
  modalButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: MOTIF_RED,
  },
  modalButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: MOTIF_RED,
  },
  modalButtonText: {
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 16,
    color: '#fff',
  },
  modalButtonTextSecondary: {
    color: MOTIF_RED,
  },
});
