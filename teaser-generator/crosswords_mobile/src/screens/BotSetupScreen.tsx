/**
 * src/screens/BotSetupScreen.tsx
 * -------------------------------------------------------------
 * Bot game setup screen — Settings-style layout.
 * - Header with back icon
 * - SETUP card: Difficulty, Play Style, Bot Words, Dictionary
 * - dictPicker-style segment selectors throughout
 * - Dark mode palette support
 */
import React, { useCallback, useRef, useState } from 'react';
import {
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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { DESIGN_TOKEN_SETS } from '@src/theme/designTokens';
import InfoTooltip, { type AnchorRect } from '@components/InfoTooltip';
import type { BotDifficulty } from '@src/bots/botEngine';
import type { DictionaryId } from '@src/dictionary/dictionaryAdapter';
import { getDictionaryMeta, getVisibleDictionaryOptions, isValidWord, normalizeWord, supportsCurrentTargetPattern } from '@src/dictionary/dictionaryAdapter';
import { generateTargetsFromSeed } from '@src/localChallenge/seededTargets';
import { buildLocalPlacement } from '@src/lib/localPlacement';
import { createBotSession } from '@src/localChallenge/localChallengeStore';
import { createRandomSeed } from '@src/localChallenge/seedInput';
import type { RootStackParamList } from '@src/navigation/AppNavigator';
import useUIStore from '@stores/uiStore';

const t = DESIGN_TOKEN_SETS.atlantic;

type WordInputMode = 'custom' | 'random';
type BotPlayStyle = 'race' | 'turns';

const TARGET_LENGTHS = [4, 4, 5, 5, 6] as const;
type BotSetupNavigation = NativeStackNavigationProp<RootStackParamList, 'BotSetup'>;

type Palette = {
  screen: string;
  card: string;
  border: string;
  title: string;
  label: string;
  body: string;
  inputBg: string;
  inputText: string;
  inputPlaceholder: string;
  segmentBg: string;
};

export default function BotSetupScreen(): React.JSX.Element {
  const navigation = useNavigation<BotSetupNavigation>();
  const masterDictionary = useUIStore((s) => s.dictionary);
  const darkModeEnabled = useUIStore((s) => s.darkModeEnabled);

  const [difficulty, setDifficulty] = useState<BotDifficulty>('normal');
  const [playStyle, setPlayStyle] = useState<BotPlayStyle>('race');
  const [wordMode, setWordMode] = useState<WordInputMode>('random');
  const [customWords, setCustomWords] = useState<string[]>(['', '', '', '', '']);
  const [dictionaryId, setDictionaryId] = useState<DictionaryId>(masterDictionary);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  const palette: Palette = darkModeEnabled
    ? {
        screen: '#121212',
        card: '#1b1b1b',
        border: '#2d2d2d',
        title: '#f2f2f2',
        label: '#f0f0f0',
        body: '#d0d0d0',
        inputBg: '#202020',
        inputText: '#f2f2f2',
        inputPlaceholder: '#9a9a9a',
        segmentBg: '#232323',
      }
    : {
        screen: t.colors.screenBackground,
        card: '#fff',
        border: '#e6e6e6',
        title: '#000',
        label: '#000',
        body: '#666',
        inputBg: '#fff',
        inputText: '#333',
        inputPlaceholder: '#8a8a8a',
        segmentBg: '#f5f5f5',
      };

  // Long-press tooltip state
  const [activeTooltip, setActiveTooltip] = useState<{ title: string; body: string; rect: AnchorRect } | null>(null);
  const showTooltip = useCallback((ref: React.RefObject<View | null>, title: string, body: string) => {
    ref.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) setActiveTooltip({ title, body, rect: { x, y, width, height } });
    });
  }, []);

  const difficultyRef = useRef<View>(null);
  const playStyleRef = useRef<View>(null);
  const botWordsRef = useRef<View>(null);
  const dictRef = useRef<View>(null);

  const DIFFICULTY_INFO: Record<BotDifficulty, string> = {
    easy: 'Makes educated guesses but sometimes forgets past clues. A friendly warm-up.',
    normal: 'Remembers most clues and picks smart letters. A fair fight.',
    hard: 'Perfect memory, optimal strategy. Only experts need apply.',
  };

  const PLAY_STYLE_INFO: Record<BotPlayStyle, string> = {
    race: 'Both solve in parallel. Fewer guesses wins.',
    turns: 'Alternating turns. You go, then the bot goes.',
  };

  const DICT_INFO: Record<DictionaryId, { title: string; body: string }> = {
    common: { title: 'Casual', body: '~4,500 common English words.\n\n"I shout answers at the TV during Wheel of Fortune!"' },
    modified: { title: 'Medium', body: '~12,000 words including literary vocabulary.\n\n"I regularly beat Ken Jennings at Charades."' },
    core: { title: 'Casual', body: '~4,500 common English words.\n\n"I shout answers at the TV during Wheel of Fortune!"' },
    standard: { title: 'Medium', body: '~12,000 words including literary vocabulary.\n\n"I regularly beat Ken Jennings at Charades."' },
    advanced: { title: 'Sharp', body: 'Higher-difficulty dictionary.\n\n"People believe me when I say I read Ulysses."' },
    canon: { title: 'Canon', body: 'Top dictionary tier used for guess validation.\n\n"I keep a thesaurus by the bed for fun."' },
    twl: { title: 'Canon', body: '~22,000 words, American and British English. TWL tournament words.\n\n"I flashcard the OED. IYKYK."' },
    junior: { title: 'Junior', body: 'Future mode for 3-5 letter gameplay.' },
  };

  /**
   * Validate custom words:
   * - Must be exactly 5 words
   * - Pattern: [4, 4, 5, 5, 6] letters
   * - All valid in selected dictionary
   * - All must be placeable on board
   */
  function validateCustomWords(): { ok: boolean; errors: string[] } {
    const errors: string[] = [];

    const filled = customWords.filter((w) => w.trim().length > 0);
    if (filled.length !== 5) {
      errors.push('Please enter all 5 words.');
      return { ok: false, errors };
    }

    const normalized = customWords.map(normalizeWord);
    for (let i = 0; i < 5; i++) {
      const expected = TARGET_LENGTHS[i];
      const actual = normalized[i].length;
      if (actual !== expected) {
        errors.push(`Word ${i + 1} must be ${expected} letters (got ${actual}).`);
      }
    }

    if (errors.length > 0) {
      return { ok: false, errors };
    }

    for (let i = 0; i < 5; i++) {
      const word = normalized[i];
      if (!isValidWord(word, dictionaryId)) {
        errors.push(`"${word}" not found in ${dictionaryId.toUpperCase()} dictionary.`);
      }
    }

    if (errors.length > 0) {
      return { ok: false, errors };
    }

    const placement = buildLocalPlacement(normalized);
    if (!placement.ok) {
      errors.push(`Words cannot be placed: ${placement.error}`);
      return { ok: false, errors };
    }

    return { ok: true, errors: [] };
  }

  function handleStart() {
    if (isValidating) return;
    setValidationErrors([]);
    setIsValidating(true);

    try {
      if (!supportsCurrentTargetPattern(dictionaryId)) {
        setValidationErrors(['This dictionary needs a different game mode pattern.']);
        setIsValidating(false);
        return;
      }
      const generateRandomWords = (baseSeed: number, label: string): string[] => {
        try {
          return generateTargetsFromSeed(baseSeed, dictionaryId, 5);
        } catch (error) {
          const detail = error instanceof Error ? ` ${error.message}` : '';
          throw new Error(`${label} words could not be generated right now. Please try again.${detail}`);
        }
      };

      let playerWords: string[];

      if (wordMode === 'custom') {
        const validation = validateCustomWords();
        if (!validation.ok) {
          setValidationErrors(validation.errors);
          setIsValidating(false);
          return;
        }
        playerWords = customWords.map(normalizeWord);
      } else {
        playerWords = generateRandomWords(createRandomSeed(), 'Player');
      }

      const botWords = generateRandomWords(createRandomSeed(Date.now() + 1000), 'Bot');

      const sessionId = createBotSession({
        difficulty,
        playerTargets: playerWords,
        botTargets: botWords,
        dictionaryId,
        playStyle,
      });

      navigation.navigate('Board', { mode: 'bot', sessionId });
    } catch (error) {
      setValidationErrors([error instanceof Error ? error.message : 'Unknown error']);
    } finally {
      setIsValidating(false);
    }
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.screen }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll}>

          {/* Header */}
          <View style={[styles.header, { borderColor: palette.border }]}>
            <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}>
              <Image
                source={require('../../assets/design/icons/CWMotifRed.png')}
                style={[styles.brandIcon, { tintColor: '#E7131A' }]}
                resizeMode="contain"
              />
            </Pressable>
            <Text style={[styles.headerTitle, { color: palette.title }]}>Duel</Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* Setup Card */}
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.cardTitle, { color: palette.title }]}>SETUP</Text>

            {/* Difficulty */}
            <View ref={difficultyRef} style={styles.settingBlock}>
              <View style={styles.rowLabelRow}>
                <Text style={[styles.rowLabel, { color: palette.label }]}>Difficulty</Text>
                <Text style={[styles.infoHint, { color: palette.body }]}>{'\u24D8'}</Text>
              </View>
              <View style={[styles.dictPicker, { borderColor: palette.border }]}>
                {(['easy', 'normal', 'hard'] as const).map((level) => (
                  <Pressable
                    key={level}
                    onPress={() => setDifficulty(level)}
                    onLongPress={() => showTooltip(difficultyRef, level === 'easy' ? 'Pupil' : level === 'normal' ? 'Fencer' : 'Duelist', DIFFICULTY_INFO[level])}
                    delayLongPress={400}
                    style={[
                      styles.dictOption,
                      { backgroundColor: palette.segmentBg },
                      difficulty === level && styles.dictOptionActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dictOptionText,
                        { color: darkModeEnabled ? '#f0f0f0' : '#333' },
                        difficulty === level && styles.dictOptionTextActive,
                      ]}
                    >
                      {level === 'easy' ? 'Pupil' : level === 'normal' ? 'Fencer' : 'Duelist'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={[styles.divider, { borderColor: palette.border }]} />

            {/* Play Style */}
            <View ref={playStyleRef} style={styles.settingBlock}>
              <View style={styles.rowLabelRow}>
                <Text style={[styles.rowLabel, { color: palette.label }]}>Play Style</Text>
                <Text style={[styles.infoHint, { color: palette.body }]}>{'\u24D8'}</Text>
              </View>
              <View style={[styles.dictPicker, { borderColor: palette.border }]}>
                {([
                  { value: 'race' as const, label: 'Simultaneous' },
                  { value: 'turns' as const, label: 'Turn-Based' },
                ]).map(({ value, label }) => (
                  <Pressable
                    key={value}
                    onPress={() => setPlayStyle(value)}
                    onLongPress={() => showTooltip(playStyleRef, label, PLAY_STYLE_INFO[value])}
                    delayLongPress={400}
                    style={[
                      styles.dictOption,
                      { backgroundColor: palette.segmentBg },
                      playStyle === value && styles.dictOptionActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dictOptionText,
                        { color: darkModeEnabled ? '#f0f0f0' : '#333' },
                        playStyle === value && styles.dictOptionTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={[styles.divider, { borderColor: palette.border }]} />

            {/* Bot Words */}
            <View ref={botWordsRef} style={styles.settingBlock}>
              <View style={styles.rowLabelRow}>
                <Text style={[styles.rowLabel, { color: palette.label }]}>Target Words</Text>
                <Text style={[styles.infoHint, { color: palette.body }]}>{'\u24D8'}</Text>
              </View>
              <View style={[styles.dictPicker, { borderColor: palette.border }]}>
                {([
                  { value: 'random' as const, label: 'Random' },
                  { value: 'custom' as const, label: 'Custom' },
                ]).map(({ value, label }) => (
                  <Pressable
                    key={value}
                    onPress={() => setWordMode(value)}
                    onLongPress={() => showTooltip(botWordsRef, label, value === 'random' ? 'Generate random words for the player to solve.' : 'Choose your own 5 words for the player to solve.')}
                    delayLongPress={400}
                    style={[
                      styles.dictOption,
                      { backgroundColor: palette.segmentBg },
                      wordMode === value && styles.dictOptionActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dictOptionText,
                        { color: darkModeEnabled ? '#f0f0f0' : '#333' },
                        wordMode === value && styles.dictOptionTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {wordMode === 'custom' && (
                <View style={{ marginTop: 4 }}>
                  {customWords.map((word, idx) => (
                    <View key={idx}>
                      <TextInput
                        value={word}
                        onChangeText={(text) => {
                          const next = [...customWords];
                          next[idx] = text;
                          setCustomWords(next);
                        }}
                        style={[
                          styles.inputUnderline,
                          { borderColor: palette.border, color: palette.inputText },
                        ]}
                        placeholder={`${TARGET_LENGTHS[idx]} letter word`}
                        placeholderTextColor={palette.inputPlaceholder}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        maxLength={TARGET_LENGTHS[idx]}
                      />
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={[styles.divider, { borderColor: palette.border }]} />

            {/* Dictionary */}
            <View ref={dictRef} style={styles.settingBlock}>
              <View style={styles.rowLabelRow}>
                <Text style={[styles.rowLabel, { color: palette.label }]}>Dictionary</Text>
                <Text style={[styles.infoHint, { color: palette.body }]}>{'\u24D8'}</Text>
              </View>
              <View style={[styles.dictPicker, { borderColor: palette.border }]}>
                {getVisibleDictionaryOptions().map((opt) => (
                  <Pressable
                    key={opt}
                    onPress={() => setDictionaryId(opt)}
                    onLongPress={() => showTooltip(dictRef, DICT_INFO[opt].title, DICT_INFO[opt].body)}
                    delayLongPress={400}
                    style={[
                      styles.dictOption,
                      { backgroundColor: palette.segmentBg },
                      dictionaryId === opt && styles.dictOptionActive,
                    ]}
                    >
                      <Text
                        style={[
                          styles.dictOptionText,
                          { color: darkModeEnabled ? '#f0f0f0' : '#333' },
                          dictionaryId === opt && styles.dictOptionTextActive,
                        ]}
                      >
                      {getDictionaryMeta(opt).label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <View style={styles.errorBanner}>
              <View style={{ flex: 1 }}>
                {validationErrors.map((err, idx) => (
                  <Text key={idx} style={styles.errorText}>
                    • {err}
                  </Text>
                ))}
              </View>
              <Pressable onPress={() => setValidationErrors([])} style={styles.errorDismiss}>
                <Text style={styles.errorDismissText}>✕</Text>
              </Pressable>
            </View>
          )}

          {/* Play Button */}
          <Pressable
            onPress={handleStart}
            style={({ pressed }) => [
              styles.buttonPrimary,
              pressed && { opacity: 0.9 },
              isValidating && { opacity: 0.6 },
            ]}
            disabled={isValidating}
          >
            <Text style={styles.buttonPrimaryText}>
              {isValidating ? 'Starting...' : 'En Garde!'}
            </Text>
          </Pressable>

        </ScrollView>
      </KeyboardAvoidingView>
      <InfoTooltip
        visible={activeTooltip !== null}
        title={activeTooltip?.title ?? ''}
        body={activeTooltip?.body ?? ''}
        anchorRect={activeTooltip?.rect ?? null}
        onDismiss={() => setActiveTooltip(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flexGrow: 1, padding: 16, gap: 14, paddingBottom: 32 },
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
    padding: 16,
    gap: 16,
    borderWidth: 1,
  },
  cardTitle: {
    fontFamily: t.typography.displayFamily,
    fontSize: 12,
    letterSpacing: 1,
  },
  settingBlock: {
    gap: 8,
  },
  divider: {
    borderBottomWidth: 1,
  },
  rowLabel: {
    fontFamily: t.typography.displayFamily,
    fontSize: 14,
  },
  rowLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoHint: {
    fontSize: 12,
    opacity: 0.45,
  },
  customWordsLabel: {
    fontFamily: t.typography.bodyFamily,
    fontSize: 12,
  },
  dictPicker: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 4,
    overflow: 'hidden',
    width: '100%',
  },
  dictOption: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 10,
  },
  dictOptionActive: {
    backgroundColor: '#E7131A',
  },
  dictOptionText: {
    fontFamily: t.typography.displayFamily,
    fontSize: 12,
  },
  dictOptionTextActive: {
    color: '#fff',
  },
  input: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontFamily: t.typography.bodyFamily,
    fontSize: 15,
  },
  inputUnderline: {
    borderBottomWidth: 1,
    paddingVertical: 10,
    fontFamily: t.typography.bodyFamily,
    fontSize: 15,
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
  errorText: {
    fontFamily: t.typography.bodyFamily,
    fontSize: 12,
    color: '#b00000',
    marginBottom: 4,
  },
  errorDismiss: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  errorDismissText: {
    fontFamily: t.typography.displayFamily,
    fontSize: 16,
    color: '#b00000',
  },
  buttonPrimary: {
    backgroundColor: '#E7131A',
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonPrimaryText: {
    fontFamily: t.typography.displayFamily,
    fontSize: 16,
    color: '#fff',
  },
});
