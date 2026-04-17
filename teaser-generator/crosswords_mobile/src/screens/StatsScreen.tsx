/**
 * src/screens/StatsScreen.tsx
 * -----------------------------------------------------------
 * Atlantic-styled stats dashboard. Shows win streaks, overall
 * performance, and per-mode breakdowns derived from StoredResult[].
 */

import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { DESIGN_TOKEN_SETS } from '@src/theme/designTokens';
import type { RootStackParamList } from '@src/navigation/AppNavigator';
import { getSnapshot, subscribe } from '@src/localChallenge/localChallengeStore';
import { computeStats, type GameStats, type ModeStats } from '@src/localChallenge/statsComputer';
import useUIStore from '@stores/uiStore';

const t = DESIGN_TOKEN_SETS.atlantic;
type Nav = NativeStackNavigationProp<RootStackParamList, 'Stats'>;

type Palette = {
  screen: string;
  card: string;
  border: string;
  title: string;
  label: string;
  value: string;
  muted: string;
  accent: string;
};

function formatTime(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return min > 0 ? `${min}m ${sec}s` : `${sec}s`;
}

function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function Header({ onBack, palette }: { onBack: () => void; palette: Palette }) {
  return (
    <View style={[styles.header, { borderColor: palette.border }]}>
      <Pressable onPress={onBack} style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}>
        <Image
          source={require('../../assets/design/icons/CWMotifRed.png')}
          style={[styles.brandIcon, { tintColor: '#E7131A' }]}
          resizeMode="contain"
        />
      </Pressable>
      <Text style={[styles.headerTitle, { color: palette.title }]}>Ledger</Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

function Card({ title, children, palette }: { title?: string; children: React.ReactNode; palette: Palette }) {
  return (
    <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
      {title ? <Text style={[styles.cardTitle, { color: palette.title }]}>{title}</Text> : null}
      <View style={{ gap: 6 }}>{children}</View>
    </View>
  );
}

function StatRow({ label, value, palette }: { label: string; value: string; palette: Palette }) {
  return (
    <View style={[styles.statRow, { borderColor: palette.border }]}>
      <Text style={[styles.statLabel, { color: palette.label }]}>{label}</Text>
      <Text style={[styles.statValue, { color: palette.value }]}>{value}</Text>
    </View>
  );
}

function StreakCard({ stats, palette }: { stats: GameStats; palette: Palette }) {
  return (
    <Card palette={palette}>
      <View style={styles.streakRow}>
        <View style={styles.streakItem}>
          <Text style={[styles.streakNumber, { color: palette.accent }]}>{stats.currentStreak}</Text>
          <Text style={[styles.streakLabel, { color: palette.muted }]}>Daily Streak</Text>
        </View>
        <View style={styles.streakDivider} />
        <View style={styles.streakItem}>
          <Text style={[styles.streakNumber, { color: palette.accent }]}>{stats.bestStreak}</Text>
          <Text style={[styles.streakLabel, { color: palette.muted }]}>Best Daily Streak</Text>
        </View>
      </View>
    </Card>
  );
}

function ModeCard({ title, mode, palette }: { title: string; mode: ModeStats; palette: Palette }) {
  if (mode.gamesPlayed === 0) return null;
  return (
    <Card title={title} palette={palette}>
      <StatRow label="Games Played" value={String(mode.gamesPlayed)} palette={palette} />
      <StatRow label="Win Rate" value={formatPercent(mode.winRate)} palette={palette} />
      <StatRow label="Avg Guesses / Word" value={mode.avgGuessesPerWord > 0 ? mode.avgGuessesPerWord.toFixed(1) : '-'} palette={palette} />
      {mode.bestGameGuesses != null && (
        <StatRow label="Best Game" value={`${mode.bestGameGuesses} guesses`} palette={palette} />
      )}
      {mode.fastestSolveTimeMs != null && (
        <StatRow label="Fastest Solve" value={formatTime(mode.fastestSolveTimeMs)} palette={palette} />
      )}
      {mode.avgSolveTimeMs != null && (
        <StatRow label="Avg Solve Time" value={formatTime(mode.avgSolveTimeMs)} palette={palette} />
      )}
    </Card>
  );
}

export default function StatsScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const darkModeEnabled = useUIStore((state) => state.darkModeEnabled);
  const hasCompletedTutorial = useUIStore((state) => state.hasCompletedTutorial);

  const [snap, setSnap] = useState(getSnapshot());
  useEffect(() => {
    const unsub = subscribe(() => setSnap(getSnapshot()));
    return unsub;
  }, []);

  const stats = computeStats(snap.results);

  const palette: Palette = darkModeEnabled
    ? {
        screen: '#121212',
        card: '#1b1b1b',
        border: '#2d2d2d',
        title: '#f2f2f2',
        label: '#f0f0f0',
        value: '#f2f2f2',
        muted: '#a0a0a0',
        accent: '#E7131A',
      }
    : {
        screen: t.colors.screenBackground,
        card: '#fff',
        border: '#e6e6e6',
        title: '#000',
        label: '#000',
        value: '#000',
        muted: '#777',
        accent: '#E7131A',
      };

  const hasAnyGames = stats.overall.gamesPlayed > 0;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.screen }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Header onBack={() => navigation.goBack()} palette={palette} />

        {hasCompletedTutorial ? (
          <Card title="TUTORIAL" palette={palette}>
            <Text style={[styles.tutorialBadge, { color: palette.accent }]}>Tutorial Complete</Text>
            <Text style={[styles.tutorialCopy, { color: palette.muted }]}>
              Tutorial progress is tracked separately and does not count toward Ledger totals.
            </Text>
          </Card>
        ) : null}

        {!hasAnyGames ? (
          <Card palette={palette}>
            <Text style={[styles.emptyText, { color: palette.muted }]}>
              Play a game to start tracking stats.
            </Text>
          </Card>
        ) : (
          <>
            <StreakCard stats={stats} palette={palette} />

            <Card title="ALL MODES" palette={palette}>
              <StatRow label="Games Played" value={String(stats.overall.gamesPlayed)} palette={palette} />
              <StatRow label="Won" value={String(stats.overall.gamesWon)} palette={palette} />
              <StatRow label="Win Rate" value={formatPercent(stats.overall.winRate)} palette={palette} />
              <StatRow
                label="Avg Guesses / Word"
                value={stats.overall.avgGuessesPerWord > 0 ? stats.overall.avgGuessesPerWord.toFixed(1) : '-'}
                palette={palette}
              />
              {stats.overall.bestGameGuesses != null && (
                <StatRow label="Best Game" value={`${stats.overall.bestGameGuesses} guesses`} palette={palette} />
              )}
              {stats.overall.fastestSolveTimeMs != null && (
                <StatRow label="Fastest Solve" value={formatTime(stats.overall.fastestSolveTimeMs)} palette={palette} />
              )}
            </Card>

            <ModeCard title="BOT DUEL" mode={stats.byMode.bot} palette={palette} />
            <ModeCard title="DAILY CHALLENGE" mode={stats.byMode.daily} palette={palette} />
            <ModeCard title="SOLO" mode={stats.byMode.solo} palette={palette} />
            <ModeCard title="FRIEND CHALLENGE" mode={stats.byMode.pvp} palette={palette} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flexGrow: 1, padding: 16, gap: 14 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  brandIcon: { width: 40, height: 40 },
  headerTitle: {
    fontFamily: t.typography.displayFamily,
    fontSize: 18,
  },
  headerSpacer: { width: 24 },
  card: {
    padding: 14,
    gap: 8,
    borderWidth: 1,
  },
  cardTitle: {
    fontFamily: t.typography.displayFamily,
    fontSize: 12,
    letterSpacing: 1,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
  },
  statLabel: {
    fontFamily: t.typography.displayFamily,
    fontSize: 14,
  },
  statValue: {
    fontFamily: t.typography.bodyFamily,
    fontSize: 14,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingVertical: 8,
  },
  streakItem: {
    alignItems: 'center',
    gap: 2,
  },
  streakNumber: {
    fontFamily: t.typography.displayFamily,
    fontSize: 32,
    fontWeight: '700',
  },
  streakLabel: {
    fontFamily: t.typography.bodyFamily,
    fontSize: 12,
  },
  streakDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e6e6e6',
  },
  emptyText: {
    fontFamily: t.typography.bodyFamily,
    fontSize: 15,
    textAlign: 'center',
    paddingVertical: 24,
  },
  tutorialBadge: {
    fontFamily: t.typography.displayFamily,
    fontSize: 18,
  },
  tutorialCopy: {
    fontFamily: t.typography.bodyFamily,
    fontSize: 13,
    lineHeight: 18,
  },
});
