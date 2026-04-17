/**
 * src/screens/SettingsScreen.tsx
 * ---------------------------------------------
 * Atlantic-styled settings screen. Preserves existing logic: username (userStore),
 * apiKey (sessionStore). Layout matches AtlanticSettingsPreview.
 */

import React, { useCallback, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { DESIGN_TOKEN_SETS } from '@src/theme/designTokens';
import { RootStackParamList } from '@src/navigation/AppNavigator';
import { isServerFunctionsEnabled } from '@src/flags';
import { getDictionaryMeta, getVisibleDictionaryOptions } from '@src/dictionary/dictionaryAdapter';
import useSessionStore from '@stores/sessionStore';
import useUserStore from '@stores/userStore';
import useUIStore, { type DictionaryPreference } from '@stores/uiStore';
import InfoTooltip, { type AnchorRect } from '@components/InfoTooltip';
import PalettePickerModal from '@components/PalettePickerModal';
import { getTilePaletteOptionById, getTilePalettePreviewEntries } from '@src/theme/tilePalette';

const t = DESIGN_TOKEN_SETS.atlantic;

const DICTIONARY_INFO: Record<DictionaryPreference, { title: string; body: string }> = {
  core: { title: 'Casual', body: '~4,500 common English words.\n\n"I shout answers at the TV during Wheel of Fortune!"' },
  standard: { title: 'Medium', body: '~12,000 words including literary vocabulary.\n\n"I regularly beat Ken Jennings at Charades."' },
  advanced: { title: 'Sharp', body: 'Higher-difficulty dictionary.\n\n"People believe me when I say I read Ulysses."' },
  canon: { title: 'Canon', body: 'Top dictionary tier used for guess validation.\n\n"I keep a thesaurus by the bed for fun."' },
  twl: { title: 'Canon', body: '~22,000 words, American and British English. TWL tournament words.\n\n"I flashcard the OED. IYKYK."' },
  junior: { title: 'Junior', body: 'Future mode for 3-5 letter gameplay. Not available in current mode.' },
};

type SettingsNav = NativeStackNavigationProp<RootStackParamList, 'Settings'>;
type SettingsPalette = {
  screen: string;
  card: string;
  border: string;
  title: string;
  label: string;
  body: string;
  inputBg: string;
  inputText: string;
  inputPlaceholder: string;
  rowValue: string;
};

function Header({ onBack, palette }: { onBack: () => void; palette: SettingsPalette }): React.JSX.Element {
  return (
    <View style={[styles.header, { borderColor: palette.border }]}>
      <Pressable onPress={onBack} style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}>
        <Image
          source={require('../../assets/design/icons/CWMotifRed.png')}
          style={[styles.brandIcon, { tintColor: '#E7131A' }]}
          resizeMode="contain"
        />
      </Pressable>
      <Text style={[styles.headerTitle, { color: palette.title }]}>Settings</Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

function Card({ title, children, palette }: { title?: string; children: React.ReactNode; palette: SettingsPalette }): React.JSX.Element {
  return (
    <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
      {title ? <Text style={[styles.cardTitle, { color: palette.title }]}>{title}</Text> : null}
      <View style={{ gap: 6 }}>{children}</View>
    </View>
  );
}

function InfoRow({ label, value, palette }: { label: string; value: string; palette: SettingsPalette }): React.JSX.Element {
  return (
    <View style={[styles.infoRow, { borderColor: palette.border }]}>
      <Text style={[styles.rowLabel, { color: palette.label }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: palette.rowValue }]}>{value}</Text>
    </View>
  );
}

export default function SettingsScreen(): React.JSX.Element {
  const navigation = useNavigation<SettingsNav>();
  const serverEnabled = isServerFunctionsEnabled();
  const username = useUserStore((state) => state.username);
  const setUsername = useUserStore((state) => state.setUsername);
  const apiKey = useSessionStore((state) => state.apiKey);
  const setApiKey = useSessionStore((state) => state.setApiKey);
  const botBanterEnabled = useUIStore((state) => state.botBanterEnabled);
  const setBotBanterEnabled = useUIStore((state) => state.setBotBanterEnabled);
  const darkModeEnabled = useUIStore((state) => state.darkModeEnabled);
  const setDarkModeEnabled = useUIStore((state) => state.setDarkModeEnabled);
  const dictionary = useUIStore((state) => state.dictionary);
  const setDictionary = useUIStore((state) => state.setDictionary);
  const alphabetShowBlueCounts = useUIStore((state) => state.alphabetShowBlueCounts);
  const setAlphabetShowBlueCounts = useUIStore((state) => state.setAlphabetShowBlueCounts);
  const showBlueTicker = useUIStore((state) => state.showBlueTicker);
  const setShowBlueTicker = useUIStore((state) => state.setShowBlueTicker);
  const setColorblindMode = useUIStore((state) => state.setColorblindMode);
  const swapBackspaceHelp = useUIStore((state) => state.swapBackspaceHelp);
  const setSwapBackspaceHelp = useUIStore((state) => state.setSwapBackspaceHelp);
  const colorScheme = useUIStore((state) => state.colorScheme);
  const setColorScheme = useUIStore((state) => state.setColorScheme);
  const activeTilePaletteOption = getTilePaletteOptionById(colorScheme);
  const activeTilePreviewEntries = getTilePalettePreviewEntries(colorScheme);
  const notInWordSwatchColor = activeTilePreviewEntries.find((entry) => entry.key === 'notInWord')?.bg ?? '#5A8A91';

  // Local state for preferences (no persistence yet).
  const [notifications, setNotifications] = useState(true);
  const [paletteModalVisible, setPaletteModalVisible] = useState(false);

  // Long-press tooltip state
  const [activeTooltip, setActiveTooltip] = useState<{ title: string; body: string; rect: AnchorRect } | null>(null);
  const showTooltip = useCallback((ref: React.RefObject<View | null>, title: string, body: string) => {
    ref.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) setActiveTooltip({ title, body, rect: { x, y, width, height } });
    });
  }, []);

  const isCompetitiveMode = !alphabetShowBlueCounts && !showBlueTicker;
  const applyCompetitiveMode = () => {
    setAlphabetShowBlueCounts(false);
    setShowBlueTicker(false);
  };

  // Refs for tooltip anchoring
  const botBanterRef = useRef<View>(null);
  const dictBlockRef = useRef<View>(null);
  const dictInfoRef = useRef<View>(null);
  const blueCountsRef = useRef<View>(null);
  const darkModeRef = useRef<View>(null);
  const notifRef = useRef<View>(null);
  const competitiveModeRef = useRef<View>(null);
  const swapBackspaceRef = useRef<View>(null);
  const colorSchemeBlockRef = useRef<View>(null);
  const colorSchemeInfoRef = useRef<View>(null);
  const blueTickerRef = useRef<View>(null);

  const switchTrack = { false: '#ccc', true: '#E7131A' } as const;
  const switchThumb = '#fff';
  const palette = darkModeEnabled
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
        rowValue: '#f2f2f2',
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
        rowValue: '#000',
      };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.screen }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Header onBack={() => navigation.goBack()} palette={palette} />

        {serverEnabled ? (
          <Card title="ACCOUNT" palette={palette}>
            <View style={{ gap: 8 }}>
              <Text style={[styles.blockLabel, { color: palette.title }]}>DISPLAY NAME</Text>
              <TextInput
                style={[styles.input, { backgroundColor: palette.inputBg, borderColor: palette.border, color: palette.inputText }]}
                placeholder="Your name"
                placeholderTextColor={palette.inputPlaceholder}
                value={username}
                onChangeText={setUsername}
              />
            </View>
            <View style={{ gap: 8 }}>
              <Text style={[styles.blockLabel, { color: palette.title }]}>API KEY</Text>
              <TextInput
                style={[styles.input, { backgroundColor: palette.inputBg, borderColor: palette.border, color: palette.inputText }]}
                placeholder="Your API key"
                placeholderTextColor={palette.inputPlaceholder}
                value={apiKey}
                onChangeText={setApiKey}
                secureTextEntry
              />
              <Text style={[styles.helper, { color: palette.body }]}>Required for online multiplayer features</Text>
            </View>
          </Card>
        ) : null}

        <Card palette={palette}>
          {/* Dictionary — top */}
          <View ref={dictBlockRef} style={styles.dictionaryBlock}>
            <View style={styles.rowLabelRow}>
              <Text style={[styles.rowLabel, { color: palette.label }]}>Dictionary</Text>
              <Pressable
                ref={dictInfoRef}
                onPress={() => showTooltip(dictInfoRef, 'Dictionary', 'Long press on each dictionary option for a description.')}
                onLongPress={() => showTooltip(dictInfoRef, 'Dictionary', 'Long press on each dictionary option for a description.')}
                hitSlop={8}
              >
                <Text style={[styles.infoHint, { color: palette.body }]}>{'\u24D8'}</Text>
              </Pressable>
            </View>
            <View style={[styles.dictPicker, { borderColor: palette.border }]}>
              {getVisibleDictionaryOptions().map((opt) => (
                <Pressable
                  key={opt}
                  onPress={() => setDictionary(opt as DictionaryPreference)}
                  onLongPress={() => showTooltip(dictBlockRef, DICTIONARY_INFO[opt].title, DICTIONARY_INFO[opt].body)}
                  delayLongPress={400}
                  style={[
                    styles.dictOption,
                    { backgroundColor: darkModeEnabled ? '#232323' : '#f5f5f5' },
                    dictionary === opt && styles.dictOptionActive,
                  ]}
                  >
                    <Text
                      style={[
                        styles.dictOptionText,
                        { color: darkModeEnabled ? '#f0f0f0' : '#333' },
                        dictionary === opt && styles.dictOptionTextActive,
                      ]}
                    >
                    {getDictionaryMeta(opt).label}
                    </Text>
                </Pressable>
              ))}
            </View>
          </View>
          {/* Color Scheme */}
          <View ref={colorSchemeBlockRef} style={styles.dictionaryBlock}>
            <View style={styles.rowLabelRow}>
              <Text style={[styles.rowLabel, { color: palette.label }]}>Color Scheme</Text>
              <Pressable
                ref={colorSchemeInfoRef}
                onPress={() => showTooltip(colorSchemeInfoRef, 'Color Scheme', 'Long press on each option for a description.')}
                onLongPress={() => showTooltip(colorSchemeInfoRef, 'Color Scheme', 'Long press on each option for a description.')}
                hitSlop={8}
              >
                <Text style={[styles.infoHint, { color: palette.body }]}>{'\u24D8'}</Text>
              </Pressable>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Choose color scheme. Current palette: ${activeTilePaletteOption.title}`}
              onPress={() => setPaletteModalVisible(true)}
              onLongPress={() => showTooltip(colorSchemeBlockRef, activeTilePaletteOption.title, activeTilePaletteOption.description)}
              delayLongPress={400}
              style={[
                styles.paletteSummaryButton,
                {
                  backgroundColor: darkModeEnabled ? '#232323' : '#f5f5f5',
                  borderColor: palette.border,
                },
              ]}
            >
              <View style={styles.paletteSummaryLeft}>
                <Text style={[styles.paletteSummaryLabel, { color: palette.label }]}>Active Palette</Text>
                <Text style={[styles.paletteSummaryValue, { color: palette.title }]}>{activeTilePaletteOption.shortLabel}</Text>
              </View>
              <View style={styles.paletteSummaryPreview}>
                {activeTilePreviewEntries.map((entry) => (
                  <View key={entry.key} style={styles.palettePreviewWrap}>
                    <View style={[styles.palettePreviewSwatch, { backgroundColor: entry.bg }]}>
                      <Text style={[styles.palettePreviewLetter, { color: entry.letter }]}>A</Text>
                    </View>
                  </View>
                ))}
              </View>
              <View style={styles.paletteSummaryActionButton}>
                <Text style={styles.paletteSummaryActionText}>Choose</Text>
              </View>
            </Pressable>
          </View>
          {/* Dark Mode — second */}
          <Pressable ref={darkModeRef} onLongPress={() => showTooltip(darkModeRef, 'Dark Mode', 'Use darker surfaces across the UI.')} delayLongPress={400} style={styles.toggleRow}>
            <View style={styles.rowLabelWrap}>
              <View style={styles.rowLabelRow}>
                <Text style={[styles.rowLabel, { color: palette.label }]}>Dark Mode</Text>
                <Text style={[styles.infoHint, { color: palette.body }]}>{'\u24D8'}</Text>
              </View>
            </View>
            <Switch value={darkModeEnabled} onValueChange={setDarkModeEnabled} trackColor={switchTrack} thumbColor={switchThumb} />
          </Pressable>
          <Pressable ref={botBanterRef} onLongPress={() => showTooltip(botBanterRef, 'Repartee', 'Show Taunt and Turn messages.')} delayLongPress={400} style={styles.toggleRow}>
            <View style={styles.rowLabelWrap}>
              <View style={styles.rowLabelRow}>
                <Text style={[styles.rowLabel, { color: palette.label }]}>Repartee</Text>
                <Text style={[styles.infoHint, { color: palette.body }]}>{'\u24D8'}</Text>
              </View>
            </View>
            <Switch value={botBanterEnabled} onValueChange={setBotBanterEnabled} trackColor={switchTrack} thumbColor={switchThumb} />
          </Pressable>
          {/* Alphabetical */}
          <Pressable ref={blueTickerRef} onLongPress={() => showTooltip(blueTickerRef, '{{notInWord}} Letter Tracker', 'Show the {{notInWord}} letter rail above the board — a summary of which letters are still needed in unsolved words. Like pencil marks in Sudoku.')} delayLongPress={400} style={styles.toggleRow}>
            <View style={styles.rowLabelWrap}>
              <View style={styles.rowLabelRow}>
                <Text style={[styles.rowLabel, { color: palette.label }]}>
                  <Text style={[styles.inlineSwatch, { color: notInWordSwatchColor }]}>{'\u25A0'}</Text>
                  {' '}Letter Tracker
                </Text>
                <Text style={[styles.infoHint, { color: palette.body }]}>{'\u24D8'}</Text>
              </View>
            </View>
            <Switch value={showBlueTicker} onValueChange={setShowBlueTicker} trackColor={switchTrack} thumbColor={switchThumb} />
          </Pressable>
          <Pressable ref={blueCountsRef} onLongPress={() => showTooltip(blueCountsRef, '{{notInWord}} Letter Counts', 'Show a count badge on each {{notInWord}} letter tile indicating how many unsolved words still contain that letter.')} delayLongPress={400} style={styles.toggleRow}>
            <View style={styles.rowLabelWrap}>
              <View style={styles.rowLabelRow}>
                <Text style={[styles.rowLabel, { color: palette.label }]}>
                  <Text style={[styles.inlineSwatch, { color: notInWordSwatchColor }]}>{'\u25A0'}</Text>
                  {' '}Letter Counts
                </Text>
                <Text style={[styles.infoHint, { color: palette.body }]}>{'\u24D8'}</Text>
              </View>
            </View>
            <Switch value={alphabetShowBlueCounts} onValueChange={setAlphabetShowBlueCounts} trackColor={switchTrack} thumbColor={switchThumb} />
          </Pressable>
          <Pressable ref={swapBackspaceRef} onLongPress={() => showTooltip(swapBackspaceRef, 'Swap Delete & Help Keys', 'Moves ⌫ to the bottom-left and ? to row 2 — useful if you keep accidentally deleting when reaching for Submit.')} delayLongPress={400} style={styles.toggleRow}>
            <View style={styles.rowLabelWrap}>
              <View style={styles.rowLabelRow}>
                <Text style={[styles.rowLabel, { color: palette.label }]}>Swap Delete & Help Keys</Text>
                <Text style={[styles.infoHint, { color: palette.body }]}>{'\u24D8'}</Text>
              </View>
            </View>
            <Switch value={swapBackspaceHelp} onValueChange={setSwapBackspaceHelp} trackColor={switchTrack} thumbColor={switchThumb} />
          </Pressable>
          {serverEnabled ? (
            <Pressable ref={notifRef} onLongPress={() => showTooltip(notifRef, 'Notifications', 'Receive game updates and alerts.')} delayLongPress={400} style={styles.toggleRow}>
              <View style={styles.rowLabelWrap}>
                <View style={styles.rowLabelRow}>
                  <Text style={[styles.rowLabel, { color: palette.label }]}>Notifications</Text>
                  <Text style={[styles.infoHint, { color: palette.body }]}>{'\u24D8'}</Text>
                </View>
              </View>
              <Switch value={notifications} onValueChange={setNotifications} trackColor={switchTrack} thumbColor={switchThumb} />
            </Pressable>
          ) : null}
          <Pressable ref={competitiveModeRef} onLongPress={() => showTooltip(competitiveModeRef, 'Competitive Mode', 'Turns off the {{notInWord}} letter tracker and {{notInWord}} counts for a cleaner competitive board.')} delayLongPress={400} style={styles.toggleRow}>
            <View style={styles.rowLabelWrap}>
              <View style={styles.rowLabelRow}>
                <Text style={[styles.rowLabel, { color: palette.label }]}>Competitive Mode</Text>
                <Text style={[styles.infoHint, { color: palette.body }]}>{'\u24D8'}</Text>
              </View>
            </View>
            <Switch value={isCompetitiveMode} onValueChange={(v) => { if (v) applyCompetitiveMode(); }} trackColor={switchTrack} thumbColor={switchThumb} />
          </Pressable>
        </Card>

        <Pressable
          onPress={() => navigation.navigate('Jotts')}
          style={({ pressed }) => [
            styles.jottsCard,
            { backgroundColor: palette.card, borderColor: palette.border },
            pressed && { opacity: 0.85 },
          ]}
        >
          <View style={styles.jottsCardAccent} />
          <View style={styles.jottsCardContent}>
            <Text style={[styles.jottsCardTitle, { color: palette.title }]}>JOTTS</Text>
            <Text style={[styles.jottsCardBody, { color: palette.body }]}>Manage your favorite 5-word sets</Text>
          </View>
          <Text style={styles.jottsCardArrow}>›</Text>
        </Pressable>

        <Card palette={palette}>
          <InfoRow label="Version" value="Beta 2.1" palette={palette} />
          <InfoRow label="Publisher" value="Artisan Beef Designs" palette={palette} />
          <InfoRow label="Year" value="2026" palette={palette} />
        </Card>
      </ScrollView>
      <InfoTooltip
        visible={activeTooltip !== null}
        title={activeTooltip?.title ?? ''}
        body={activeTooltip?.body ?? ''}
        anchorRect={activeTooltip?.rect ?? null}
        onDismiss={() => setActiveTooltip(null)}
      />
      <PalettePickerModal
        visible={paletteModalVisible}
        selectedSchemeId={colorScheme}
        onCancel={() => setPaletteModalVisible(false)}
        onConfirm={(schemeId) => {
          setColorScheme(schemeId);
          setColorblindMode(schemeId === 'colorblind' ? 'universal' : 'none');
          setPaletteModalVisible(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fdfdfd' },
  scroll: { flexGrow: 1, padding: 16, gap: 14 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderColor: '#e0e0e0',
  },
  brandIcon: {
    width: 40,
    height: 40,
  },
  headerTitle: {
    fontFamily: t.typography.displayFamily,
    fontSize: 18,
    color: '#000',
  },
  headerSpacer: { width: 24 },
  card: {
    backgroundColor: '#fff',
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: '#e6e6e6',
  },
  cardTitle: {
    fontFamily: t.typography.displayFamily,
    fontSize: 12,
    letterSpacing: 1,
    color: '#000',
  },
  blockLabel: {
    fontFamily: t.typography.displayFamily,
    fontSize: 12,
    letterSpacing: 1,
    color: '#000',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d7d7d7',
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontFamily: t.typography.bodyFamily,
    fontSize: 15,
    color: '#333',
  },
  helper: {
    fontSize: 12,
    color: '#777',
    fontFamily: t.typography.bodyFamily,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabelWrap: {
    flex: 1,
    marginRight: 12,
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
  dictionaryBlock: {
    gap: 8,
  },
  rowLabel: {
    fontFamily: t.typography.displayFamily,
    fontSize: 14,
    color: '#000',
  },
  inlineSwatch: {
    fontSize: 15,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderColor: '#ececec',
  },
  rowValue: {
    fontFamily: t.typography.bodyFamily,
    fontSize: 14,
    color: '#000',
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
    color: '#333',
  },
  dictOptionTextActive: {
    color: '#fff',
  },
  paletteSummaryButton: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  paletteSummaryLeft: {
    width: 74,
    gap: 4,
  },
  paletteSummaryLabel: {
    fontFamily: t.typography.bodyFamily,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  paletteSummaryValue: {
    fontFamily: t.typography.displayFamily,
    fontSize: 14,
  },
  paletteSummaryPreview: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  palettePreviewWrap: {
    flex: 1,
    alignItems: 'center',
  },
  palettePreviewSwatch: {
    width: 22,
    height: 22,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  palettePreviewLetter: {
    fontFamily: t.typography.displayFamily,
    fontSize: 11,
  },
  paletteSummaryActionButton: {
    backgroundColor: '#E7131A',
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paletteSummaryActionText: {
    fontFamily: t.typography.displayFamily,
    fontSize: 14,
    color: '#fff',
  },
  jottsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  jottsCardAccent: {
    width: 4,
    alignSelf: 'stretch',
    backgroundColor: '#E7131A',
  },
  jottsCardContent: {
    flex: 1,
    padding: 16,
    gap: 4,
  },
  jottsCardTitle: {
    fontFamily: t.typography.displayFamily,
    fontSize: 16,
    letterSpacing: 1,
  },
  jottsCardBody: {
    fontFamily: t.typography.bodyFamily,
    fontSize: 13,
  },
  jottsCardArrow: {
    fontSize: 28,
    color: '#E7131A',
    paddingRight: 16,
    lineHeight: 32,
  },
});
