/**
 * src/screens/ResultScreen.tsx
 * ---------------------------------------------
 * Result screen supporting both:
 * - Simple result import (legacy)
 * - PvP result comparison (new async mode)
 */
import React, { useEffect, useState } from 'react';
import { Alert, Button, Linking, ScrollView, StyleSheet, Text, TextInput, View, Share, TouchableOpacity } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';

import { decodeResult, encodeResult } from '../gameEngine/serialize';
import type { ResultPayload } from '../gameEngine/types';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { getSession, recordOpponentResult, getOpponentResult } from '../localChallenge/localChallengeStore';
import { generateResultPayload, compareResults } from '../localChallenge/resultComparison';
import type { ChallengeResultPayload, ResultComparison } from '../localChallenge/resultComparison';

type Route = RouteProp<RootStackParamList, 'ResultImport'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ResultScreen(): React.JSX.Element {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();

  // Get sessionId if navigated from a completed PvP game
  const sessionId = (route.params as any)?.sessionId;
  const session = sessionId ? getSession(sessionId) : null;

  // Generate result payload from session if available
  const [myResult, setMyResult] = useState<ChallengeResultPayload | null>(null);
  const [myResultCode, setMyResultCode] = useState<string>('');

  // Opponent result input
  const [opponentCode, setOpponentCode] = useState(route.params?.prefillCode ?? '');
  const [opponentResult, setOpponentResult] = useState<ChallengeResultPayload | null>(null);

  // Winner comparison
  const [comparison, setComparison] = useState<ResultComparison | null>(null);

  // Legacy simple import mode
  const [legacyPayload, setLegacyPayload] = useState<ResultPayload | null>(null);

  // Initialize from session
  useEffect(() => {
    if (session && session.mode !== 'bot') {
      const challengeId = session.offerId ?? session.id;
      const result = generateResultPayload(
        challengeId,
        session.state.guessesByTarget as any,
        session.state.solvedByTarget ?? []
      );
      setMyResult(result);

      // Encode to shareable code
      const legacyFormat: ResultPayload = {
        v: 1,
        challengeId: result.challengeId,
        completed: result.solvedCount === 5 ? 'win' : ('lose' as const),
        attempts: result.totalGuesses,
        guessesByTarget: result.guessesByTarget as any,
      };
      const encoded = encodeResult(legacyFormat);
      setMyResultCode(encoded);

      // Check if opponent result already exists
      const existingOpponent = getOpponentResult(challengeId);
      if (existingOpponent) {
        setOpponentResult(existingOpponent);
        const comp = compareResults(result, existingOpponent);
        setComparison(comp);
      }
    }
  }, [session]);

  const handleCopyMyResult = async () => {
    await Clipboard.setStringAsync(myResultCode);
    Alert.alert('Copied!', 'Result code copied to clipboard');
  };

  const handleShareMyResult = async () => {
    try {
      await Share.share({
        message: `My CrosSWords result: ${myResultCode}`,
      });
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  const handleWhatsAppResult = async () => {
    const text = `My CrosSWords result: ${myResultCode}`;
    const url = `whatsapp://send?text=${encodeURIComponent(text)}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert('WhatsApp not found', 'WhatsApp is not installed on this device.');
    }
  };

  const handleSMSResult = async () => {
    try {
      const text = `My CrosSWords result: ${myResultCode}`;
      await Linking.openURL(`sms:?body=${encodeURIComponent(text)}`);
    } catch {
      Alert.alert('SMS not available', 'Could not open SMS on this device.');
    }
  };

  const handleDecodeOpponent = () => {
    try {
      const decoded = decodeResult(opponentCode.trim());

      // Convert legacy ResultPayload to ChallengeResultPayload
      const opponentResultPayload: ChallengeResultPayload = {
        v: 1,
        type: 'result',
        challengeId: decoded.challengeId,
        totalGuesses: decoded.attempts,
        solvedCount: decoded.completed === 'win' ? 5 : ((decoded.guessesByTarget as any)?.filter((g: any) => {
          const lastGuess = g[g.length - 1];
          return lastGuess?.codes?.every((c: string) => c === 'G' || c === 'green');
        }).length ?? 0),
        guessesByTarget: (decoded.guessesByTarget ?? []) as any,
        submittedAtMs: Date.now(),
      };

      setOpponentResult(opponentResultPayload);
      recordOpponentResult(opponentResultPayload);

      // Compare if we have our result
      if (myResult) {
        const comp = compareResults(myResult, opponentResultPayload);
        setComparison(comp);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid result code';
      Alert.alert('Decode failed', msg);
    }
  };

  const handleLegacyDecode = () => {
    try {
      const res = decodeResult(opponentCode.trim());
      setLegacyPayload(res);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid result code';
      setLegacyPayload(null);
      Alert.alert('Decode failed', msg);
    }
  };

  // PvP Result Comparison Mode
  if (myResult) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.heading}>🏆 PvP Result Comparison</Text>

        {/* Your Result Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your Result</Text>
          <Text style={styles.helper}>Challenge ID: {myResult.challengeId}</Text>
          <Text style={styles.helper}>Words Solved: {myResult.solvedCount}/5</Text>
          <Text style={styles.helper}>Total Guesses: {myResult.totalGuesses}</Text>
        </View>

        {/* Share Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.button} onPress={handleCopyMyResult}>
            <Text style={styles.buttonText}>📋 Copy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={handleShareMyResult}>
            <Text style={styles.buttonText}>📤 Share</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={[styles.button, { backgroundColor: '#25D366' }]} onPress={handleWhatsAppResult}>
            <Text style={styles.buttonText}>💬 WhatsApp</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, { backgroundColor: '#5856D6' }]} onPress={handleSMSResult}>
            <Text style={styles.buttonText}>📱 SMS</Text>
          </TouchableOpacity>
        </View>

        {/* Result Code Display */}
        <View style={styles.codeBox}>
          <Text style={styles.codeText} selectable>{myResultCode}</Text>
        </View>

        {/* Opponent Result Input */}
        <Text style={styles.sectionTitle}>Opponent Result</Text>
        <TextInput
          multiline
          value={opponentCode}
          onChangeText={setOpponentCode}
          placeholder="Paste opponent result code here"
          style={styles.input}
        />
        <Button title="Compare Results" onPress={handleDecodeOpponent} />

        {/* Opponent Result Card */}
        {opponentResult && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Opponent Result</Text>
            <Text style={styles.helper}>Words Solved: {opponentResult.solvedCount}/5</Text>
            <Text style={styles.helper}>Total Guesses: {opponentResult.totalGuesses}</Text>
          </View>
        )}

        {/* Winner Display */}
        {comparison && (
          <View style={[
            styles.winnerCard,
            comparison.winner === 'player' ? styles.winnerPlayer :
            comparison.winner === 'opponent' ? styles.winnerOpponent :
            styles.winnerTie
          ]}>
            <Text style={styles.winnerTitle}>
              {comparison.winner === 'player' ? '🎉 You Win!' :
               comparison.winner === 'opponent' ? '😔 Opponent Wins' :
               '🤝 It\'s a Tie!'}
            </Text>
            <Text style={styles.winnerDetail}>
              You: {comparison.playerSolvedCount} words, {comparison.playerTotalGuesses} guesses
            </Text>
            <Text style={styles.winnerDetail}>
              Opponent: {comparison.opponentSolvedCount} words, {comparison.opponentTotalGuesses} guesses
            </Text>
          </View>
        )}

        <Button title="Back to Lobby" onPress={() => navigation.navigate('Lobby' as never)} />
      </ScrollView>
    );
  }

  // Legacy Simple Import Mode
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Import Result</Text>
      <TextInput
        multiline
        value={opponentCode}
        onChangeText={setOpponentCode}
        placeholder="Paste result code"
        style={styles.input}
      />
      <Button title="Decode" onPress={handleLegacyDecode} />
      {legacyPayload ? (
        <View style={styles.card}>
          <Text style={styles.helper}>ChallengeId: {legacyPayload.challengeId}</Text>
          <Text style={styles.helper}>Completed: {legacyPayload.completed}</Text>
          <Text style={styles.helper}>Attempts: {legacyPayload.attempts}</Text>
          {legacyPayload.timeMs != null ? <Text style={styles.helper}>TimeMs: {legacyPayload.timeMs}</Text> : null}
        </View>
      ) : null}
      <Button title="Back" onPress={() => navigation.goBack()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  heading: { fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 8, minHeight: 80, backgroundColor: '#fff' },
  helper: { fontSize: 13, color: '#555' },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 4 },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-around',
  },
  button: {
    flex: 1,
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  codeBox: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  codeText: { fontSize: 11, color: '#333', fontFamily: 'monospace' },
  winnerCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    gap: 8,
    marginTop: 8,
  },
  winnerPlayer: {
    backgroundColor: '#e8f5e9',
    borderColor: '#4caf50',
  },
  winnerOpponent: {
    backgroundColor: '#ffebee',
    borderColor: '#f44336',
  },
  winnerTie: {
    backgroundColor: '#fff3e0',
    borderColor: '#ff9800',
  },
  winnerTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  winnerDetail: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
  },
});
