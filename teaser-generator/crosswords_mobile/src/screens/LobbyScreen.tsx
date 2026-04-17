
/**
 * src/screens/LobbyScreen.tsx
 * ---------------------------------------------
 * Lobby orchestration for Step 3. Players can create or join games, submit their word
 * lists, mark themselves ready, and monitor live state coming from FastAPI.
 * When USE_ATLANTIC_SKIN=true, uses Atlantic preview look.
 */

import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Alert,
  Button,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';

import ThemePicker from '@components/ThemePicker';
import { ENABLE_CROSSROADS_STYLES, USE_ATLANTIC_SKIN, isServerFunctionsEnabled } from '@src/flags';
import {
  createSeedSession,
  deleteSession,
  getOrCreateDailySession,
  subscribe as subscribeToLocalStore,
} from '@src/localChallenge/localChallengeStore';
import {
  findActiveNonDailySession,
  getDailyAvailability,
  reconcileDailySessions,
  type ActiveLocalResumeSession,
  type DailyAvailabilitySnapshot,
} from '@src/localChallenge/dailyLifecycle';
import { createRandomSeed } from '@src/localChallenge/seedInput';
import { startLocalPlay } from '@src/localChallenge/startLocalPlay';
import { canonicalizeDictionaryId, supportsCurrentTargetPattern } from '@src/dictionary/dictionaryAdapter';
import { DESIGN_TOKEN_SETS } from '@src/theme/designTokens';
import { getDailyQuote } from '@src/config/dailyQuotes';
import { RootStackParamList } from '@src/navigation/AppNavigator';
import { botJoinPublic, createGame, fetchGameState, joinGame, markReady, submitWords } from '@lib/api';
import { useGameState } from '@hooks/useGameState';
import useSessionStore from '@stores/sessionStore';
import useUIStore, { ThemeDefinition } from '@stores/uiStore';
import useUserStore from '@stores/userStore';
import HeaderChip from '@ui/HeaderChip';
import HintTile from '@ui/HintTile';
import ScreenFrame from '@ui/ScreenFrame';
import SegmentButton from '@ui/SegmentButton';

type LobbyTab = 'create' | 'join';

type LobbyTabButtonProps = {
  label: string;
  isActive: boolean;
  onPress: () => void;
  theme: ThemeDefinition;
};

/**
 * Renders a single tab button for the classic (non-Crossroads) lobby layout.
 * Inputs: label text, active flag, press handler, and active theme colors.
 * Output: Pressable tab used by the legacy parchment UI.
 */
function LobbyTabButton({ label, isActive, onPress, theme }: LobbyTabButtonProps): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      style={({ pressed }) => [
        styles.tabButton,
        {
          backgroundColor: isActive ? theme.accent : theme.secondaryButtonBackground,
          borderColor: isActive ? theme.accent : theme.secondaryButtonBorder,
        },
        pressed && styles.tabButtonPressed,
      ]}
    >
      <Text style={[styles.tabButtonText, { color: theme.accentText }]}>{label}</Text>
    </Pressable>
  );
}

const tAtlantic = DESIGN_TOKEN_SETS.atlantic;

function AtlanticLobbyHeader({
  username,
  onSettingsPress,
  darkModeEnabled,
}: {
  username: string | undefined;
  onSettingsPress?: () => void;
  darkModeEnabled?: boolean;
}): React.JSX.Element {
  const gear = (
    <Image
      source={require('../../assets/design/icons/GearE1713A.png')}
      style={atlanticStyles.headerGearIcon}
    />
  );
  return (
    <View style={[atlanticStyles.header, darkModeEnabled && { borderColor: '#2d2d2d' }]}>
      <Image
        source={require('../../assets/design/icons/CWMotifRed.png')}
        style={[atlanticStyles.brandIcon, { tintColor: '#E7131A' }]}
        resizeMode="contain"
      />
      <View style={{ flex: 1 }}>
        <Text style={[atlanticStyles.headerTitle, darkModeEnabled && { color: '#f2f2f2' }]}>Lobby</Text>
        {username ? (
          <Text style={[atlanticStyles.headerSub, darkModeEnabled && { color: '#b0b0b0' }]} numberOfLines={1}>
            {username}
          </Text>
        ) : null}
      </View>
      <View style={atlanticStyles.headerIcons}>
        {onSettingsPress ? (
          <Pressable onPress={onSettingsPress} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
            {gear}
          </Pressable>
        ) : (
          <View style={atlanticStyles.headerGearDisabled}>{gear}</View>
        )}
      </View>
    </View>
  );
}

const atlanticStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fdfdfd' },
  scroll: { padding: 16, gap: 16, paddingBottom: 32 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderColor: '#e2e2e2',
  },
  brandIcon: {
    width: 40,
    height: 40,
  },
  headerTitle: {
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 18,
    color: '#000',
  },
  headerSub: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 12,
    color: '#777',
  },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIcon: { fontSize: 18 },
  headerGearIcon: { width: 20, height: 20 },
  headerGearDisabled: { opacity: 0.5 },
  tabRow: { flexDirection: 'row', gap: 10 },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#1e1e1e',
  },
  tabInactive: { backgroundColor: '#fff' },
  tabActive: { backgroundColor: tAtlantic.colors.accent },
  tabText: { fontFamily: tAtlantic.typography.displayFamily, fontSize: 14, color: '#000' },
  tabTextActive: { fontFamily: tAtlantic.typography.displayFamily, fontSize: 14, color: '#fff' },
  card: {
    backgroundColor: '#fff',
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e2e2',
    gap: 12,
  },
  sectionTitle: {
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 18,
    color: '#000',
  },
  divider: { borderBottomWidth: 1, borderColor: '#e4e4e4', marginVertical: 4 },
  gameIdPanel: {
    backgroundColor: '#f8f8f8',
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#e4e4e4',
  },
  gameIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  gameIdValue: {
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 20,
    color: '#000',
  },
  gameIdHelper: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 12,
    color: '#666',
  },
  opponentBotLabel: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 12,
    color: '#555',
    marginTop: 4,
  },
  statusMessage: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 14,
    color: '#444',
  },
  inlineLabel: {
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 12,
    letterSpacing: 1,
    color: '#000',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d7d7d7',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 15,
    color: '#333',
  },
  botToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  botModeRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  botModeChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  botModeChipActive: {
    borderColor: tAtlantic.colors.danger,
    backgroundColor: '#fff5f5',
  },
  botModeChipText: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 11,
    color: '#333',
    textTransform: 'capitalize',
  },
  botComingSoon: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 11,
    color: '#888',
    fontStyle: 'italic',
  },
  buttonMuted: {
    backgroundColor: '#E7131A4D',
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonMutedText: { fontFamily: tAtlantic.typography.displayFamily, fontSize: 16, color: '#fff' },
  buttonSecondary: {
    backgroundColor: '#E7131A',
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonSecondaryDisabled: {
    backgroundColor: '#E7131A4D',
  },
  buttonPrimaryRed: {
    backgroundColor: '#E7131A',
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonSecondaryText: {
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 16,
    color: '#fff',
  },
  buttonOutline: {
    borderWidth: 1,
    borderColor: '#1e1e1e',
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonOutlineText: {
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 16,
    color: '#1e1e1e',
  },
  errorText: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 12,
    color: '#b00000',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: '#fff5f5',
    borderWidth: 1,
    borderColor: '#e8b4b8',
    borderRadius: 8,
    padding: 12,
  },
  errorBannerText: {
    flex: 1,
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 14,
    color: '#b00000',
    flexWrap: 'wrap',
  },
  errorBannerDismiss: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  errorBannerDismissText: {
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 12,
    color: '#b00000',
  },
  devStateLine: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 10,
    color: '#888',
    marginTop: 4,
  },
  devPanel: {
    backgroundColor: '#f0f4f8',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 10,
    marginTop: 8,
    gap: 6,
  },
  devPanelRow: { fontFamily: tAtlantic.typography.bodyFamily, fontSize: 11, color: '#444' },
  devPanelButtons: { flexDirection: 'row', gap: 8, marginTop: 4 },
  devPanelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#ddd',
    borderRadius: 4,
  },
  devPanelBtnText: { fontFamily: tAtlantic.typography.displayFamily, fontSize: 12, color: '#333' },
  devPanelFeedback: { fontFamily: tAtlantic.typography.bodyFamily, fontSize: 11, color: '#0a0', marginTop: 4 },
  devPanelError: { fontFamily: tAtlantic.typography.bodyFamily, fontSize: 11, color: '#b00', marginTop: 4 },
  debugBotWordsCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e2e2',
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
  countdownText: {
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 14,
    color: '#333',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: '#999',
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  segmentTrack: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 0,
    padding: 0,
    marginTop: 4,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 0,
  },
  segmentItemActive: {
    backgroundColor: '#E7131A',
  },
  segmentText: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 13,
    color: '#555',
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#fff',
  },
  quickLinksRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
  },
  quickLink: {
    fontSize: 16,
    color: '#888',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  quickLinkDot: {
    fontSize: 16,
    color: '#bbb',
  },
});

