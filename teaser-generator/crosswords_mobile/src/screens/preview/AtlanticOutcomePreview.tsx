/**
 * AtlanticOutcomePreview.tsx
 * Static win/lose card preview in Atlantic style.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DESIGN_TOKEN_SETS } from '@src/theme/designTokens';

const t = DESIGN_TOKEN_SETS.atlantic;

/** Bright red accent from Atlantic board/outcome motif */
const MOTIF_RED = '#E7131A';

export default function AtlanticOutcomePreview(): React.JSX.Element {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.card}>
        <CornerRow />
        <Text style={styles.brand}>CROS<Text style={{ color: '#E7131A' }}>S</Text>WORD<Text style={{ color: '#E7131A' }}>S</Text></Text>
        <Text style={styles.outcome}>Defeat</Text>
        <View style={styles.rule} />
        <Text style={styles.copy}>
          Your opponent has solved all their words first.{'\n'}Better luck in the next match.
        </Text>

        <View style={styles.statsCard}>
          <Text style={styles.statsHeading}>MATCH STATISTICS</Text>
          <View style={styles.statsRow}>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.statsValue}>0</Text>
              <Text style={styles.statsLabel}>Total Guesses</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.statsValue}>0</Text>
              <Text style={styles.statsLabel}>Clues Used</Text>
            </View>
          </View>
        </View>

        <View style={styles.primaryButton}>
          <Text style={styles.primaryText}>Return to Lobby</Text>
        </View>
        <View style={{ height: 8 }} />
        <Text style={styles.link}>VIEW BOARD</Text>
        <CornerRow bottom />
      </View>
    </SafeAreaView>
  );
}

function CornerRow({ bottom }: { bottom?: boolean }): React.JSX.Element {
  return (
    <View style={[styles.cornerRow, bottom && { marginTop: 12 }]}>
      <View style={styles.corner} />
      <View style={{ flex: 1 }} />
      <View style={[styles.corner, { transform: [{ scaleX: -1 }] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' },
  card: {
    width: '88%',
    backgroundColor: '#fff',
    padding: 24,
    gap: 12,
    borderTopWidth: 6,
    borderTopColor: MOTIF_RED,
  },
  brand: {
    fontFamily: 'CinzelDecorative_700Bold',
    fontSize: 12,
    letterSpacing: 1,
    color: '#000',
    textAlign: 'center',
  },
  outcome: {
    fontFamily: t.typography.displayFamily,
    fontSize: 28,
    color: MOTIF_RED,
    textAlign: 'center',
  },
  rule: {
    alignSelf: 'center',
    width: 80,
    borderBottomWidth: 2,
    borderColor: '#000',
    marginVertical: 4,
  },
  copy: {
    fontFamily: t.typography.bodyFamily,
    fontSize: 14,
    color: '#000',
    textAlign: 'center',
    lineHeight: 20,
  },
  statsCard: {
    backgroundColor: '#fff',
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  statsHeading: {
    fontFamily: t.typography.displayFamily,
    fontSize: 12,
    letterSpacing: 1,
    color: '#000',
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statsValue: {
    fontFamily: t.typography.displayFamily,
    fontSize: 16,
    color: '#000',
  },
  statsLabel: {
    fontFamily: t.typography.bodyFamily,
    fontSize: 12,
    color: '#333',
  },
  primaryButton: {
    backgroundColor: MOTIF_RED,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryText: {
    color: '#fff',
    fontFamily: t.typography.displayFamily,
    fontSize: 16,
  },
  link: {
    fontFamily: t.typography.displayFamily,
    fontSize: 14,
    letterSpacing: 1,
    color: '#000',
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  cornerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  corner: {
    width: 40,
    height: 10,
    borderLeftWidth: 3,
    borderTopWidth: 3,
    borderColor: MOTIF_RED,
  },
});
