/**
 * src/screens/ChallengeHistoryScreen.tsx
 * -----------------------------------------------------------
 * Read-only history of local serverless artifacts. Everything stays local;
 * target words are never rendered. Provides quick "resume" and "copy code".
 */
import React from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { getSession, getSnapshot, subscribe, deleteHistoryItem } from '../localChallenge/localChallengeStore';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { DESIGN_TOKEN_SETS } from '@src/theme/designTokens';

const t = DESIGN_TOKEN_SETS.atlantic;
const ACCENT = '#E7131A';
const SCREEN_BG = '#fdfdfd';
const SURFACE = '#fff';
const BORDER = '#e2e2e2';
const DIVIDER = '#e4e4e4';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function useHistorySnapshot() {
  const [snap, setSnap] = React.useState(getSnapshot());
  React.useEffect(() => {
    const unsub = subscribe(() => setSnap(getSnapshot()));
    return unsub;
  }, []);
  return snap;
}

export default function ChallengeHistoryScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const snap = useHistorySnapshot();

  const handleCopy = async (code: string, label: string) => {
    await Clipboard.setStringAsync(code);
    Alert.alert('Copied', `${label} copied to clipboard.`);
  };

  const renderSession = (sessionId: string) => {
    const s = getSession(sessionId);
    if (!s) return null;
    if (s.mode === 'bot') {
      return (
        <View key={sessionId} style={styles.card}>
          <Text style={styles.cardTitle}>Bot Session</Text>
          <View style={styles.cardRule} />
          <Text style={styles.cardBody}>
            Difficulty: {s.difficulty} · Status: {s.status}
          </Text>
          <View style={styles.buttonRow}>
            <Pressable
              style={({ pressed }) => [styles.button, pressed && { opacity: 0.8 }]}
              onPress={() => navigation.navigate('Board', { mode: 'bot', sessionId })}
            >
              <Text style={styles.buttonText}>Resume</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.buttonDestructive, pressed && { opacity: 0.8 }]}
              onPress={() => deleteHistoryItem('session', sessionId)}
            >
              <Text style={styles.buttonDestructiveText}>Delete</Text>
            </Pressable>
          </View>
        </View>
      );
    }
    const solved = s.state.solvedByTarget.filter(Boolean).length;
    return (
      <View key={sessionId} style={styles.card}>
        <Text style={styles.cardTitle}>Session</Text>
        <View style={styles.cardRule} />
        <Text style={styles.cardBody}>
          Role: {s.role} · Solved {solved}/{s.targets.length}
        </Text>
        <View style={styles.buttonRow}>
          <Pressable
            style={({ pressed }) => [styles.button, pressed && { opacity: 0.8 }]}
            onPress={() => navigation.navigate('LocalChallengePlay', { sessionId })}
          >
            <Text style={styles.buttonText}>Resume</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.buttonDestructive, pressed && { opacity: 0.8 }]}
            onPress={() => deleteHistoryItem('session', sessionId)}
          >
            <Text style={styles.buttonDestructiveText}>Delete</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderOffer = (code: string, mode?: string, dict?: string) => (
    <View key={code} style={styles.card}>
      <Text style={styles.cardTitle}>Offer</Text>
      <View style={styles.cardRule} />
      <Text style={styles.cardBody}>
        Mode: {mode ?? 'n/a'} · Dict: {dict ?? 'n/a'}
      </Text>
      <View style={styles.buttonRow}>
        <Pressable
          style={({ pressed }) => [styles.button, pressed && { opacity: 0.8 }]}
          onPress={() => handleCopy(code, 'Offer code')}
        >
          <Text style={styles.buttonText}>Copy Code</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.buttonDestructive, pressed && { opacity: 0.8 }]}
          onPress={() => deleteHistoryItem('offer', code)}
        >
          <Text style={styles.buttonDestructiveText}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderReturn = (code: string, offerId?: string) => (
    <View key={code} style={styles.card}>
      <Text style={styles.cardTitle}>Return</Text>
      <View style={styles.cardRule} />
      <Text style={styles.cardBody}>Offer: {offerId ?? '—'}</Text>
      <View style={styles.buttonRow}>
        <Pressable
          style={({ pressed }) => [styles.button, pressed && { opacity: 0.8 }]}
          onPress={() => handleCopy(code, 'Return code')}
        >
          <Text style={styles.buttonText}>Copy Code</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.buttonDestructive, pressed && { opacity: 0.8 }]}
          onPress={() => deleteHistoryItem('return', code)}
        >
          <Text style={styles.buttonDestructiveText}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderResult = (code: string, summary?: any) => (
    <View key={code} style={styles.card}>
      <Text style={styles.cardTitle}>Result</Text>
      <View style={styles.cardRule} />
      <Text style={styles.cardBody}>
        Solved {summary?.solvedCount ?? '—'}/{summary?.totalTargets ?? '—'} · Role: {summary?.role ?? '—'}
      </Text>
      <View style={styles.buttonRow}>
        <Pressable
          style={({ pressed }) => [styles.button, pressed && { opacity: 0.8 }]}
          onPress={() => handleCopy(code, 'Result code')}
        >
          <Text style={styles.buttonText}>Copy Code</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.buttonDestructive, pressed && { opacity: 0.8 }]}
          onPress={() => deleteHistoryItem('result', code)}
        >
          <Text style={styles.buttonDestructiveText}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => [styles.backIconBtn, pressed && { opacity: 0.75 }]}>
          <Image
            source={require('../../assets/design/icons/CWMotifRed.png')}
            style={styles.backIcon}
            resizeMode="contain"
          />
        </Pressable>
        <Text style={styles.title}>History</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.helper}>Data stays on device. Target words are hidden.</Text>

        <Text style={styles.sectionTitle}>Offers</Text>
        {snap.offers.length === 0
          ? <Text style={styles.empty}>No offers saved.</Text>
          : snap.offers.map((o) => renderOffer(o.code, o.payload?.mode, o.payload?.dictionaryId))}

        <Text style={styles.sectionTitle}>Returns</Text>
        {snap.returns.length === 0
          ? <Text style={styles.empty}>No returns saved.</Text>
          : snap.returns.map((r) => renderReturn(r.code, r.payload?.offerId))}

        <Text style={styles.sectionTitle}>In Progress</Text>
        {snap.sessions.length === 0
          ? <Text style={styles.empty}>No active sessions.</Text>
          : snap.sessions.map((s) => renderSession(s.id))}

        <Text style={styles.sectionTitle}>Results</Text>
        {snap.results.length === 0
          ? <Text style={styles.empty}>No results yet.</Text>
          : snap.results.map((r) => renderResult(r.code, r.sessionSummary))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: SCREEN_BG,
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 0,
  },
  headerRow: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  backIconBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    width: 40,
    height: 40,
    tintColor: ACCENT,
  },
  title: {
    fontFamily: t.typography.displayFamily,
    fontSize: t.typography.headingSize - 2,
    color: t.colors.textPrimary,
  },
  scroll: {
    gap: 10,
    paddingBottom: 32,
  },
  helper: {
    fontFamily: t.typography.bodyFamily,
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  sectionTitle: {
    fontFamily: t.typography.displayFamily,
    fontSize: 14,
    letterSpacing: 1,
    color: '#000',
    marginTop: 8,
    marginBottom: 2,
  },
  empty: {
    fontFamily: t.typography.bodyFamily,
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  card: {
    backgroundColor: SURFACE,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 6,
  },
  cardTitle: {
    fontFamily: t.typography.displayFamily,
    fontSize: 16,
    color: '#000',
  },
  cardRule: {
    borderBottomWidth: 1,
    borderBottomColor: DIVIDER,
    marginTop: 2,
    marginBottom: 4,
  },
  cardBody: {
    fontFamily: t.typography.bodyFamily,
    fontSize: 13,
    color: '#444',
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  button: {
    flex: 1,
    backgroundColor: ACCENT,
    paddingVertical: 9,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontFamily: t.typography.displayFamily,
    fontSize: 13,
  },
  buttonDestructive: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    paddingVertical: 9,
    paddingHorizontal: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  buttonDestructiveText: {
    color: '#888',
    fontFamily: t.typography.displayFamily,
    fontSize: 13,
  },
});