/**
 * Poll GET /games/{gameId}/state until state has "settled" (2 consecutive successful fetches).
 * This ensures the server's state persistence layer is stable before calling bot_join_public.
 * Does not throw; if max attempts are reached, returns and lets botJoinWithRetry handle remainder.
 */
async function waitForGameReadyForBot(apiKey: string, gameId: number): Promise<void> {
  const delays = [200, 250, 300, 400, 500, 600];
  let consecutiveSuccesses = 0;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const state = await fetchGameState(apiKey, gameId);
      // Early exit if game is already finished (terminal state).
      if (state.status === 'finished') return;
      consecutiveSuccesses++;
      // State is "settled" after 2 consecutive successful fetches.
      if (consecutiveSuccesses >= 2) return;
    } catch {
      // State not yet available or other error; reset counter and continue.
      consecutiveSuccesses = 0;
    }
    if (attempt < 5) {
      await new Promise((r) => setTimeout(r, delays[attempt]));
    }
  }
}

export default function LobbyScreen(): React.JSX.Element {
  const username = useUserStore((state) => state.username);
  const theme = useUIStore((state) => state.activeTheme);
  const designTokens = useUIStore((state) => state.designTokens);
  const masterDictionary = useUIStore((s) => s.dictionary);

  // Navigation helper so we can push the Board screen once the game unlocks.
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  // Track whether we have already navigated for the current active status to avoid loops.
  const hasNavigatedToBoard = useRef(false);

  const {
    apiKey,
    activeGameId,
    words,
    setActiveGameId,
    setWord,
  } = useSessionStore();
  const apiKeyTrimmed = (apiKey || '').trim();

  const [activeTab, setActiveTab] = useState<LobbyTab>('create');
  const [joinInput, setJoinInput] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [errorDismissed, setErrorDismissed] = useState(false);
  const [lastAction, setLastAction] = useState<'submit_words' | 'ready' | null>(null);
  const [pollErrorText, setPollErrorText] = useState<string | null>(null);
  const [playVsBot] = useState(false);
  const [botMode] = useState<'easy' | 'normal' | 'hard'>('normal');
  const [isCreating, setIsCreating] = useState(false);
  const [isStartingSolo, setIsStartingSolo] = useState(false);
  const darkModeEnabled = useUIStore((s) => s.darkModeEnabled);
  const atlanticScreenBg = darkModeEnabled ? '#121212' : '#fdfdfd';
  const playVsBotRef = useRef(playVsBot);
  const botModeRef = useRef(botMode);
  playVsBotRef.current = playVsBot;
  botModeRef.current = botMode;

  // ─── First-launch tutorial redirect ───────────────────────
  const hasCompletedTutorial = useUIStore((s) => s.hasCompletedTutorial);
  const uiHydrated = useUIStore((s) => s._hydrated);
  const hasCheckedTutorial = useRef(false);
  useEffect(() => {
    if (!uiHydrated || hasCheckedTutorial.current) return;
    hasCheckedTutorial.current = true;
    if (!hasCompletedTutorial) {
      navigation.navigate('Tutorial', { firstLaunch: true } as any);
    }
  }, [uiHydrated, hasCompletedTutorial, navigation]);

  // Track active local sessions for Resume Game feature
  const [activeLocalSession, setActiveLocalSession] = useState<ActiveLocalResumeSession | null>(() =>
    findActiveNonDailySession(),
  );

  // ─── Daily Puzzle state ───────────────────────────────────
  const [dailySnapshot, setDailySnapshot] = useState<DailyAvailabilitySnapshot>(() => getDailyAvailability());
  const DAILY_GUESS_BUDGET = 25;
  const DAILY_DICTIONARY = 'core';

  const hasCredentials = apiKeyTrimmed.length > 0;
  const serverEnabled = isServerFunctionsEnabled();

  const { data: gameState, isLoading: isStateLoading, error: stateError, invalidate } = useGameState(
    serverEnabled ? (hasCredentials ? apiKeyTrimmed : null) : null,
    serverEnabled ? activeGameId : null,
  );

  const createGameMutation = useMutation({
    mutationFn: () => createGame(apiKeyTrimmed),
    onSuccess: (data) => {
      setActiveGameId(data.game_id);
      setActionError(null);
      invalidate();
    },
    onError: (error: Error) => setActionError(error.message),
  });

  async function botJoinWithRetry(
    apiKeyArg: string,
    gameId: number,
    mode: 'easy' | 'normal' | 'hard',
  ): Promise<void> {
    // 4 attempts with backoff: ~1.4s total coverage (200 + 400 + 800 = 1400ms).
    const delays = [200, 400, 800];
    let lastErr: Error & { status?: number } | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        await botJoinPublic(apiKeyArg, gameId, mode);
        return;
      } catch (e) {
        lastErr = e as Error & { status?: number };
        const status = lastErr.status;
        const isRetryable = status === 400 || status === 404;
        if (!isRetryable || attempt === 3) {
          const msg = `Bot join failed (${status ?? '?'}): ${lastErr.message || 'Unknown error'}`;
          throw new Error(msg);
        }
        await new Promise((r) => setTimeout(r, delays[attempt] ?? 800));
      }
    }
    if (lastErr) {
      const msg = `Bot join failed (${lastErr.status ?? '?'}): ${lastErr.message || 'Unknown error'}`;
      throw new Error(msg);
    }
  }

  const joinGameMutation = useMutation({
    mutationFn: (gameId: number) => joinGame(apiKeyTrimmed, gameId),
    onSuccess: (_, variables) => {
      setActiveGameId(variables);
      setActionError(null);
      setActiveTab('create');
      invalidate();
      navigation.navigate('PreGame');
    },
    onError: (error: Error) => {
      setActionError(error.message);
      Alert.alert('Join Game Error', error.message);
    },
  });

  const submitWordsMutation = useMutation({
    mutationFn: () => {
      if (!activeGameId) {
        throw new Error('No active game.');
      }
      return submitWords(apiKeyTrimmed, activeGameId, words);
    },
    onSuccess: () => {
      setActionError(null);
      setErrorDismissed(false);
      invalidate();
    },
    onError: (error: Error) => {
      const apiErr = error as Error & { status?: number };
      const msg = `HTTP ${apiErr.status ?? '?'}: ${apiErr.message}`;
      setActionError(msg);
      setErrorDismissed(false);
      Alert.alert('Submit Words Error', msg);
    },
  });

  const markReadyMutation = useMutation({
    mutationFn: () => {
      if (!activeGameId) {
        throw new Error('No active game.');
      }
      return markReady(apiKeyTrimmed, activeGameId);
    },
    onSuccess: () => {
      setActionError(null);
      setErrorDismissed(false);
      invalidate();
    },
    onError: (error: Error) => {
      const apiErr = error as Error & { status?: number };
      const msg = `HTTP ${apiErr.status ?? '?'}: ${apiErr.message}`;
      setActionError(msg);
      setErrorDismissed(false);
      Alert.alert('Ready Error', msg);
    },
  });

  // Hard-transition to Board when game becomes active (Legacy/Crossroads flow; Atlantic uses PreGame).
  // Skip navigation while create flow is in progress to avoid acting on previous activeGameId.
  useEffect(() => {
    if (isCreating) return;
    if (!USE_ATLANTIC_SKIN && gameState?.status === 'active' && activeGameId != null && activeGameId > 0) {
      if (!hasNavigatedToBoard.current) {
        hasNavigatedToBoard.current = true;
        setActionError(null);
        setErrorDismissed(true);
        setLastAction(null);
        navigation.replace('Board');
      }
    } else {
      hasNavigatedToBoard.current = false;
    }
  }, [gameState?.status, activeGameId, navigation, isCreating]);

  const handleCreateGame = useCallback(async () => {
    if (!hasCredentials) {
      setActionError('API key required. Set it on the Title screen.');
      return;
    }
    if (isCreating) return;
    setIsCreating(true);
    setActionError(null);
    try {
      const { game_id } = await createGame(apiKeyTrimmed);
      try {
        await joinGame(apiKeyTrimmed, game_id);
      } catch (joinErr) {
        const err = joinErr as Error & { status?: number };
        if (err.status === 400 && (err.message || '').toLowerCase().includes('already')) {
          // Creator already in game; proceed
        } else {
          throw joinErr;
        }
      }
      if (playVsBot) {
        await waitForGameReadyForBot(apiKeyTrimmed, game_id);
        await botJoinWithRetry(apiKeyTrimmed, game_id, botMode);
      }
      setActiveGameId(game_id);
      invalidate();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setActionError(msg);
      Alert.alert('Create Game Error', msg);
    } finally {
      setIsCreating(false);
    }
  }, [hasCredentials, apiKeyTrimmed, playVsBot, botMode, isCreating, setActiveGameId, invalidate]);

  const handleJoinGame = useCallback(() => {
    if (!hasCredentials) {
      setActionError('API key required. Set it on the Title screen.');
      return;
    }
    const id = Number.parseInt(joinInput, 10);
    if (Number.isNaN(id)) {
      setActionError('Enter a numeric game ID before joining.');
      return;
    }
    joinGameMutation.mutate(id);
  }, [joinGameMutation, joinInput, hasCredentials]);

  /** Valid for Submit Words: exactly 5 words, 2x4-letter, 2x5-letter, 1x6-letter, alphabetic only, unique. */
  const areWordsValidForSubmit = useMemo(() => {
    const clean = (w: string) => (w || '').trim().toUpperCase().replace(/[^A-Z]/g, '');
    const cleaned = words.map(clean);
    if (cleaned.length !== 5) return false;
    const lengths = cleaned.map((w) => w.length);
    const counts: Record<number, number> = { 4: 0, 5: 0, 6: 0 };
    for (const len of lengths) {
      if (len !== 4 && len !== 5 && len !== 6) return false;
      counts[len] = (counts[len] ?? 0) + 1;
    }
    if (counts[4] !== 2 || counts[5] !== 2 || counts[6] !== 1) return false;
    return new Set(cleaned).size === 5;
  }, [words]);

  const status = gameState?.status;
  const inPreGame =
    status != null &&
    status !== 'active' &&
    status !== 'finished';
  const me = gameState?.me;
  const canSubmitWords =
    Boolean(inPreGame && me && !me.words_submitted && areWordsValidForSubmit);
  const canMarkReady =
    Boolean(inPreGame && me && me.words_submitted && !me.ready);

  const handleSubmitWords = useCallback(() => {
    if (!activeGameId) {
      setActionError('Create or join a game first.');
      return;
    }
    if (!canSubmitWords) {
      Alert.alert('Invalid State', 'Submit Words is not available in the current game state.');
      return;
    }
    if (submitWordsMutation.isPending) return;
    setLastAction('submit_words');
    submitWordsMutation.mutate();
  }, [activeGameId, canSubmitWords, submitWordsMutation]);

  const handleMarkReady = useCallback(() => {
    if (!activeGameId) {
      setActionError('Create or join a game first.');
      return;
    }
    if (!canMarkReady) {
      Alert.alert('Invalid State', 'Mark Ready is not available in the current game state.');
      return;
    }
    if (markReadyMutation.isPending) return;
    setLastAction('ready');
    markReadyMutation.mutate();
  }, [activeGameId, canMarkReady, markReadyMutation]);

  const countdownSeconds = useMemo(() => {
    if (!gameState?.start_at) {
      return null;
    }
    const start = new Date(gameState.start_at).getTime();
    return Math.max(0, Math.round((start - Date.now()) / 1000));
  }, [gameState?.start_at]);

  const statusMessage = useMemo(() => {
    if (!activeGameId) {
      return 'Create or join a game to get started.';
    }
    if (!gameState) {
      return isStateLoading ? 'Loading game state.' : 'Waiting for server data.';
    }
    switch (gameState.status) {
      case 'waiting':
        return 'Waiting for both players to submit words and mark ready.';
      case 'starting':
        return 'Countdown in progress. Hang tight!';
      case 'active':
        return gameState.current_turn_user_id === gameState.me.user_id
          ? 'Your turn! Submit a guess from the board screen.'
          : 'Opponent turn. Keep an eye on the history.';
      case 'finished':
        return 'Game finished. Feel free to start a new one!';
      default:
        return `Status: ${gameState.status}`;
    }
  }, [activeGameId, gameState, isStateLoading]);

  const anyMutationPending =
    isCreating ||
    createGameMutation.isPending ||
    joinGameMutation.isPending ||
    submitWordsMutation.isPending ||
    markReadyMutation.isPending;


  const hasError = (actionError || pollErrorText) && !errorDismissed;
  const lobbyErrorText = actionError || pollErrorText || '';
  const lobbyDisplayError = lobbyErrorText;
  // Mirror poll error so we can clear it when polling recovers
  useEffect(() => {
    if (stateError) {
      setPollErrorText(stateError.message);
      setErrorDismissed(false);
    }
  }, [stateError]);

  // When /state polling returns valid data, clear stale poll error and any orphan actionError
  useEffect(() => {
    if (gameState != null && typeof gameState.status === 'string') {
      setPollErrorText(null);
      if (lastAction === null) setActionError(null);
    }
  }, [gameState, lastAction]);

  const refreshLocalCards = useCallback((snapshot?: DailyAvailabilitySnapshot) => {
    setDailySnapshot(snapshot ?? getDailyAvailability());
    setActiveLocalSession(findActiveNonDailySession());
  }, []);

  const hasActiveNonDailySession = activeLocalSession != null;

  const handleModePress = useCallback(
    (onProceed: () => void) => {
      if (!hasActiveNonDailySession) {
        onProceed();
        return;
      }
      Alert.alert(
        'Abandon Active Puzzle?',
        'Starting a new game will discard your current progress.',
        [
          { text: 'Keep Playing', style: 'cancel' },
          {
            text: 'Start New Game',
            style: 'destructive',
            onPress: () => {
              deleteSession(activeLocalSession!.id);
              setActiveLocalSession(null);
              onProceed();
            },
          },
        ]
      );
    },
    [hasActiveNonDailySession, activeLocalSession]
  );

  useEffect(() => {
    let cancelled = false;

    void reconcileDailySessions()
      .then((snapshot) => {
        if (!cancelled) {
          refreshLocalCards(snapshot);
        }
      })
      .catch(() => {
        if (!cancelled) {
          refreshLocalCards();
        }
      });

    const unsubscribe = subscribeToLocalStore(() => {
      refreshLocalCards();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [refreshLocalCards]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      void reconcileDailySessions()
        .then((snapshot) => {
          refreshLocalCards(snapshot);
        })
        .catch(() => {
          refreshLocalCards();
        });
    });
    return unsubscribe;
  }, [navigation, refreshLocalCards]);

  // Atlantic skin: layout matching AtlanticLobbyPreview, wired to real logic
  if (USE_ATLANTIC_SKIN) {
    const atlCard = darkModeEnabled ? { backgroundColor: '#1b1b1b', borderColor: '#2d2d2d' } : null;
    const atlTitle = darkModeEnabled ? { color: '#f2f2f2' } : null;
    const atlSub = darkModeEnabled ? { color: '#c4c4c4' } : null;
    const atlDivider = darkModeEnabled ? { borderColor: '#303030' } : null;
    const atlError = darkModeEnabled ? { backgroundColor: '#2b1717', borderColor: '#7a2a2a' } : null;
    return (
      <SafeAreaView style={[atlanticStyles.screen, { backgroundColor: atlanticScreenBg }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          {hasError ? (
            <View style={[atlanticStyles.errorBanner, atlError, { marginHorizontal: 16, marginTop: 8, marginBottom: 4 }]}>
              <Text style={atlanticStyles.errorBannerText}>{lobbyDisplayError}</Text>
              <Pressable
                onPress={() => {
                  setActionError(null);
                  setPollErrorText(null);
                  setErrorDismissed(true);
                }}
                style={atlanticStyles.errorBannerDismiss}
                hitSlop={8}
              >
                <Text style={atlanticStyles.errorBannerDismissText}>Dismiss</Text>
              </Pressable>
            </View>
          ) : null}
          <ScrollView contentContainerStyle={[atlanticStyles.scroll, { backgroundColor: atlanticScreenBg }]} keyboardShouldPersistTaps="handled">
            <AtlanticLobbyHeader
              username={username}
              onSettingsPress={() => navigation.navigate('Settings')}
              darkModeEnabled={darkModeEnabled}
            />

            {/* Resume Game — only for non-daily active sessions (bot / free solo) */}
            {activeLocalSession ? (
              <View style={[atlanticStyles.card, atlCard, { borderColor: tAtlantic.colors.accent }]}>
                <Text style={[atlanticStyles.sectionTitle, atlTitle]}>Resume Game</Text>
                <View style={[atlanticStyles.divider, atlDivider]} />
                <Text style={[atlanticStyles.inlineLabel, atlSub]}>
                  Continue your {activeLocalSession.mode === 'bot' ? 'Bot' : 'Solo'} game in progress
                </Text>
                <Pressable
                  onPress={() => {
                    navigation.navigate('Board', {
                      mode: activeLocalSession.mode,
                      sessionId: activeLocalSession.id,
                    });
                  }}
                  style={({ pressed }) => [
                    atlanticStyles.buttonSecondary,
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Text style={atlanticStyles.buttonSecondaryText}>Resume</Text>
                </Pressable>
              </View>
            ) : null}

            {/* Daily Puzzle card */}
            {(() => {
              const dailyDate = dailySnapshot.todayDate;
              const totalDailyGuesses = dailySnapshot.guessesUsed;
              const dailyLimit = dailySnapshot.guessLimit || DAILY_GUESS_BUDGET;
              const dailyAllSolved = dailySnapshot.status === 'won';
              const dailyOutOfGuesses = dailySnapshot.status === 'lost';
              const dailyCompleted = dailyAllSolved || dailyOutOfGuesses;
              const dailyInProgress = dailySnapshot.status === 'resume';
              const dailyDateObj = new Date(`${dailyDate}T12:00:00`);
              const dailyDateLabel = dailyDateObj.toLocaleDateString(
                undefined,
                { month: 'short', day: 'numeric', year: 'numeric' },
              );
              const dailyQuote = getDailyQuote(dailyDateObj);

              return (
                <View style={[atlanticStyles.card, atlCard, { borderLeftWidth: 3, borderLeftColor: '#E7131A', justifyContent: 'space-between' }]}>
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={[atlanticStyles.sectionTitle, atlTitle]}>Daily Puzzle</Text>
                      {dailyAllSolved && (
                        <Text style={{ color: '#2a9d60', fontWeight: '700', fontSize: 13 }}>Completed ✓</Text>
                      )}
                      {dailyOutOfGuesses && (
                        <Text style={{ color: '#c0392b', fontWeight: '700', fontSize: 13 }}>Failed</Text>
                      )}
                      {dailyInProgress && (
                        <Text style={{ color: '#e7a000', fontWeight: '600', fontSize: 13 }}>In Progress</Text>
                      )}
                    </View>
                    <View style={[atlanticStyles.divider, atlDivider]} />
                    <Text style={[atlanticStyles.inlineLabel, atlSub]}>{dailyDateLabel}</Text>
                    <Text style={[atlanticStyles.inlineLabel, atlSub, { marginTop: 8, letterSpacing: 0 }]}>
                      <Text style={{ fontStyle: 'italic' }}>{`"${dailyQuote.text}"`}</Text>
                      {dailyQuote.attribution ? (
                        <Text>{'\n'}{'     '}<Text style={{ fontSize: 10 }}>{`— ${dailyQuote.attribution}`}</Text></Text>
                      ) : null}
                    </Text>
                  </View>

                  {/* Progress line when session is active */}
                  {dailyInProgress && (
                    <Text style={[atlanticStyles.inlineLabel, atlSub]}>
                      {dailyLimit - totalDailyGuesses} guesses remaining
                    </Text>
                  )}

                  <Pressable
                    disabled={dailyCompleted}
                    onPress={() => {
                      handleModePress(() => {
                        try {
                          const sessionId =
                            dailySnapshot.status === 'resume' && dailySnapshot.sessionId
                              ? dailySnapshot.sessionId
                              : getOrCreateDailySession({
                                  date: dailyDate,
                                  dictionaryId: DAILY_DICTIONARY,
                                  difficulty: 'daily',
                                  guessTurnLimit: DAILY_GUESS_BUDGET,
                                });
                          refreshLocalCards();
                          navigation.navigate('Board', { mode: 'solo', sessionId });
                        } catch (error) {
                          const message =
                            error instanceof Error
                              ? error.message
                              : 'Could not start daily puzzle. Please try again.';
                          Alert.alert('Daily Puzzle', message);
                        }
                      });
                    }}
                    style={({ pressed }) => [
                      atlanticStyles.buttonSecondary,
                      (dailyCompleted || hasActiveNonDailySession) && atlanticStyles.buttonSecondaryDisabled,
                      pressed && !dailyCompleted && !hasActiveNonDailySession && { opacity: 0.9 },
                    ]}
                  >
                    <Text style={atlanticStyles.buttonSecondaryText}>
                      {dailyCompleted
                        ? dailyAllSolved
                          ? 'Done ✓'
                          : 'Game Over'
                        : dailyInProgress
                        ? 'Resume'
                        : 'Play'}
                    </Text>
                  </Pressable>
                </View>
              );
            })()}

            <View style={{ flexDirection: 'row', gap: 12 }}>
              {/* Solitaire */}
              <View style={[atlanticStyles.card, atlCard, { flex: 1, justifyContent: 'space-between' }]}>
                <View>
                  <Text style={[atlanticStyles.sectionTitle, atlTitle]}>Solitaire</Text>
                  <View style={[atlanticStyles.divider, atlDivider]} />
                  <Text style={[atlanticStyles.inlineLabel, atlSub]}>Hone your blade.</Text>
                  <Text style={[atlanticStyles.inlineLabel, atlSub, { marginTop: 10 }]}><Text style={{ fontStyle: 'italic' }}>I am myself alone.</Text>{'\n'}{'     '}<Text style={{ fontSize: 10 }}>— Richard III</Text></Text>
                </View>
                <Pressable
                  onPress={() => {
                    handleModePress(() => {
                      if (isStartingSolo) return;
                      setIsStartingSolo(true);
                      try {
                        const seed = createRandomSeed();
                        const canonicalDictionary = canonicalizeDictionaryId(masterDictionary);
                        if (!supportsCurrentTargetPattern(canonicalDictionary)) {
                          Alert.alert('Unsupported dictionary', 'This dictionary needs a different game mode pattern.');
                          return;
                        }
                        const sessionId = createSeedSession({
                          seed,
                          dictionaryId: canonicalDictionary,
                          difficulty: undefined,
                          timerLimitSeconds: undefined,
                        });
                        navigation.navigate('Board', { mode: 'solo', sessionId });
                      } catch (error) {
                        const message =
                          error instanceof Error
                            ? error.message
                            : 'Could not start solo game. Please try again.';
                        Alert.alert('Could not start solo game', message);
                      } finally {
                        setIsStartingSolo(false);
                      }
                    });
                  }}
                  style={({ pressed }) => [
                    atlanticStyles.buttonSecondary,
                    (isStartingSolo || hasActiveNonDailySession) && atlanticStyles.buttonSecondaryDisabled,
                    pressed && !hasActiveNonDailySession && { opacity: 0.9 },
                  ]}
                  disabled={isStartingSolo}
                >
                  <Text style={[atlanticStyles.buttonSecondaryText, { fontSize: 14 }]}>
                    {isStartingSolo ? 'Starting...' : 'Play'}
                  </Text>
                </Pressable>
              </View>

              {/* Duel */}
              <View style={[atlanticStyles.card, atlCard, { flex: 1, justifyContent: 'space-between' }]}>
                <View>
                  <Text style={[atlanticStyles.sectionTitle, atlTitle]}>Duel</Text>
                  <View style={[atlanticStyles.divider, atlDivider]} />
                  <Text style={[atlanticStyles.inlineLabel, atlSub, { letterSpacing: 0.5 }]}>Against the house.</Text>
                  <Text style={[atlanticStyles.inlineLabel, atlSub, { marginTop: 10 }]}><Text style={{ fontStyle: 'italic' }}>Have at thee!</Text>{'\n'}{'     '}<Text style={{ fontSize: 10 }}>— Tybalt</Text></Text>
                </View>
                <Pressable
                  onPress={() => handleModePress(() => navigation.navigate('BotSetup'))}
                  style={({ pressed }) => [
                    atlanticStyles.buttonSecondary,
                    hasActiveNonDailySession && atlanticStyles.buttonSecondaryDisabled,
                    pressed && !hasActiveNonDailySession && { opacity: 0.9 },
                  ]}
                >
                  <Text style={[atlanticStyles.buttonSecondaryText, { fontSize: 14 }]}>Play</Text>
                </Pressable>
              </View>
            </View>

            <View style={[atlanticStyles.card, atlCard, { justifyContent: 'space-between' }]}>
              <View>
                <Text style={[atlanticStyles.sectionTitle, atlTitle]}>Challenge</Text>
                <View style={[atlanticStyles.divider, atlDivider]} />
                <Text style={[atlanticStyles.inlineLabel, atlSub]}>Send a word duel to a friend.</Text>
                <Text style={[atlanticStyles.inlineLabel, atlSub, { marginTop: 10 }]}><Text style={{ fontStyle: 'italic' }}>Come, friend — your passado!</Text> <Text style={{ fontSize: 10 }}>— Mercutio</Text></Text>
              </View>
              <Pressable
                onPress={() => handleModePress(() => navigation.navigate('FriendWizard'))}
                style={({ pressed }) => [
                  atlanticStyles.buttonSecondary,
                  hasActiveNonDailySession && atlanticStyles.buttonSecondaryDisabled,
                  pressed && !hasActiveNonDailySession && { opacity: 0.9 },
                ]}
              >
                <Text style={atlanticStyles.buttonSecondaryText}>Play</Text>
              </Pressable>
            </View>

            {/* Quick Links — compact text row */}
            <View style={atlanticStyles.quickLinksRow}>
              <Pressable onPress={() => navigation.navigate('Jotts')}>
                <Text style={[atlanticStyles.quickLink, atlSub]}>Jotts</Text>
              </Pressable>
              <Text style={[atlanticStyles.quickLinkDot, atlSub]}> · </Text>
              <Pressable onPress={() => navigation.navigate('Stats' as never)}>
                <Text style={[atlanticStyles.quickLink, atlSub]}>Ledger</Text>
              </Pressable>
              <Text style={[atlanticStyles.quickLinkDot, atlSub]}> · </Text>
              <Pressable onPress={() => navigation.navigate('Tutorial')}>
                <Text style={[atlanticStyles.quickLink, atlSub]}>Primer</Text>
              </Pressable>
              <Text style={[atlanticStyles.quickLinkDot, atlSub]}> · </Text>
              <Pressable onPress={() => navigation.navigate('GameModes' as never)}>
                <Text style={[atlanticStyles.quickLink, atlSub]}>Game Modes</Text>
              </Pressable>
            </View>

            <ThemePicker />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  const crossroadsInputStyle = {
    backgroundColor: designTokens.colors.surfacePrimary,
    borderColor: designTokens.colors.borderStrong,
    borderRadius: designTokens.radii.md,
    paddingHorizontal: designTokens.spacing.sm,
    paddingVertical: designTokens.spacing.sm,
    color: designTokens.colors.textPrimary,
    fontFamily: designTokens.typography.bodyFamily,
    fontSize: designTokens.typography.baseSize,
    borderWidth: 1,
  };

  // Crossroads visual refresh mirrors the Title screen styling when the flag is on.
  if (ENABLE_CROSSROADS_STYLES) {
    const statusBadge = countdownSeconds !== null ? (
      <View
        style={{
          alignSelf: 'center',
          borderRadius: designTokens.radii.full,
          paddingHorizontal: designTokens.spacing.md,
          paddingVertical: designTokens.spacing.xs,
          backgroundColor: designTokens.colors.surfacePrimary,
          borderWidth: 1,
          borderColor: designTokens.colors.borderSubtle,
        }}
      >
        <Text
          style={{
            color: designTokens.colors.textPrimary,
            fontFamily: designTokens.typography.displayFamily,
            fontSize: designTokens.typography.headingSize,
            letterSpacing: 2,
          }}
        >
          {countdownSeconds}
        </Text>
      </View>
    ) : null;

    const pillTextStyle = {
      color: designTokens.colors.textSecondary,
      fontFamily: designTokens.typography.bodyFamily,
      fontSize: designTokens.typography.baseSize,
      lineHeight: designTokens.typography.baseSize * 1.4,
    };

    const cardSurfaceStyle = {
      backgroundColor: designTokens.colors.surfacePrimary,
      borderRadius: designTokens.radii.md,
      padding: designTokens.spacing.md,
      gap: designTokens.spacing.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: designTokens.colors.borderSubtle,
      shadowColor: designTokens.shadows.soft.color,
      shadowOffset: designTokens.shadows.soft.offset,
      shadowOpacity: designTokens.shadows.soft.opacity,
      shadowRadius: designTokens.shadows.soft.radius,
    };

    return (
      <ScreenFrame edgeToEdge>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              backgroundColor: designTokens.colors.canvas,
            }}
            keyboardShouldPersistTaps="handled"
          >
            <View
              style={{
                paddingHorizontal: designTokens.spacing.lg,
                paddingTop: designTokens.spacing.lg + 8,
                paddingBottom: designTokens.spacing.md,
                backgroundColor: designTokens.colors.canvas,
                gap: designTokens.spacing.md,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: designTokens.spacing.sm,
                }}
              >
                <HeaderChip label="Citizenware" subLabel="Fantasy" />
                <View
                  style={{
                    width: 80,
                    height: 80,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: designTokens.colors.accent,
                      fontFamily: designTokens.typography.displayFamily,
                      fontSize: designTokens.typography.headingSize + 2,
                    }}
                  >
                    *
                  </Text>
                </View>
                <HeaderChip label="Citrestanare" subLabel="Guild Lobby" align="right" />
              </View>
            </View>

            <View
              style={{
                backgroundColor: designTokens.colors.surfaceHighlight,
                borderTopLeftRadius: designTokens.radii.lg,
                borderTopRightRadius: designTokens.radii.lg,
                borderBottomLeftRadius: designTokens.radii.md / 2,
                borderBottomRightRadius: designTokens.radii.md / 2,
                marginHorizontal: designTokens.spacing.lg,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  backgroundColor: designTokens.colors.surfacePrimary,
                  paddingHorizontal: designTokens.spacing.lg,
                  paddingVertical: designTokens.spacing.xs,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    gap: designTokens.spacing.xs,
                    backgroundColor: designTokens.colors.surfacePrimary,
                    borderRadius: designTokens.radii.md,
                    paddingHorizontal: designTokens.spacing.md,
                    paddingVertical: designTokens.spacing.xs * 0.5,
                    alignItems: 'center',
                  }}
                >
                  <SegmentButton
                    label="Create Duel"
                    active={activeTab === 'create'}
                    onPress={() => setActiveTab('create')}
                    style={{ flex: 1 }}
                    variant="bare"
                  />
                  <SegmentButton
                    label="Join Duel"
                    active={activeTab === 'join'}
                    onPress={() => setActiveTab('join')}
                    style={{ flex: 1 }}
                    variant="bare"
                  />
                  <SegmentButton label="Themes" style={{ flex: 1 }} variant="bare" />
                </View>
              </View>

              {hasError ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 8,
                    marginHorizontal: designTokens.spacing.lg,
                    marginTop: designTokens.spacing.sm,
                    backgroundColor: '#fff5f5',
                    borderWidth: 1,
                    borderColor: '#e8b4b8',
                    borderRadius: designTokens.radii.md,
                    padding: designTokens.spacing.md,
                  }}
                >
                  <Text
                    style={{
                      flex: 1,
                      fontFamily: designTokens.typography.bodyFamily,
                      fontSize: designTokens.typography.baseSize,
                      color: '#b00000',
                    }}
                  >
                    {lobbyDisplayError}
                  </Text>
                  <Pressable onPress={() => { setActionError(null); setPollErrorText(null); setErrorDismissed(true); }} hitSlop={8}>
                    <Text
                      style={{
                        fontFamily: designTokens.typography.displayFamily,
                        fontSize: 12,
                        color: '#b00000',
                      }}
                    >
                      Dismiss
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              <View
                style={{
                  paddingHorizontal: designTokens.spacing.lg,
                  paddingBottom: designTokens.spacing.lg,
                  paddingTop: designTokens.spacing.lg,
                  gap: designTokens.spacing.lg,
                }}
              >
                <View style={{ gap: designTokens.spacing.sm }}>
                  <Text
                    accessibilityRole="header"
                    style={{
                      color: designTokens.colors.textPrimary,
                      fontFamily: designTokens.typography.displayFamily,
                      fontSize: designTokens.typography.headingSize + 4,
                      letterSpacing: 2,
                      textAlign: 'center',
                    }}
                  >
                    Guild Lobby
                  </Text>
                  <Text
                    style={{
                      color: designTokens.colors.textSecondary,
                      fontFamily: designTokens.typography.bodyFamily,
                      fontSize: designTokens.typography.baseSize,
                      lineHeight: designTokens.typography.baseSize * 1.4,
                      textAlign: 'center',
                    }}
                  >
                    Ready your scrolls, {username || 'traveler'}. Create a duel or join a friend, submit your five secret words, then mark yourself ready.
                  </Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'center',
                      gap: designTokens.spacing.xs,
                    }}
                  >
                    <HintTile letter="L" status="correct" />
                    <HintTile letter="O" status="present" />
                    <HintTile letter="B" status="absent" />
                    <HintTile letter="B" status="correct" />
                    <HintTile letter="Y" status="present" />
                  </View>
                </View>

                <View
                  style={{
                    flexDirection: 'row',
                    gap: designTokens.spacing.sm,
                    flexWrap: 'wrap',
                  }}
                >
                  <View style={[cardSurfaceStyle, { flex: 1, minWidth: 220 }]}>
                    <Text
                      style={{
                        color: designTokens.colors.textSecondary,
                        fontFamily: designTokens.typography.bodyFamily,
                        fontSize: designTokens.typography.captionSize,
                        letterSpacing: 2,
                      }}
                    >
                      SESSION STATUS
                    </Text>
                    <Text style={pillTextStyle}>API key: {hasCredentials ? 'Loaded' : 'Missing'}</Text>
                    <Text style={pillTextStyle}>Active game: {activeGameId ?? 'None yet'}</Text>
                    <Text style={pillTextStyle}>Server status: {statusMessage}</Text>
                    {pollErrorText ? (
                      <Text
                        style={{
                          color: designTokens.colors.danger,
                          fontFamily: designTokens.typography.bodyFamily,
                          fontSize: designTokens.typography.captionSize,
                        }}
                      >
                        {pollErrorText}
                      </Text>
                    ) : null}
                    {actionError ? (
                      <Text
                        style={{
                          color: designTokens.colors.danger,
                          fontFamily: designTokens.typography.bodyFamily,
                          fontSize: designTokens.typography.captionSize,
                        }}
                      >
                        {actionError}
                      </Text>
                    ) : null}
                  </View>
                  <View style={[cardSurfaceStyle, { flex: 1, minWidth: 220, alignItems: 'center' }]}>
                    <Text
                      style={{
                        color: designTokens.colors.textSecondary,
                        fontFamily: designTokens.typography.bodyFamily,
                        fontSize: designTokens.typography.captionSize,
                        letterSpacing: 2,
                      }}
                    >
                      MATCH TIMER
                    </Text>
                    {statusBadge}
                    <Text
                      style={{
                        color: designTokens.colors.textPrimary,
                        fontFamily: designTokens.typography.displayFamily,
                        fontSize: designTokens.typography.baseSize,
                        textAlign: 'center',
                      }}
                    >
                      {countdownSeconds !== null
                        ? 'Countdown until the board unlocks.'
                        : 'Waiting for both players to mark ready.'}
                    </Text>
                  </View>
                </View>
                {activeTab === 'create' ? (
                  <View style={[cardSurfaceStyle, { gap: designTokens.spacing.md }]}>
                    <Text
                      style={{
                        color: designTokens.colors.textPrimary,
                        fontFamily: designTokens.typography.displayFamily,
                        fontSize: designTokens.typography.headingSize,
                      }}
                    >
                      Create a new duel
                    </Text>
                    <Text style={pillTextStyle}>
                      Tap create to get a game ID, then share it. Fill in five words so the server can place them on the board automatically.
                    </Text>
                    <Pressable
                      onPress={handleCreateGame}
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        {
                          paddingVertical: designTokens.spacing.sm,
                          borderRadius: designTokens.radii.md,
                          alignItems: 'center',
                          backgroundColor: designTokens.colors.accent,
                          opacity: pressed || anyMutationPending ? 0.9 : 1,
                        },
                      ]}
                      disabled={anyMutationPending}
                    >
                      <Text
                        style={{
                          color: designTokens.colors.accentText,
                          fontFamily: designTokens.typography.displayFamily,
                          fontSize: designTokens.typography.baseSize + 1,
                          letterSpacing: 2,
                        }}
                      >
                        {createGameMutation.isPending ? 'Creating...' : 'Create game'}
                      </Text>
                    </Pressable>

                    <View style={{ gap: designTokens.spacing.sm }}>
                      <Text
                        style={{
                          color: designTokens.colors.textSecondary,
                          fontFamily: designTokens.typography.bodyFamily,
                          fontSize: designTokens.typography.captionSize,
                          letterSpacing: 2,
                        }}
                      >
                        YOUR WORDS
                      </Text>
                      <Text style={pillTextStyle}>Five letters minimum; letters only.</Text>
                      {words.map((word, index) => (
                        <TextInput
                          key={`word-${index}`}
                          accessibilityLabel={`Word ${index + 1}`}
                          placeholder={`Word ${index + 1}`}
                          value={word}
                          onChangeText={(value) => setWord(index, value)}
                          style={crossroadsInputStyle}
                          placeholderTextColor={designTokens.colors.textSecondary}
                          autoCapitalize="characters"
                        />
                      ))}
                      {inPreGame && !me?.words_submitted && (
                        <Pressable
                          onPress={handleSubmitWords}
                          accessibilityRole="button"
                          style={({ pressed }) => [
                            {
                              paddingVertical: designTokens.spacing.sm,
                              borderRadius: designTokens.radii.md,
                              alignItems: 'center',
                              backgroundColor: designTokens.colors.surfaceHighlight,
                              borderWidth: 1,
                              borderColor: designTokens.colors.borderSubtle,
                              opacity: pressed || submitWordsMutation.isPending ? 0.9 : 1,
                            },
                          ]}
                          disabled={!canSubmitWords || submitWordsMutation.isPending}
                        >
                          <Text
                            style={{
                              color: designTokens.colors.textPrimary,
                              fontFamily: designTokens.typography.displayFamily,
                              fontSize: designTokens.typography.baseSize,
                              letterSpacing: 1,
                            }}
                          >
                            {submitWordsMutation.isPending ? 'Submitting...' : 'Submit words'}
                          </Text>
                        </Pressable>
                      )}
                      {inPreGame && me?.words_submitted && !me?.ready && (
                        <Pressable
                          onPress={handleMarkReady}
                          accessibilityRole="button"
                          style={({ pressed }) => [
                            {
                              paddingVertical: designTokens.spacing.sm,
                              borderRadius: designTokens.radii.md,
                              alignItems: 'center',
                              backgroundColor: 'transparent',
                              borderWidth: 1,
                              borderColor: designTokens.colors.borderStrong,
                              opacity: pressed || markReadyMutation.isPending ? 0.9 : 1,
                            },
                          ]}
                          disabled={!canMarkReady || markReadyMutation.isPending}
                        >
                        <Text
                          style={{
                            color: designTokens.colors.textPrimary,
                            fontFamily: designTokens.typography.bodyFamily,
                            fontSize: designTokens.typography.baseSize,
                            letterSpacing: 1,
                          }}
                        >
                          {markReadyMutation.isPending ? 'Marking...' : 'Mark ready'}
                        </Text>
                      </Pressable>
                      )}
                    </View>
                  </View>
                ) : (
                  <View style={[cardSurfaceStyle, { gap: designTokens.spacing.md }]}>
                    <Text
                      style={{
                        color: designTokens.colors.textPrimary,
                        fontFamily: designTokens.typography.displayFamily,
                        fontSize: designTokens.typography.headingSize,
                      }}
                    >
                      Join a duel
                    </Text>
                    <Text style={pillTextStyle}>
                      Ask your friend for their game ID, enter it, and step into the same lobby.
                    </Text>
                    <TextInput
                      accessibilityLabel="Game ID"
                      placeholder="Game ID"
                      value={joinInput}
                      onChangeText={setJoinInput}
                      style={crossroadsInputStyle}
                      placeholderTextColor={designTokens.colors.textSecondary}
                      keyboardType="number-pad"
                    />
                    <Pressable
                      onPress={handleJoinGame}
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        {
                          paddingVertical: designTokens.spacing.sm,
                          borderRadius: designTokens.radii.md,
                          alignItems: 'center',
                          backgroundColor: designTokens.colors.accent,
                          opacity: pressed || joinGameMutation.isPending ? 0.9 : 1,
                        },
                      ]}
                      disabled={joinGameMutation.isPending}
                    >
                      <Text
                        style={{
                          color: designTokens.colors.accentText,
                          fontFamily: designTokens.typography.displayFamily,
                          fontSize: designTokens.typography.baseSize + 1,
                          letterSpacing: 2,
                        }}
                      >
                        {joinGameMutation.isPending ? 'Joining...' : 'Join game'}
                      </Text>
                    </Pressable>
                  </View>
                )}

                {gameState ? (
                  <View style={[cardSurfaceStyle, { gap: designTokens.spacing.sm }]}>
                    <Text
                      style={{
                        color: designTokens.colors.textSecondary,
                        fontFamily: designTokens.typography.bodyFamily,
                        fontSize: designTokens.typography.captionSize,
                        letterSpacing: 2,
                      }}
                    >
                      GAME SNAPSHOT
                    </Text>
                    <Text style={pillTextStyle}>Status: {gameState.status}</Text>
                    <Text style={pillTextStyle}>Your ID: {gameState.me.user_id}</Text>
                    <Text style={pillTextStyle}>
                      Current turn user ID: {gameState.current_turn_user_id ?? '-'}
                    </Text>
                    <Text style={pillTextStyle}>
                      Your progress letters: {gameState.your_progress_letters}
                    </Text>
                    <Text style={pillTextStyle}>
                      Opponent progress letters: {gameState.opponent_progress_letters}
                    </Text>
                    {gameState.status === 'active' ? (
                      <Pressable
                        onPress={() => navigation.navigate('Board')}
                        accessibilityRole="button"
                        accessibilityLabel="Open the board screen"
                        style={({ pressed }) => [
                          {
                            paddingVertical: designTokens.spacing.sm,
                            borderRadius: designTokens.radii.md,
                            alignItems: 'center',
                            backgroundColor: designTokens.colors.accent,
                            opacity: pressed ? 0.92 : 1,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: designTokens.colors.accentText,
                            fontFamily: designTokens.typography.displayFamily,
                            fontSize: designTokens.typography.baseSize + 1,
                            letterSpacing: 1,
                          }}
                        >
                          Go to board
                        </Text>
                      </Pressable>
                    ) : null}

                    <Pressable
                      onPress={() => invalidate()}
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        {
                          paddingVertical: designTokens.spacing.sm,
                          borderRadius: designTokens.radii.md,
                          alignItems: 'center',
                          borderWidth: 1,
                          borderColor: designTokens.colors.borderStrong,
                          backgroundColor: 'transparent',
                          opacity: pressed ? 0.9 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: designTokens.colors.textPrimary,
                          fontFamily: designTokens.typography.bodyFamily,
                          fontSize: designTokens.typography.baseSize,
                          letterSpacing: 1,
                        }}
                      >
                        Refresh state now
                      </Text>
                    </Pressable>
                  </View>
                ) : null}

                <View style={[cardSurfaceStyle, { paddingBottom: designTokens.spacing.sm }]}>
                  <Text
                    style={{
                      color: designTokens.colors.textSecondary,
                      fontFamily: designTokens.typography.bodyFamily,
                      fontSize: designTokens.typography.captionSize,
                      letterSpacing: 2,
                    }}
                  >
                    THEMES
                  </Text>
                  <ThemePicker />
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </ScreenFrame>
    );
  }

  // Legacy parchment lobby remains for anyone using the classic theme.
  return (
    <LinearGradient colors={theme.backgroundGradient} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.container}>
          <Text accessibilityRole="header" style={[styles.heading, { color: theme.textPrimary }]}>
            Welcome, {username || 'player'}
          </Text>
          <Text style={[styles.subheading, { color: theme.textSecondary }]}>{statusMessage}</Text>
          {/* Optional entries to serverless challenge flows; do not affect server mode */}
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button
              title="Local Play"
              onPress={() => startLocalPlay({ navigation: navigation as any, dictionaryId: canonicalizeDictionaryId(masterDictionary) })}
              color="#d33"
            />
            <Button
              title="Enter Challenge Code"
              onPress={() => navigation.navigate('Challenge' as never)}
            />
            <Button title="Challenge History" onPress={() => navigation.navigate('ChallengeHistory' as never)} />
          </View>

          {hasError ? (
            <View style={[styles.errorBanner, { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }]}>
              <Text style={[styles.errorBannerText, { flex: 1 }]}>{lobbyDisplayError}</Text>
              <Pressable onPress={() => { setActionError(null); setPollErrorText(null); setErrorDismissed(true); }} hitSlop={8} style={{ paddingVertical: 4, paddingHorizontal: 8 }}>
                <Text style={styles.errorBannerText}>Dismiss</Text>
              </Pressable>
            </View>
          ) : null}

          {countdownSeconds !== null ? (
            <View
              style={[
                styles.countdownBadge,
                { backgroundColor: theme.secondaryButtonBackground, borderColor: theme.accent },
              ]}
            >
              <Text style={[styles.countdownText, { color: theme.textPrimary }]}>{countdownSeconds}</Text>
            </View>
          ) : null}

          <View
            style={[
              styles.sessionCard,
              { backgroundColor: theme.surfacePrimary, borderColor: theme.secondaryButtonBorder },
            ]}
          >
            <Text style={[styles.cardHeading, { color: theme.textPrimary }]}>Session</Text>
            <Text style={[styles.cardCopy, { color: theme.textSecondary }]}>API key loaded: {hasCredentials ? 'Yes' : 'No'}</Text>
            <Text style={[styles.cardCopy, { color: theme.textSecondary }]}>Active game ID: {activeGameId ?? 'None'}</Text>
            {pollErrorText ? <Text style={[styles.cardCopy, styles.errorText]}>{pollErrorText}</Text> : null}
            {actionError ? <Text style={[styles.cardCopy, styles.errorText]}>{actionError}</Text> : null}
          </View>

          {serverEnabled && (
            <View style={styles.tabBar}>
              <LobbyTabButton
                label="Create Game"
                isActive={activeTab === 'create'}
                onPress={() => setActiveTab('create')}
                theme={theme}
              />
              <LobbyTabButton
                label="Join Game"
                isActive={activeTab === 'join'}
                onPress={() => setActiveTab('join')}
                theme={theme}
              />
            </View>
          )}

          {activeTab === 'create' ? (
            <View
              style={[
                styles.card,
                { backgroundColor: theme.surfacePrimary, borderColor: theme.secondaryButtonBorder },
              ]}
            >
              <Text style={[styles.cardHeading, { color: theme.textPrimary }]}>Create a new game</Text>
              <Text style={[styles.cardCopy, { color: theme.textSecondary }]}>Tap the button to create a game as player one. Share the game ID with a friend so they can join.</Text>
              <Pressable
                onPress={handleCreateGame}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: theme.accent },
                  pressed && styles.primaryButtonPressed,
                ]}
                disabled={anyMutationPending}
              >
                <Text style={[styles.primaryButtonText, { color: theme.accentText }]}>
                  {createGameMutation.isPending ? 'Creating.' : 'Create game'}
                </Text>
              </Pressable>

              <Text style={[styles.cardHeading, { color: theme.textPrimary }]}>Your words</Text>
              <Text style={[styles.cardCopy, { color: theme.textSecondary }]}>Enter five valid words (letters only). The server auto-places them on the board.</Text>
              {words.map((word, index) => (
                <TextInput
                  key={`word-${index}`}
                  accessibilityLabel={`Word ${index + 1}`}
                  placeholder={`Word ${index + 1}`}
                  value={word}
                  onChangeText={(value) => setWord(index, value)}
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: theme.inputBackground,
                      borderColor: theme.inputBorder,
                      color: theme.textPrimary,
                    },
                  ]}
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="characters"
                />
              ))}
              {inPreGame && !me?.words_submitted && (
                <Pressable
                  onPress={handleSubmitWords}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.primaryButton,
                    { backgroundColor: theme.accent },
                    pressed && styles.primaryButtonPressed,
                  ]}
                  disabled={!canSubmitWords || submitWordsMutation.isPending}
                >
                  <Text style={[styles.primaryButtonText, { color: theme.accentText }]}>
                    {submitWordsMutation.isPending ? 'Submitting.' : 'Submit words'}
                  </Text>
                </Pressable>
              )}
              {inPreGame && me?.words_submitted && !me?.ready && (
                <Pressable
                  onPress={handleMarkReady}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    {
                      borderColor: theme.secondaryButtonBorder,
                      backgroundColor: theme.secondaryButtonBackground,
                    },
                    pressed && styles.secondaryButtonPressed,
                  ]}
                  disabled={!canMarkReady || markReadyMutation.isPending}
                >
                  <Text style={[styles.secondaryButtonText, { color: theme.textSecondary }]}>
                    {markReadyMutation.isPending ? 'Marking.' : 'Mark ready'}
                  </Text>
                </Pressable>
              )}
            </View>
          ) : (
            <View
              style={[
                styles.card,
                { backgroundColor: theme.surfacePrimary, borderColor: theme.secondaryButtonBorder },
              ]}
            >
              <Text style={[styles.cardHeading, { color: theme.textPrimary }]}>Join an existing game</Text>
              <Text style={[styles.cardCopy, { color: theme.textSecondary }]}>Ask your friend for the game ID, enter it below, then join and submit your words.</Text>
              <TextInput
                accessibilityLabel="Game ID"
                placeholder="Game ID"
                value={joinInput}
                onChangeText={setJoinInput}
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.inputBackground,
                    borderColor: theme.inputBorder,
                    color: theme.textPrimary,
                  },
                ]}
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
              />
              <Pressable
                onPress={handleJoinGame}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: theme.accent },
                  pressed && styles.primaryButtonPressed,
                ]}
                disabled={joinGameMutation.isPending}
              >
                <Text style={[styles.primaryButtonText, { color: theme.accentText }]}>
                  {joinGameMutation.isPending ? 'Joining.' : 'Join game'}
                </Text>
              </Pressable>
            </View>
          )}

          {gameState ? (
            <View
              style={[
                styles.card,
                { backgroundColor: theme.secondaryButtonBackground, borderColor: theme.secondaryButtonBorder },
              ]}
            >
              <Text style={[styles.cardHeading, { color: theme.textPrimary }]}>Game snapshot</Text>
              <Text style={[styles.cardCopy, { color: theme.textSecondary }]}>Status: {gameState.status}</Text>
              <Text style={[styles.cardCopy, { color: theme.textSecondary }]}>Your ID: {gameState.me.user_id}</Text>
              <Text style={[styles.cardCopy, { color: theme.textSecondary }]}>Current turn user ID: {gameState.current_turn_user_id ?? '-'}</Text>
              <Text style={[styles.cardCopy, { color: theme.textSecondary }]}>Your progress letters: {gameState.your_progress_letters}</Text>
              <Text style={[styles.cardCopy, { color: theme.textSecondary }]}>Opponent progress letters: {gameState.opponent_progress_letters}</Text>
              {gameState.status === 'active' ? (
                <Pressable
                  onPress={() => navigation.navigate('Board')}
                  accessibilityRole="button"
                  accessibilityLabel="Open the board screen"
                  style={({ pressed }) => [
                    styles.primaryButton,
                    { backgroundColor: theme.accent },
                    pressed && styles.primaryButtonPressed,
                  ]}
                >
                  <Text style={[styles.primaryButtonText, { color: theme.accentText }]}>Go to board</Text>
                </Pressable>
              ) : null}

              <Pressable
                onPress={() => invalidate()}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.secondaryButton,
                  {
                    borderColor: theme.secondaryButtonBorder,
                    backgroundColor: theme.secondaryButtonBackground,
                  },
                  pressed && styles.secondaryButtonPressed,
                ]}
              >
                <Text style={[styles.secondaryButtonText, { color: theme.textSecondary }]}>Refresh state now</Text>
              </Pressable>
            </View>
          ) : null}

          <ThemePicker />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  container: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    paddingTop: 16,
    gap: 24,
  },
  heading: {
    fontSize: 32,
    fontWeight: '700',
  },
  subheading: {
    fontSize: 16,
  },
  countdownBadge: {
    alignSelf: 'center',
    borderRadius: 60,
    paddingHorizontal: 36,
    paddingVertical: 18,
    borderWidth: 2,
  },
  countdownText: {
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: 2,
  },
  sessionCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    gap: 6,
  },
  tabBar: {
    flexDirection: 'row',
    gap: 12,
  },
  tabButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  tabButtonPressed: {
    opacity: 0.85,
  },
  tabButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  card: {
    borderRadius: 20,
    padding: 20,
    gap: 16,
    borderWidth: 1,
  },
  cardHeading: {
    fontSize: 20,
    fontWeight: '700',
  },
  cardCopy: {
    fontSize: 15,
  },
  textInput: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    letterSpacing: 2,
    borderWidth: 1,
  },
  primaryButton: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonPressed: {
    opacity: 0.8,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonPressed: {
    opacity: 0.8,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  errorText: {
    color: '#ff8a80',
  },
  errorBanner: {
    backgroundColor: '#fff5f5',
    borderWidth: 1,
    borderColor: '#e8b4b8',
    borderRadius: 8,
    padding: 12,
  },
  errorBannerText: {
    fontSize: 14,
    color: '#b00000',
  },
});
