/**
 * src/screens/LocalChallengePlayScreen.tsx
 * ---------------------------------------------
 * Minimal local play surface for serverless challenges.
 * Avoids reusing BoardScreen to keep server mode untouched.
 */

import React, { useState } from 'react';
import { Alert, Button, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { applyGuess, isSolved } from '../gameEngine/state';
import { encodeResult } from '../gameEngine/serialize';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { deleteSession, getSession, updateSession, recordResultFromSession } from '../localChallenge/localChallengeStore';

type Route = RouteProp<RootStackParamList, 'LocalChallengePlay'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function LocalChallengePlayScreen(): React.JSX.Element {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const session = getSession(route.params?.sessionId);

  const [targetIndex, setTargetIndex] = useState(0);
  const [guessInput, setGuessInput] = useState('');
  const [lastCodes, setLastCodes] = useState<string[] | null>(null);
  const [resultCode, setResultCode] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(
    session && session.mode !== 'bot' ? session.timerLimitSeconds ?? null : null,
  );
  const timerLimitSeconds =
    session && session.mode !== 'bot' ? session.timerLimitSeconds : undefined;

  React.useEffect(() => {
    if (timerLimitSeconds === undefined) return;
    if (remainingSeconds === null) {
      setRemainingSeconds(timerLimitSeconds);
      return;
    }
    if (remainingSeconds <= 0) return;
    const id = setInterval(() => {
      setRemainingSeconds((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearInterval(id);
  }, [remainingSeconds, timerLimitSeconds]);

  if (!session) {
    return (
      <View style={styles.container}>
        <Text>Session not found.</Text>
        <Button title="Back" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  if (session.mode === 'bot') {
    return (
      <View style={styles.container}>
        <Text>This session is a bot challenge.</Text>
        <Button
          title="Open Bot Board"
          onPress={() => navigation.navigate('Board', { mode: 'bot', sessionId: session.id })}
        />
      </View>
    );
  }

  const { state, targets } = session;
  const currentWord = targets[targetIndex] ?? '';
  const guesses = state.guessesByTarget[targetIndex] ?? [];
  const solvedFlags = state.solvedByTarget ?? [];

  const handleSubmit = () => {
    const cleaned = guessInput.trim().toUpperCase();
    if (!cleaned) return;
    if (cleaned.length !== currentWord.length) {
      Alert.alert('Length mismatch', `Need ${currentWord.length} letters.`);
      return;
    }
    const { nextState, result } = applyGuess(state, targetIndex, cleaned);
    updateSession(session.id, nextState);
    setLastCodes(result.codes);
    setGuessInput('');

    if (isSolved(nextState)) {
      const resultPayload = {
        v: 1 as const,
        challengeId: session.id,
        completed: 'win' as const,
        attempts: nextState.guessesByTarget.flat().length,
        guessesByTarget: nextState.guessesByTarget,
      };
      const code = encodeResult(resultPayload);
      setResultCode(code);
      recordResultFromSession({ ...session, state: nextState });
      deleteSession(session.id);
    }
  };

  const solvedCount = solvedFlags.filter(Boolean).length;
  const progressText = `${solvedCount}/${targets.length} words solved`;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Local Play</Text>
      <Text style={styles.helper}>Session: {session.id}</Text>
      {timerLimitSeconds !== undefined ? (
        <Text style={styles.helper}>Timer: {remainingSeconds ?? timerLimitSeconds}s</Text>
      ) : null}
      <Text style={styles.helper}>{progressText}</Text>

      <View style={styles.selector}>
        {targets.map((_, idx) => (
          <Button key={idx} title={`Word ${idx + 1}`} onPress={() => setTargetIndex(idx)} color={idx === targetIndex ? '#d33' : '#666'} />
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.helper}>Target length: {currentWord.length}</Text>
        <Text style={styles.helper}>Guesses: {guesses.join(', ') || '—'}</Text>
        <TextInput
          value={guessInput}
          onChangeText={setGuessInput}
          placeholder="Enter guess"
          autoCapitalize="characters"
          style={styles.input}
        />
        <Button title="Submit guess" onPress={handleSubmit} />
        {lastCodes ? (
          <Text style={styles.helper}>Last codes: {lastCodes.join(', ')}</Text>
        ) : null}
      </View>

      {resultCode ? (
        <View style={styles.card}>
          <Text style={styles.heading}>Result code</Text>
          <Text selectable style={styles.codeText}>
            {resultCode}
          </Text>
        </View>
      ) : null}

      <Button title="Back to challenge list" onPress={() => navigation.goBack()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  heading: { fontSize: 18, fontWeight: '700' },
  helper: { fontSize: 12, color: '#555' },
  selector: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  card: { backgroundColor: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#eee', gap: 6 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 8 },
  codeText: { fontFamily: 'monospace', fontSize: 12 },
});
