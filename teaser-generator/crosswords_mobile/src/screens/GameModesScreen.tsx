/**
 * src/screens/GameModesScreen.tsx
 * -----------------------------------------------------------
 * Standalone screen showing game mode cards with optional
 * drill-in walkthroughs. Extracted from TutorialScreen so it
 * can be accessed from the Lobby independently.
 */
import React, { useCallback, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { DESIGN_TOKEN_SETS } from '@src/theme/designTokens';
import type { RootStackParamList } from '@src/navigation/AppNavigator';
import useUIStore from '@stores/uiStore';

const tAtlantic = DESIGN_TOKEN_SETS.atlantic;
const MOTIF_RED = '#E7131A';

type GameModesNav = NativeStackNavigationProp<RootStackParamList, 'GameModes'>;

// ─── Mode card data ──────────────────────────────────────────

const MODE_CARDS: Array<{
  title: string;
  body: string;
  subtitle: string;
  accent: string;
  walkthroughKey: WalkthroughKey;
}> = [
  {
    title: 'Duel',
    body: 'Race an AI opponent to solve all 5 words first — or take turns and see who finishes in fewer guesses.',
    subtitle: 'Easy · Normal · Hard',
    accent: MOTIF_RED,
    walkthroughKey: 'botDuel',
  },
  {
    title: 'Challenge',
    body: 'Pick 5 words, generate a code, and share it. Your friend plays the same board — compare results when you\'re both done.',
    subtitle: 'Custom words · Jotts · QR or link',
    accent: '#2F6FED',
    walkthroughKey: 'challenge',
  },
  {
    title: 'Blind Match',
    body: 'Neither player knows the words. Enter a shared number, and the app generates the same hidden board for both of you. Pure fairness.',
    subtitle: 'Random words · Same seed = same board',
    accent: '#2ecc71',
    walkthroughKey: 'seed',
  },
];

// ─── Walkthrough step data ───────────────────────────────────

type WalkthroughKey = 'botDuel' | 'challenge' | 'seed';
type WalkthroughStep = { step: string; title: string; body: string; screenshot?: number; coda?: string };

let DUEL_LOBBY_IMG: number | undefined;
let DUEL_OPTIONS_IMG: number | undefined;
try { DUEL_LOBBY_IMG = require('../../assets/screenshots/duel_lobby.jpg'); } catch (_) {}
try { DUEL_OPTIONS_IMG = require('../../assets/screenshots/duel_options.jpg'); } catch (_) {}

const BOT_DUEL_STEPS: WalkthroughStep[] = [
  { step: '1', title: 'Open Duel', body: 'From the lobby, tap "Duel".\nYou\'ll choose your settings before starting.', screenshot: DUEL_LOBBY_IMG },
  { step: '2', title: 'Set Up Your Duel', body: 'Choose the difficulty — it determines your odds of beating the House opponent.\n\nPick a play style — Race or Turns.\n\nDecide if your opponent faces Random words or risk your own wits!', screenshot: DUEL_OPTIONS_IMG },
  { step: '3', title: 'Solve and Win', body: 'Solve the puzzle before the House does.\n\nSee the Ledger for your statistics.' },
];

const CHALLENGE_STEPS: WalkthroughStep[] = [
  { step: '1', title: 'Open Challenge', body: 'From the lobby, tap "Challenge".\nYou\'ll build a custom puzzle for someone else to solve.' },
  { step: '2', title: 'Enter Your 5 Words', body: 'Type 5 words matching the length pattern (4, 4, 5, 5, 6 letters).\nPick a theme — animals, movies, cities — to make it fun.' },
  { step: '3', title: 'Or Use a Jott', body: 'Have a favorite word set? Open your Jotts and tap one to prefill all 5 words instantly.\nCreate Jotts from the lobby or Settings.' },
  { step: '4', title: 'Create the Challenge', body: 'Tap "Create Challenge" to lock your words and generate a unique puzzle code.' },
  { step: '5', title: 'Share the Code', body: 'Send the code via text, WhatsApp, email, or any app.\nYour friend needs this code to play your puzzle.' },
  { step: '6', title: 'Friend Imports and Plays', body: 'Your friend opens the app, taps "Enter Code", and pastes it.\nThey get the same board and play independently.' },
  { step: '7', title: 'Compare Results', body: 'Once you\'ve both finished, compare guess counts.\nWho solved it in fewer tries?' },
];

// Static screenshot assets for Blind Match walkthrough steps.
// Save your screenshots to these paths to have them appear in the walkthrough.
const SEED_SCREENSHOTS: Record<number, number | undefined> = {
  0: undefined,
  1: undefined,
  2: undefined,
};
try {
  SEED_SCREENSHOTS[0] = require('../../assets/screenshots/blind_match_screen.jpg');
} catch (_) {}
try {
  SEED_SCREENSHOTS[1] = require('../../assets/screenshots/blind_cast_glove.jpg');
} catch (_) {}
try {
  SEED_SCREENSHOTS[2] = require('../../assets/screenshots/blind_challenge_issued.jpg');
} catch (_) {}

const SEED_STEPS: WalkthroughStep[] = [
  { step: '1', title: 'Blind Match', body: 'In a blind match both players are blinded to the target words.\n\nThrow down your "glove" to get a shareable number — both players enter it to get the same hidden board.', screenshot: SEED_SCREENSHOTS[0] },
  { step: '2', title: 'How To Start', body: 'From Challenge → Blind Match → Pick a dictionary → Throw down the glove.\nThis generates the shareable number.', screenshot: SEED_SCREENSHOTS[1] },
  { step: '3', title: 'The Glove Is Cast', body: 'Share the code via text, QR code, or your favorite messaging service.\n\nYour opponent copies that number into the game — it creates the board and starts the match.', coda: 'Good luck… En Garde!', screenshot: SEED_SCREENSHOTS[2] },
];

const WALKTHROUGH_DATA: Record<WalkthroughKey, { title: string; steps: WalkthroughStep[]; accent: string }> = {
  botDuel:   { title: 'Duel', steps: BOT_DUEL_STEPS, accent: MOTIF_RED },
  challenge: { title: 'Challenge', steps: CHALLENGE_STEPS, accent: '#2F6FED' },
  seed:      { title: 'Blind Match', steps: SEED_STEPS, accent: '#2ecc71' },
};

// ─── Main component ──────────────────────────────────────────

export default function GameModesScreen(): React.JSX.Element {
  const navigation = useNavigation<GameModesNav>();
  const darkMode = useUIStore((s) => s.darkModeEnabled);

  const [activeWalkthrough, setActiveWalkthrough] = useState<WalkthroughKey | null>(null);
  const [walkthroughStep, setWalkthroughStep] = useState(0);

  const bg = darkMode ? '#121212' : tAtlantic.colors.screenBackground;
  const cardBg = darkMode ? '#1b1b1b' : '#fff';
  const titleColor = darkMode ? '#f2f2f2' : '#000';
  const bodyColor = darkMode ? '#d1d1d1' : '#444';
  const border = darkMode ? '#2d2d2d' : '#e2e2e2';

  const openWalkthrough = useCallback((key: WalkthroughKey) => {
    setWalkthroughStep(0);
    setActiveWalkthrough(key);
  }, []);

  // ── Drill-in walkthrough view ─────────────────────────────
  if (activeWalkthrough) {
    const wt = WALKTHROUGH_DATA[activeWalkthrough];
    const steps = wt.steps;
    const step = steps[walkthroughStep];
    const isLast = walkthroughStep === steps.length - 1;
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: bg }]}>
        <View style={[styles.header, { borderColor: border }]}>
          <Pressable onPress={() => setActiveWalkthrough(null)} style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}>
            <Image
              source={require('../../assets/design/icons/CWMotifRed.png')}
              style={[styles.brandIcon, { tintColor: MOTIF_RED }]}
              resizeMode="contain"
            />
          </Pressable>
          <Text style={[styles.headerTitle, { color: titleColor }]}>{wt.title}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={[styles.headerDivider, { borderColor: border }]} />
        <ScrollView contentContainerStyle={styles.wtScrollContent}>
          {/* ── Screenshot / visual area ─────────────────── */}
          <View style={[styles.wtVisualArea, { borderColor: border }, step.screenshot ? styles.wtVisualAreaFilled : null]}>
            {step.screenshot ? (
              <Image
                source={step.screenshot}
                style={styles.wtScreenshot}
                resizeMode="contain"
              />
            ) : (
              <Image
                source={require('../../assets/design/icons/CWMotifRed.png')}
                style={[styles.wtVisualMotif, { tintColor: MOTIF_RED }]}
                resizeMode="contain"
              />
            )}
          </View>

          {/* ── Step card ────────────────────────────────── */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
            <View style={[styles.accentBar, { backgroundColor: MOTIF_RED }]} />
            <View style={[styles.wtHeaderRow, { borderColor: border }]}>
              <View style={styles.wtMotifRow}>
                <Image
                  source={require('../../assets/design/icons/CWMotifRed.png')}
                  style={[styles.wtMotif, { tintColor: MOTIF_RED }]}
                  resizeMode="contain"
                />
                <Text style={[styles.wtBadge, { color: darkMode ? '#666' : '#999' }]}>
                  Step {step.step} of {steps.length}
                </Text>
              </View>
              <Text style={[styles.cardTitle, { color: titleColor }]}>{step.title}</Text>
            </View>
            <Text style={[styles.cardBody, { color: bodyColor }]}>{step.body}</Text>
            {step.coda ? <Text style={[styles.cardBody, { color: bodyColor, textAlign: 'right' }]}>{step.coda}</Text> : null}
          </View>
          <View style={styles.dots}>
            {steps.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, { backgroundColor: i === walkthroughStep ? MOTIF_RED : (darkMode ? '#444' : '#ddd') }]}
              />
            ))}
          </View>
          <View style={styles.wtNavRow}>
            <Pressable
              onPress={() => setWalkthroughStep((p) => Math.max(0, p - 1))}
              disabled={walkthroughStep === 0}
              style={({ pressed }) => [
                styles.wtNavBtn,
                { borderColor: border },
                walkthroughStep === 0 && { opacity: 0.3 },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={[styles.wtNavBtnText, { color: titleColor }]}>{'‹ Prev'}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (isLast) setActiveWalkthrough(null);
                else setWalkthroughStep((p) => p + 1);
              }}
              style={({ pressed }) => [styles.ctaBtn, { flex: 1 }, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.ctaBtnText}>{isLast ? 'Done' : 'Next ›'}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Main card list (vertical) ──────────────────────────────
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: bg }]}>
      <View style={[styles.header, { borderColor: border }]}>
        <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}>
          <Image
            source={require('../../assets/design/icons/CWMotifRed.png')}
            style={[styles.brandIcon, { tintColor: MOTIF_RED }]}
            resizeMode="contain"
          />
        </Pressable>
        <Text style={[styles.headerTitle, { color: titleColor }]}>Game Modes</Text>
        <View style={styles.headerSpacer} />
      </View>
      <View style={[styles.headerDivider, { borderColor: border }]} />
      <ScrollView contentContainerStyle={styles.cardList}>
        {MODE_CARDS.map((card) => (
          <View
            key={card.title}
            style={[
              styles.card,
              { backgroundColor: cardBg, borderColor: border },
            ]}
          >
            <View style={[styles.accentBar, { backgroundColor: MOTIF_RED }]} />
            <View style={[styles.cardHeader, { borderColor: border }]}>
              <Image
                source={require('../../assets/design/icons/CWMotifRed.png')}
                style={[styles.cardMotif, { tintColor: MOTIF_RED }]}
                resizeMode="contain"
              />
              <Text style={[styles.cardTitle, { color: titleColor }]}>{card.title}</Text>
            </View>
            <Text style={[styles.cardBody, { color: bodyColor }]}>{card.body}</Text>
            <Pressable
              onPress={() => openWalkthrough(card.walkthroughKey)}
              style={({ pressed }) => [styles.learnMoreBtn, { borderColor: darkMode ? '#555' : '#1e1e1e' }, pressed && { opacity: 0.7 }]}
            >
              <Text style={[styles.learnMoreText, { color: darkMode ? '#ccc' : '#1e1e1e' }]}>{'Learn how \u2192'}</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingTop: 6,
  },
  headerDivider: {
    marginHorizontal: 20,
    borderBottomWidth: 1,
  },
  brandIcon: { width: 40, height: 40 },
  headerTitle: {
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 18,
  },
  headerSpacer: { width: 24 },

  // ── Vertical card list ─────────────────────────────
  cardList: {
    padding: 20,
    gap: 16,
    paddingBottom: 32,
  },
  card: {
    padding: 20,
    gap: 10,
    overflow: 'hidden',
    borderWidth: 1,
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 4,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  cardMotif: { width: 20, height: 20 },
  cardTitle: {
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 18,
  },
  cardBody: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'justify',
  },
  cardSubtitle: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  learnMoreBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 4,
  },
  learnMoreText: {
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 13,
  },

  // ── Walkthrough drill-in ───────────────────────────
  wtScrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 32,
  },
  wtVisualArea: {
    height: 200,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  wtVisualAreaFilled: {
    height: 320,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  wtScreenshot: {
    width: '100%',
    height: '100%',
  },
  wtVisualMotif: {
    width: 120,
    height: 120,
  },
  wtVisualPlaceholder: {
    width: 48,
    height: 48,
    marginBottom: 8,
  },
  wtVisualLabel: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  wtHeaderRow: {
    marginLeft: 4,
    paddingBottom: 8,
    borderBottomWidth: 1,
    gap: 4,
  },
  wtMotifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  wtMotif: { width: 20, height: 20 },
  wtBadge: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  wtNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  wtNavBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
  },
  wtNavBtnText: {
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 15,
  },
  ctaBtn: {
    alignSelf: 'center',
    backgroundColor: MOTIF_RED,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  ctaBtnText: {
    color: '#fff',
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 16,
    textAlign: 'center',
  },
});
