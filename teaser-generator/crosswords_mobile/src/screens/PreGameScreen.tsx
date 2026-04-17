/**
 * src/screens/PreGameScreen.tsx
 * ---------------------------------------------
 * Pre-game word entry and ready flow. Split from Lobby to reduce clutter.
 * - 5 word inputs (validation: 2×4, 2×5, 1×6, alphabetic, unique)
 * - Submit Words, Mark Ready
 * - Countdown when starting
 * - Auto-navigates to Board when gameState.status === 'active'
 *
 * Reuses: useSessionStore, useGameState, submitWords/markReady mutations.
 * Atlantic-skinned when USE_ATLANTIC_SKIN=true.
 */

import * as Clipboard from 'expo-clipboard';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation } from '@tanstack/react-query';

import { API_BASE_URL, fetchRawGameState, markReady, submitWords } from '@lib/api';
import { USE_ATLANTIC_SKIN } from '@src/flags';
import { RootStackParamList } from '@src/navigation/AppNavigator';
import { DESIGN_TOKEN_SETS } from '@src/theme/designTokens';
import { useGameState } from '@hooks/useGameState';
import useSessionStore from '@stores/sessionStore';

type PreGameNav = NativeStackNavigationProp<RootStackParamList, 'PreGame'>;

/** Pre-game = any status that is not active and not finished (waiting, starting, etc.). */



const t = DESIGN_TOKEN_SETS.atlantic;

