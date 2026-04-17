/**
 * AtlanticBoardPreview.tsx
 * -------------------------------------------------------------
 * Static, data-free preview of the Atlantic board layout so we
 * can validate visuals without touching game logic.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DESIGN_TOKEN_SETS } from '@src/theme/designTokens';

const t = DESIGN_TOKEN_SETS.atlantic;

/** Bright red accent from Atlantic board/outcome motif */
const MOTIF_RED = '#E7131A';

const clues = [
  { n: 1, dir: '5 DOWN' },
  { n: 2, dir: '5 ACROSS' },
  { n: 3, dir: '4 DOWN' },
  { n: 4, dir: '4 ACROSS' },
  { n: 5, dir: '6 ACROSS' },
];

export default function AtlanticBoardPreview(): React.JSX.Element {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Header />
        <View style={styles.section}>
          <Text style={styles.title}>Duel!</Text>
          <Text style={styles.subtitle}>JANUARY 26, 2026</Text>
        </View>

        <View style={styles.turnBanner}>
          <Text style={styles.turnText}>YOUR TURN</Text>
        </View>

        <View style={styles.boardFrame}>
          <CornerDecor />
          <GridPlaceholder />
          <CornerDecor bottom />
        </View>

        <View style={styles.cluesCard}>
          <Text style={styles.cluesHeading}>CLUES</Text>
          <View style={{ gap: 10 }}>
            {clues.map((c) => (
              <View key={c.n} style={styles.clueRow}>
                <View style={styles.numberBadge}>
                  <Text style={styles.numberText}>{c.n}</Text>
                </View>
                <View>
                  <Text style={styles.clueDir}>{c.dir}</Text>
                  <Text style={styles.clueLink}>Reveal clue</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Header(): React.JSX.Element {
  return (
    <View style={styles.header}>
      <Text style={styles.headerAction}>{'←'}</Text>
      <View style={styles.headerCenter}>
        <Text style={styles.headerBrand}>CROS<Text style={{ color: '#E7131A' }}>S</Text>WORD<Text style={{ color: '#E7131A' }}>S</Text></Text>
        <Text style={styles.headerSub}>• GAME 464562</Text>
      </View>
      <Text style={styles.headerAction}>Test</Text>
    </View>
  );
}

function CornerDecor({ bottom }: { bottom?: boolean }): React.JSX.Element {
  return (
    <View style={[styles.cornerRow, bottom && { marginTop: 12 }]}>
      <View style={styles.corner} />
      <View style={{ flex: 1 }} />
      <View style={[styles.corner, { transform: [{ scaleX: -1 }] }]} />
    </View>
  );
}

const GRID_SIZE = 9;

function GridPlaceholder(): React.JSX.Element {
  return (
    <View style={styles.gridWrapper}>
      <View style={styles.grid}>
        {Array.from({ length: GRID_SIZE }).map((_, r) => (
          <View key={`row-${r}`} style={styles.gridRow}>
            {Array.from({ length: GRID_SIZE }).map((_, c) => (
              <View
                key={`cell-${r}-${c}`}
                style={[styles.cell, styles.cellOn]}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f0f0f0' },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  headerAction: {
    fontSize: 18,
    color: '#000',
    width: 50,
    textAlign: 'center',
  },
  headerCenter: { alignItems: 'center', flex: 1 },
  headerBrand: {
    fontFamily: 'CinzelDecorative_700Bold',
    fontSize: 14,
    letterSpacing: 1,
    color: '#000',
  },
  headerSub: {
    fontFamily: t.typography.bodyFamily,
    fontSize: 12,
    letterSpacing: 1,
    color: '#000',
  },
  section: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderColor: '#e8e8e8',
  },
  title: {
    fontFamily: t.typography.displayFamily,
    fontSize: 22,
    color: '#000',
  },
  subtitle: {
    fontFamily: t.typography.bodyFamily,
    fontSize: 12,
    letterSpacing: 1,
    color: '#333',
    marginTop: 4,
  },
  turnBanner: {
    backgroundColor: MOTIF_RED,
    paddingVertical: 10,
    alignItems: 'center',
  },
  turnText: {
    color: '#fff',
    fontFamily: t.typography.displayFamily,
    letterSpacing: 1.5,
    fontSize: 14,
  },
  boardFrame: {
    backgroundColor: '#fff',
    padding: 16,
    gap: 8,
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
  gridWrapper: { alignItems: 'center' },
  grid: { gap: 2 },
  gridRow: { flexDirection: 'row', gap: 2 },
  cell: { width: 32, height: 32, borderWidth: 1, borderColor: '#222' },
  cellOn: { backgroundColor: '#fff' },
  cellOff: { backgroundColor: '#f5f5f5' },
  cluesCard: {
    backgroundColor: '#fff',
    padding: 16,
    gap: 12,
  },
  cluesHeading: {
    fontFamily: t.typography.displayFamily,
    fontSize: 14,
    letterSpacing: 1,
    color: '#000',
  },
  clueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  numberBadge: {
    width: 32,
    height: 32,
    backgroundColor: MOTIF_RED,
    justifyContent: 'center',
    alignItems: 'center',
  },
  numberText: {
    color: '#fff',
    fontFamily: t.typography.displayFamily,
    fontSize: 16,
  },
  clueDir: {
    fontFamily: t.typography.displayFamily,
    fontSize: 12,
    color: '#000',
    letterSpacing: 1,
  },
  clueLink: {
    fontFamily: t.typography.bodyFamily,
    fontSize: 14,
    color: '#000',
    textDecorationLine: 'underline',
  },
});
