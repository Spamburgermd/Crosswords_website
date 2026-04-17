/**
 * src/screens/JottsScreen.tsx
 * Atlantic-standard Jotts manager (local-only).
 * A "Jott" is a saved 5-word set for quick reuse in a challenge.
 */
import React, { useRef, useState } from 'react';
import {
  Animated,
  Alert,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import useJottsStore, { Jott } from '../jotts/jottsStore';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { getDictionaryMeta, normalizeWord, isValidWord } from '../dictionary/dictionaryAdapter';
import { buildLocalPlacement } from '../lib/localPlacement';
import useUIStore from '@stores/uiStore';

const MOTIF_RED = '#E7131A';
const BORDER_COLOR = '#E0E0E0';
const STACK_CARD_WIDTH = 170;
const STACK_CARD_OVERLAP = 54;
const STACK_CARD_STEP = STACK_CARD_WIDTH - STACK_CARD_OVERLAP;
const TARGET_LENGTHS = [4, 4, 5, 5, 6] as const;

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function JottsScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const { jotts, addJott, deleteJott } = useJottsStore();
  const masterDictionary = useUIStore((s) => s.dictionary);
  const darkModeEnabled = useUIStore((s) => s.darkModeEnabled);
  const bg = darkModeEnabled ? '#121212' : '#fff';
  const cardBg = darkModeEnabled ? '#1b1b1b' : '#fff';
  const border = darkModeEnabled ? '#2d2d2d' : BORDER_COLOR;
  const text = darkModeEnabled ? '#f2f2f2' : '#000';
  const subText = darkModeEnabled ? '#b8b8b8' : '#777';
  const inputBg = darkModeEnabled ? '#202020' : '#fff';
  const { width: screenWidth } = useWindowDimensions();
  const compactWordRows = screenWidth < 380;
  const centeringPad = (screenWidth - STACK_CARD_WIDTH) / 2;

  // Form state
  const [title, setTitle] = useState('');
  const [words, setWords] = useState<string[]>(['', '', '', '', '']);

  // Navigation index through saved jotts
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const stackScrollX = useRef(new Animated.Value(0)).current;

  const setWord = (idx: number, value: string) => {
    const next = [...words];
    next[idx] = value.toUpperCase().replace(/[^A-Z]/g, '');
    setWords(next);
  };

  const handlePrev = () => {
    if (jotts.length === 0) return;
    const next = selectedIndex === null ? jotts.length - 1 : Math.max(0, selectedIndex - 1);
    setSelectedIndex(next);
    loadJott(jotts[next]);
  };

  const handleNext = () => {
    if (jotts.length === 0) return;
    const next = selectedIndex === null ? 0 : Math.min(jotts.length - 1, selectedIndex + 1);
    setSelectedIndex(next);
    loadJott(jotts[next]);
  };

  const loadJott = (j: Jott) => {
    setTitle(j.title);
    const filled = [...j.words, '', '', '', '', ''].slice(0, 5);
    setWords(filled);
  };

  const validateWords = (normalized: string[]): boolean => {
    if (normalized.length !== 5) {
      Alert.alert('Need 5 words', 'Enter exactly 5 words.');
      return false;
    }
    const dictInvalid = normalized.filter((w) => !isValidWord(w, masterDictionary));
    if (dictInvalid.length > 0) {
      Alert.alert(
        'Unknown words',
        `These words aren't in the ${getDictionaryMeta(masterDictionary).label} dictionary: ${dictInvalid.join(', ')}`,
      );
      return false;
    }
    const placement = buildLocalPlacement(normalized);
    if (!placement.ok) {
      Alert.alert('Board placement failed', "Words not valid together - can't place on grid, choose other words.");
      return false;
    }
    return true;
  };

  const handleSubmitWords = () => {
    const normalized = words.map(normalizeWord).filter(Boolean);
    if (!validateWords(normalized)) return;
    Alert.alert('Words valid', '5 words look good. Tap Save Jott to save.');
  };

  const handleSave = () => {
    const normalized = words.map(normalizeWord).filter(Boolean);
    if (!validateWords(normalized)) return;
    addJott({ title: title.trim() || 'Untitled', words: normalized, dictionaryId: masterDictionary });
    setTitle('');
    setWords(['', '', '', '', '']);
    setSelectedIndex(null);
  };

  const handleDeleteSelected = () => {
    const jott = jotts[boundedSelectedIndex];
    if (!jott) return;
    Alert.alert('Delete Jott', `Delete "${jott.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteJott(jott.id);
          setSelectedIndex(null);
        },
      },
    ]);
  };

  const handleUse = (j: Jott) => {
    (navigation as any).navigate('Challenge', {
      prefillWords: j.words,
      prefillDictionaryId: j.dictionaryId,
    });
  };

  const canSubmit = words.every((w) => w.length >= 4);
  const redGearIcon = require('../../assets/design/icons/GearE1713A.png');
  const cwMotifIcon = require('../../assets/design/icons/CWMotifRed.png');
  const boundedSelectedIndex = selectedIndex === null ? 0 : Math.max(0, Math.min(selectedIndex, jotts.length - 1));

  const handleStackMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (jotts.length === 0) return;
    const rawIndex = event.nativeEvent.contentOffset.x / STACK_CARD_STEP;
    const snappedIndex = Math.max(0, Math.min(jotts.length - 1, Math.round(rawIndex)));
    setSelectedIndex(snappedIndex);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: bg }]}>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}
          >
            <Image
              source={cwMotifIcon}
              style={[styles.motifIcon, { tintColor: '#E7131A' }]}
              resizeMode="contain"
            />
          </Pressable>
          <Text style={[styles.headerTitle, { color: text }]}>Jotts</Text>
        </View>
        <Pressable
          onPress={() => (navigation as any).navigate('Settings')}
          accessibilityRole="button"
          accessibilityLabel="Open settings"
          style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}
        >
          <Image
            source={redGearIcon}
            style={styles.gearIcon}
            resizeMode="contain"
          />
        </Pressable>
      </View>
      <View style={[styles.headerDivider, { borderBottomColor: border }]} />

      {/* Previous / Next navigation */}
      <View style={[styles.navStrip, { backgroundColor: bg }]}>
        <Pressable
          style={styles.navLeft}
          onPress={handlePrev}
          disabled={jotts.length === 0}
        >
          <Text style={[styles.navLeftText, { color: text }, jotts.length === 0 && styles.navDisabled]}>
            Previous Jott
          </Text>
        </Pressable>
        <Pressable
          style={[styles.navRight, jotts.length === 0 && styles.navRightDisabled]}
          onPress={handleNext}
          disabled={jotts.length === 0}
        >
          <Text style={styles.navRightText}>Next Jott</Text>
        </Pressable>
      </View>

      <ScrollView style={{ backgroundColor: bg }} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

        {/* Create / Edit form */}
        <View style={[styles.formCard, { borderColor: border, backgroundColor: cardBg }]}>

          {/* Section heading with title input */}
          <View style={[styles.formHeadingRow, { borderBottomColor: border }]}>
            <TextInput
              value={title}
              onChangeText={(v) => setTitle(v)}
              placeholder="Jott Name"
              placeholderTextColor={subText}
              style={[styles.formTitleInput, { color: text }]}
            />
          </View>

                    {/* Word inputs */}
          <View style={styles.wordsSection}>
            {words.map((w, idx) => (
              <TextInput
                key={idx}
                value={w}
                onChangeText={(v) => setWord(idx, v)}
                placeholder={`${TARGET_LENGTHS[idx]} letter word`}
                placeholderTextColor={subText}
                style={[styles.wordInput, { borderColor: border, color: text }]}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={TARGET_LENGTHS[idx]}
              />
            ))}
          </View>

          {/* Action buttons */}
          <View style={styles.buttonGroup}>
            <Pressable
              style={[styles.submitButton, !canSubmit && styles.buttonDisabled]}
              onPress={handleSubmitWords}
              disabled={!canSubmit}
            >
              <Text style={styles.submitButtonText}>Submit Words</Text>
            </Pressable>
            <Pressable
              style={[styles.saveButton, !canSubmit && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={!canSubmit}
            >
              <Text style={styles.saveButtonText}>Save Jott</Text>
            </Pressable>
          </View>
        </View>

        {/* Saved Jott Cards */}
        {jotts.length > 0 && (
          <View style={styles.cardsSection}>
            <Animated.FlatList
              data={jotts}
              keyExtractor={(item) => item.id}
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToInterval={STACK_CARD_STEP}
              onMomentumScrollEnd={handleStackMomentumEnd}
              style={styles.cardsList}
              contentContainerStyle={{ paddingLeft: centeringPad, paddingRight: centeringPad, paddingBottom: 8 }}
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { x: stackScrollX } } }],
                { useNativeDriver: true },
              )}
              scrollEventThrottle={16}
              renderItem={({ item, index }) => {
                const inputRange = [
                  (index - 1) * STACK_CARD_STEP,
                  index * STACK_CARD_STEP,
                  (index + 1) * STACK_CARD_STEP,
                ];
                const scale = stackScrollX.interpolate({
                  inputRange,
                  outputRange: [0.72, 1, 0.72],
                  extrapolate: 'clamp',
                });
                const translateY = stackScrollX.interpolate({
                  inputRange,
                  outputRange: [16, 0, 16],
                  extrapolate: 'clamp',
                });
                const opacity = stackScrollX.interpolate({
                  inputRange,
                  outputRange: [0.35, 1, 0.35],
                  extrapolate: 'clamp',
                });
                const isActive = index === boundedSelectedIndex;

                return (
                  <Animated.View
                    style={[
                      styles.cardSnapItem,
                      index > 0 && { marginLeft: -STACK_CARD_OVERLAP },
                      {
                        zIndex: isActive ? jotts.length + 1 : jotts.length - index,
                        opacity,
                        transform: [{ translateY }, { scale }],
                      },
                    ]}
                  >
                    <Pressable
                      style={[
                        styles.jottCard,
                        darkModeEnabled && { backgroundColor: '#262626', borderColor: '#3a3a3a' },
                        isActive && styles.jottCardActive,
                      ]}
                      onPress={() => handleUse(item)}
                      onLongPress={() => {
                        Alert.alert('Delete Jott', `Delete "${item.title}"?`, [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Delete', style: 'destructive', onPress: () => deleteJott(item.id) },
                        ]);
                      }}
                    >
                      <View style={[styles.cardHeader, darkModeEnabled && { borderBottomColor: '#3a3a3a' }]}>
                        <Text style={styles.cardTitle}>{item.title.toUpperCase()}</Text>
                      </View>
                      <View style={styles.cardBody}>
                        {item.words.map((word, i) => (
                          <View
                            key={i}
                            style={[
                              styles.cardWordRow,
                              i < item.words.length - 1 && styles.cardWordRowBorder,
                              darkModeEnabled && i < item.words.length - 1 && { borderBottomColor: '#353535' },
                            ]}
                          >
                            <Text style={[styles.cardWord, darkModeEnabled && { color: '#f2f2f2' }]}>{word}</Text>
                          </View>
                        ))}
                      </View>
                    </Pressable>
                  </Animated.View>
                );
              }}
            />
          </View>
        )}
        {jotts.length > 0 && (
          <View style={styles.dotsRow}>
            {jotts.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === boundedSelectedIndex ? styles.dotActive : styles.dotInactive]}
              />
            ))}
          </View>
        )}

        {jotts.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: text }]}>No jotts saved yet.</Text>
            <Text style={[styles.emptyHint, { color: subText }]}>Enter 5 words above and tap Save Jott.</Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },

  // ── Header ──────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  headerDivider: {
    borderBottomWidth: 1,
    marginHorizontal: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  motifIcon: {
    width: 40,
    height: 40,
  },
  headerTitle: {
    fontFamily: 'LibreBaskerville_700Bold',
    fontSize: 18,
    color: '#000',
  },
  gearIcon: {
    width: 20,
    height: 20,
  },

  // ── Previous / Next strip ───────────────────────────────
  navStrip: {
    flexDirection: 'row',
    marginHorizontal: 16,
  },
  navLeft: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 5,
  },
  navLeftText: {
    fontFamily: 'LibreBaskerville_700Bold',
    fontSize: 14,
    color: '#000',
  },
  navDisabled: {
    color: '#bbb',
  },
  navRight: {
    flex: 1,
    backgroundColor: MOTIF_RED,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 5,
  },
  navRightDisabled: {
    backgroundColor: '#ccc',
  },
  navRightText: {
    fontFamily: 'LibreBaskerville_700Bold',
    fontSize: 14,
    color: '#fff',
  },

  // ── Scroll content ──────────────────────────────────────
  scrollContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 16,
  },

  // ── Create / Edit form ──────────────────────────────────
  formCard: {
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    padding: 16,
    gap: 10,
  },
  formHeadingRow: {
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
    paddingBottom: 6,
    marginBottom: 2,
  },
  formTitleInput: {
    fontFamily: 'LibreBaskerville_700Bold',
    fontSize: 18,
    color: '#000',
    padding: 0,
  },

  // ── Word inputs ─────────────────────────────────────────
  wordsSection: {
    gap: 0,
  },
  wordsLabel: {
    fontFamily: 'NotoSerif_400Regular',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#000',
    marginBottom: 6,
  },
  wordInput: {
    paddingVertical: 7,
    fontSize: 15,
    fontFamily: 'NotoSerif_400Regular',
    color: '#333',
    textTransform: 'uppercase',
    borderBottomWidth: 1,
  },

  // ── Buttons ─────────────────────────────────────────────
  buttonGroup: {
    gap: 6,
    marginTop: 2,
  },
  submitButton: {
    borderWidth: 1,
    borderColor: '#1e1e1e',
    paddingVertical: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  submitButtonText: {
    fontFamily: 'LibreBaskerville_700Bold',
    fontSize: 14,
    color: '#000',
  },
  saveButton: {
    backgroundColor: MOTIF_RED,
    paddingVertical: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontFamily: 'LibreBaskerville_700Bold',
    fontSize: 14,
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.5,
  },

  // ── Jott Cards ──────────────────────────────────────────
  cardsSection: {
    height: 230,
    marginTop: 8,
  },
  cardsList: {
    overflow: 'visible',
  },
  cardSnapItem: {
    width: STACK_CARD_WIDTH,
  },
  jottCard: {
    width: '100%',
    backgroundColor: '#fff',
    elevation: 0,
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    borderWidth: 1,
    borderColor: '#e2e2e2',
    borderRadius: 0,
  },
  jottCardActive: {
    elevation: 8,
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
  },
  dot: {
    borderRadius: 99,
  },
  dotActive: {
    width: 8,
    height: 8,
    backgroundColor: '#E7131A',
  },
  dotInactive: {
    width: 6,
    height: 6,
    backgroundColor: '#ccc',
  },
  cardHeader: {
    backgroundColor: MOTIF_RED,
    borderBottomWidth: 1,
    borderBottomColor: '#c81218',
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  cardTitle: {
    fontFamily: 'LibreBaskerville_700Bold',
    fontSize: 15,
    color: '#fff',
    textAlign: 'center',
  },
  cardBody: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'stretch',
  },
  cardWordRow: {
    paddingVertical: 4,
    alignItems: 'center',
  },
  cardWordRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#ededed',
  },
  cardWord: {
    fontFamily: 'NotoSerif_400Regular',
    fontSize: 15,
    color: '#000',
    lineHeight: 22,
    textAlign: 'center',
    textTransform: 'uppercase',
  },

  // ── Delete selected jott ────────────────────────────────
  deleteRow: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  deleteRowText: {
    fontFamily: 'LibreBaskerville_700Bold',
    fontSize: 13,
    color: '#E7131A',
    letterSpacing: 0.5,
  },

  // ── Empty state ─────────────────────────────────────────
  emptyState: {
    padding: 40,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontFamily: 'LibreBaskerville_700Bold',
    fontSize: 16,
    color: '#333',
  },
  emptyHint: {
    fontFamily: 'NotoSerif_400Regular',
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
  },
});