const preGameStyles = StyleSheet.create({
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
  backButton: { fontSize: 18, color: '#000' },
  headerTitle: {
    flex: 1,
    fontFamily: t.typography.displayFamily,
    fontSize: 18,
    color: '#000',
  },
  card: {
    backgroundColor: '#fff',
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e2e2',
    gap: 12,
  },
  sectionTitle: {
    fontFamily: t.typography.displayFamily,
    fontSize: 18,
    color: '#000',
  },
  inlineLabel: {
    fontFamily: t.typography.displayFamily,
    fontSize: 12,
    letterSpacing: 1,
    color: '#000',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d7d7d7',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: t.typography.bodyFamily,
    fontSize: 15,
    color: '#333',
  },
  buttonPrimaryRed: {
    backgroundColor: t.colors.danger,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonMuted: {
    backgroundColor: '#7f7f7f',
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonOutline: {
    borderWidth: 1,
    borderColor: '#1e1e1e',
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonSecondary: {
    backgroundColor: '#e89ca6',
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: { fontFamily: t.typography.displayFamily, fontSize: 16, color: '#fff' },
  buttonOutlineText: {
    fontFamily: t.typography.displayFamily,
    fontSize: 16,
    color: '#1e1e1e',
  },
  errorText: {
    fontFamily: t.typography.bodyFamily,
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
    fontFamily: t.typography.bodyFamily,
    fontSize: 14,
    color: '#b00000',
    flexWrap: 'wrap',
  },
  errorBannerDismiss: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  errorBannerDismissText: {
    fontFamily: t.typography.displayFamily,
    fontSize: 12,
    color: '#b00000',
  },
  devStateLine: {
    fontFamily: t.typography.bodyFamily,
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
  devPanelRow: { fontFamily: t.typography.bodyFamily, fontSize: 11, color: '#444' },
  devPanelButtons: { flexDirection: 'row', gap: 8, marginTop: 4 },
  devPanelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#ddd',
    borderRadius: 4,
  },
  devPanelBtnText: { fontFamily: t.typography.displayFamily, fontSize: 12, color: '#333' },
  devPanelFeedback: { fontFamily: t.typography.bodyFamily, fontSize: 11, color: '#0a0', marginTop: 4 },
  devPanelError: { fontFamily: t.typography.bodyFamily, fontSize: 11, color: '#b00', marginTop: 4 },
  countdownText: {
    fontFamily: t.typography.displayFamily,
    fontSize: 18,
    color: '#000',
  },
  statusMessage: {
    fontFamily: t.typography.bodyFamily,
    fontSize: 14,
    color: '#555',
  },
});

export default function PreGameScreen(): React.JSX.Element {
  const navigation = useNavigation<PreGameNav>();
  const { apiKey, activeGameId, words, setWord } = useSessionStore();
  const hasNavigatedToBoard = useRef(false);
  const apiKeyTrimmed = (apiKey || '').trim();

  const [actionError, setActionError] = useState<string | null>(null);
  const [errorDismissed, setErrorDismissed] = useState(false);
  const [lastAction, setLastAction] = useState<'submit_words' | 'ready' | null>(null);
  const [pollErrorText, setPollErrorText] = useState<string | null>(null);
  const lastPollAtRef = useRef<number>(0);
  const [devCopyFeedback, setDevCopyFeedback] = useState<'token' | 'state' | 'no_token' | 'state_err' | null>(null);

  const hasCredentials = apiKeyTrimmed.length > 0;

  const { data: gameState, error: stateError, invalidate } = useGameState(
    hasCredentials ? apiKeyTrimmed : null,
    activeGameId,
  );

  const submitWordsMutation = useMutation({
    mutationFn: () => {
      if (!activeGameId) throw new Error('No active game.');
      return submitWords(apiKeyTrimmed, activeGameId, words);
    },
    onSuccess: () => {
      setActionError(null);
      setErrorDismissed(false);
      invalidate();
    },
    onError: (err: Error) => {
      const apiErr = err as Error & { status?: number };
      const msg = `HTTP ${apiErr.status ?? '?'}: ${apiErr.message}`;
      setActionError(msg);
      setErrorDismissed(false);
      Alert.alert('Submit Words Error', msg);
    },
  });

  const markReadyMutation = useMutation({
    mutationFn: () => {
      if (!activeGameId) throw new Error('No active game.');
      return markReady(apiKeyTrimmed, activeGameId);
    },
    onSuccess: () => {
      setActionError(null);
      setErrorDismissed(false);
      invalidate();
    },
    onError: (err: Error) => {
      const apiErr = err as Error & { status?: number };
      const msg = `HTTP ${apiErr.status ?? '?'}: ${apiErr.message}`;
      setActionError(msg);
      setErrorDismissed(false);
      Alert.alert('Ready Error', msg);
    },
  });

  // Hard-transition to Board when game becomes active (replace prevents stack issues)
  useEffect(() => {
    if (gameState?.status === 'active' && activeGameId != null && activeGameId > 0) {
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
  }, [gameState?.status, activeGameId, navigation]);

  /** Valid: exactly 5 words, 2×4, 2×5, 1×6, alphabetic, unique */
  const areWordsValidForSubmit = useMemo(() => {
    const clean = (w: string) => (w || '').trim().toUpperCase().replace(/[^A-Z]/g, '');
    const cleaned = words.map(clean);
    if (cleaned.length !== 5) return false;
    const counts: Record<number, number> = { 4: 0, 5: 0, 6: 0 };
    for (const w of cleaned) {
      if (w.length !== 4 && w.length !== 5 && w.length !== 6) return false;
      counts[w.length] = (counts[w.length] ?? 0) + 1;
    }
    if (counts[4] !== 2 || counts[5] !== 2 || counts[6] !== 1) return false;
    return new Set(cleaned).size === 5;
  }, [words]);

  const countdownSeconds = useMemo(() => {
    if (!gameState?.start_at) return null;
    const start = new Date(gameState.start_at).getTime();
    return Math.max(0, Math.round((start - Date.now()) / 1000));
  }, [gameState?.start_at]);

  const status = gameState?.status;
  const me = gameState?.me;
  const isActive = status === 'active';
  const isFinished = status === 'finished';
  const inPreGame = Boolean(status && !isActive && !isFinished);
  const canSubmitWords = Boolean(inPreGame && me && !me.words_submitted && areWordsValidForSubmit);
  const canMarkReady = Boolean(inPreGame && me && me.words_submitted && !me.ready);

  const handleSubmitWords = useCallback(() => {
    if (!activeGameId) {
      setActionError('Create or join a game first.');
      setErrorDismissed(false);
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
      setErrorDismissed(false);
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

  // Redirect to Lobby if no active game (user navigated directly)
  useEffect(() => {
    if (!activeGameId || activeGameId <= 0) {
      navigation.replace('Lobby');
    }
  }, [activeGameId, navigation]);

  const handleCopyToken = useCallback(async () => {
    setDevCopyFeedback(null);
    if (!apiKeyTrimmed) {
      setDevCopyFeedback('no_token');
      return;
    }
    await Clipboard.setStringAsync(apiKeyTrimmed);
    setDevCopyFeedback('token');
    setTimeout(() => setDevCopyFeedback(null), 2000);
  }, [apiKeyTrimmed]);

  const handleCopyState = useCallback(async () => {
    setDevCopyFeedback(null);
    if (!apiKeyTrimmed) {
      setDevCopyFeedback('no_token');
      return;
    }
    if (!activeGameId || activeGameId <= 0) {
      setDevCopyFeedback('state_err');
      setTimeout(() => setDevCopyFeedback(null), 2000);
      return;
    }
    try {
      const { status, text } = await fetchRawGameState(apiKeyTrimmed, activeGameId);
      let toCopy = text;
      try {
        const parsed = JSON.parse(text) as unknown;
        toCopy = JSON.stringify(parsed, null, 2);
      } catch {
        // keep raw text
      }
      await Clipboard.setStringAsync(`HTTP ${status}\n${toCopy}`);
      setDevCopyFeedback('state');
      setTimeout(() => setDevCopyFeedback(null), 2000);
    } catch {
      setDevCopyFeedback('state_err');
      setTimeout(() => setDevCopyFeedback(null), 2000);
    }
  }, [apiKeyTrimmed, activeGameId]);

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
      lastPollAtRef.current = Date.now();
      setPollErrorText(null);
      if (lastAction === null) setActionError(null);
    }
  }, [gameState, lastAction]);

  const hasError = (actionError || pollErrorText) && !errorDismissed;
  const errorText = actionError || pollErrorText || '';
  const displayError = __DEV__ && lastAction ? `lastAction=${lastAction} · ${errorText}` : errorText;
  const lastPollOk = gameState != null && typeof gameState.status === 'string';
  const pollErrText =
    stateError instanceof Error ? stateError.message : stateError ? String(stateError) : '—';
  const lastPollAtFormatted =
    lastPollAtRef.current > 0
      ? new Date(lastPollAtRef.current).toLocaleTimeString('en-US', { hour12: false })
      : '--';

  if (!USE_ATLANTIC_SKIN) {
    // Minimal fallback when flag off; PreGame is primarily for Atlantic flow
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
        <Pressable onPress={() => navigation.navigate('Lobby')} style={{ padding: 16 }}>
          <Text>← Back to Lobby</Text>
        </Pressable>
        {hasError ? (
          <View style={[preGameStyles.errorBanner, { marginHorizontal: 16, marginBottom: 8 }]}>
            <Text style={preGameStyles.errorBannerText}>{displayError}</Text>
            <Pressable onPress={() => { setActionError(null); setPollErrorText(null); setErrorDismissed(true); }} hitSlop={8}>
              <Text style={preGameStyles.errorBannerDismissText}>Dismiss</Text>
            </Pressable>
          </View>
        ) : null}
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          {__DEV__ ? (
            <View style={preGameStyles.devPanel}>
              <Text style={preGameStyles.devPanelRow}>activeGameId={activeGameId ?? '—'} · API={API_BASE_URL}</Text>
              <View style={preGameStyles.devPanelButtons}>
                <Pressable onPress={handleCopyToken} style={preGameStyles.devPanelBtn}>
                  <Text style={preGameStyles.devPanelBtnText}>Copy Token</Text>
                </Pressable>
                <Pressable onPress={handleCopyState} style={preGameStyles.devPanelBtn}>
                  <Text style={preGameStyles.devPanelBtnText}>Copy /state</Text>
                </Pressable>
              </View>
              {devCopyFeedback === 'token' || devCopyFeedback === 'state' ? (
                <Text style={preGameStyles.devPanelFeedback}>Copied ✓</Text>
              ) : devCopyFeedback === 'no_token' ? (
                <Text style={preGameStyles.devPanelError}>No token loaded</Text>
              ) : devCopyFeedback === 'state_err' ? (
                <Text style={preGameStyles.devPanelError}>Failed to fetch /state</Text>
              ) : null}
            </View>
          ) : null}
          <Text>Pre-Game (word entry moved here)</Text>
          {status === 'active' && <Text>Game started — returning to board…</Text>}
          {status === 'finished' && <Text>Game finished.</Text>}
          {inPreGame && (
            <>
              {words.map((word, idx) => (
                <TextInput
                  key={idx}
                  value={word}
                  onChangeText={(v) => setWord(idx, v)}
                  placeholder={`Word ${idx + 1}`}
                  style={{ borderWidth: 1, padding: 10 }}
                />
              ))}
              {!me?.words_submitted && (
                <Pressable
                  onPress={handleSubmitWords}
                  disabled={!canSubmitWords || submitWordsMutation.isPending}
                >
                  <Text>Submit Words</Text>
                </Pressable>
              )}
              {me?.words_submitted && !me?.ready && (
                <Pressable
                  onPress={handleMarkReady}
                  disabled={!canMarkReady || markReadyMutation.isPending}
                >
                  <Text>I am Ready</Text>
                </Pressable>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={preGameStyles.screen}>
      {__DEV__ && (
        <Text style={{ color: 'blue', fontWeight: 'bold', margin: 8 }}>
          PRE-GAME SCREEN v2026-02-02 (DEV)
        </Text>
      )}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={preGameStyles.header}>
          <Pressable onPress={() => navigation.navigate('Lobby')} style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}>
            <Text style={preGameStyles.backButton}>← Back to Lobby</Text>
          </Pressable>
          <Text style={preGameStyles.headerTitle}>Pre-Game</Text>
        </View>

        {hasError ? (
          <View style={[preGameStyles.errorBanner, { marginHorizontal: 16, marginTop: 8, marginBottom: 0 }]}>
            <Text style={preGameStyles.errorBannerText}>{displayError}</Text>
            <Pressable
              onPress={() => {
                setActionError(null);
                setPollErrorText(null);
                setErrorDismissed(true);
              }}
              style={preGameStyles.errorBannerDismiss}
              hitSlop={8}
            >
              <Text style={preGameStyles.errorBannerDismissText}>Dismiss</Text>
            </Pressable>
          </View>
        ) : null}

        <ScrollView contentContainerStyle={preGameStyles.scroll} keyboardShouldPersistTaps="handled">
          {__DEV__ ? (
            <Text style={preGameStyles.devStateLine}>
              lastPollOk={String(lastPollOk)} · lastPollAt={lastPollAtFormatted} · status={gameState?.status ?? '—'} · submitted={String(me?.words_submitted ?? false)} · ready={String(me?.ready ?? false)}
            </Text>
          ) : null}

          {__DEV__ ? (
            <Text style={preGameStyles.devStateLine}>
              inPreGame={String(inPreGame)} · canSubmit={String(canSubmitWords)} · valid={String(areWordsValidForSubmit)} · hasMe={String(Boolean(me))}
            </Text>
          ) : null}

          {__DEV__ ? (
            <Text style={preGameStyles.devStateLine}>
              pollInputs: gameId={activeGameId ?? '—'} · keyLen={apiKeyTrimmed.length} · base={API_BASE_URL}
            </Text>
          ) : null}

          {__DEV__ ? (
            <Text style={preGameStyles.devStateLine}>
              pollErr={pollErrText}
            </Text>
          ) : null}

          {__DEV__ ? (
            <View style={preGameStyles.devPanel}>
              <Text style={preGameStyles.devPanelRow}>activeGameId={activeGameId ?? '—'}</Text>
              <Text style={preGameStyles.devPanelRow}>API_BASE_URL={API_BASE_URL}</Text>
              <Text style={preGameStyles.devPanelRow}>apiKey present={String(Boolean(apiKeyTrimmed))}</Text>
              <View style={preGameStyles.devPanelButtons}>
                <Pressable onPress={handleCopyToken} style={preGameStyles.devPanelBtn}>
                  <Text style={preGameStyles.devPanelBtnText}>Copy Token</Text>
                </Pressable>
                <Pressable onPress={handleCopyState} style={preGameStyles.devPanelBtn}>
                  <Text style={preGameStyles.devPanelBtnText}>Copy /state</Text>
                </Pressable>
              </View>
              {devCopyFeedback === 'token' || devCopyFeedback === 'state' ? (
                <Text style={preGameStyles.devPanelFeedback}>Copied ✓</Text>
              ) : devCopyFeedback === 'no_token' ? (
                <Text style={preGameStyles.devPanelError}>No token loaded</Text>
              ) : devCopyFeedback === 'state_err' ? (
                <Text style={preGameStyles.devPanelError}>Failed to fetch /state</Text>
              ) : null}
            </View>
          ) : null}

          <View style={preGameStyles.card}>
            <Text style={preGameStyles.sectionTitle}>Your Words</Text>
            <Text style={preGameStyles.inlineLabel}>YOUR 5 WORDS (2×4, 2×5, 1×6 letters, unique)</Text>
            {words.map((word, idx) => (
              <TextInput
                key={`word-${idx}`}
                style={preGameStyles.input}
                placeholder={`WORD ${idx + 1}`}
                placeholderTextColor="#888"
                value={word}
                onChangeText={(v) => setWord(idx, v)}
                autoCapitalize="characters"
              />
            ))}

            {status === 'active' ? (
              <Text style={preGameStyles.statusMessage}>Game started — returning to board…</Text>
            ) : status === 'finished' ? (
              <Text style={preGameStyles.statusMessage}>Game finished.</Text>
            ) : inPreGame ? (
              <>
                {!me?.words_submitted && (
                  <Pressable
                    onPress={handleSubmitWords}
                    disabled={!canSubmitWords || submitWordsMutation.isPending}
                    style={({ pressed }) => [
                      canSubmitWords && !submitWordsMutation.isPending
                        ? preGameStyles.buttonPrimaryRed
                        : preGameStyles.buttonMuted,
                      (pressed || submitWordsMutation.isPending) && { opacity: 0.9 },
                    ]}
                  >
                    {submitWordsMutation.isPending ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={preGameStyles.buttonText}>Submit Words</Text>
                    )}
                  </Pressable>
                )}
                {me?.words_submitted && !me?.ready && (
                  <Pressable
                    onPress={handleMarkReady}
                    disabled={!canMarkReady || markReadyMutation.isPending}
                    style={({ pressed }) => [
                      preGameStyles.buttonOutline,
                      (pressed || markReadyMutation.isPending) && { opacity: 0.9 },
                    ]}
                  >
                    {markReadyMutation.isPending ? (
                      <ActivityIndicator size="small" color="#1e1e1e" />
                    ) : (
                      <Text style={preGameStyles.buttonOutlineText}>I am Ready</Text>
                    )}
                  </Pressable>
                )}
              </>
            ) : null}

            {countdownSeconds !== null ? (
              <Text style={preGameStyles.countdownText}>
                Countdown: {countdownSeconds}s
              </Text>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
