import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { DESIGN_TOKEN_SETS } from '@src/theme/designTokens';
import { useFeedbackColors } from '@src/theme/feedbackColors';
import { useTilePalette } from '@src/theme/tilePalette';
import type { KeyboardLetterState } from '@src/lib/keyboardLetterStates';
import useUIStore from '@stores/uiStore';

const tAtlantic = DESIGN_TOKEN_SETS.atlantic;

// Default: ⌫ on right end of row 2, ? on bottom-left (low-traffic).
// swapBackspaceHelp: ? on row 2 right, ⌫ on bottom-left — for users who keep
// accidentally deleting when reaching for submit.
const ROWS_DEFAULT: string[][] = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', '⌫'],
  ['?', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '↵'],
];
const ROWS_SWAPPED: string[][] = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', '?'],
  ['⌫', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '↵'],
];

const IS_LETTER = /^[A-Z]$/;

// GUESS_LEGEND and KEY_LEGEND are now built dynamically inside the component
// using the active feedback palette from useFeedbackColors().

interface Props {
  onKey: (letter: string) => void;
  onBackspace: () => void;
  onSubmit: () => void;
  letterStates: Record<string, KeyboardLetterState>;
  disabled?: boolean;
}

export default function GameKeyboard({ onKey, onBackspace, onSubmit, letterStates, disabled }: Props) {
  const feedbackColors = useFeedbackColors();
  const tilePalette = useTilePalette();
  const darkMode = useUIStore((s) => s.darkModeEnabled);
  const swapBackspaceHelp = useUIStore((s) => s.swapBackspaceHelp);
  const ROWS = swapBackspaceHelp ? ROWS_SWAPPED : ROWS_DEFAULT;
  const [legendVisible, setLegendVisible] = useState(false);
  const { height: windowHeight } = useWindowDimensions();

  // Scale key height for small screens (S9 = 740dp). Base 42px at 800+dp,
  // shrinks proportionally down to ~34px on 640dp screens.
  const keyHeight = Math.round(Math.min(42, Math.max(30, windowHeight * 0.054)));
  // Scale container padding: 6–10px top, 4–8px bottom, 4–6px gap based on screen height.
  const kbPadTop = Math.round(Math.min(10, Math.max(4, windowHeight * 0.008)));
  const kbPadBottom = Math.round(Math.min(8, Math.max(2, windowHeight * 0.006)));
  const kbGap = Math.round(Math.min(6, Math.max(3, windowHeight * 0.005)));

  // Board tile colors use the active tile palette.
  const GUESS_LEGEND = [
    { ...tilePalette.correct,     border: undefined,   label: 'Correct letter, correct spot' },
    { ...tilePalette.wrongSpot,   border: undefined,   label: 'In this word, wrong spot' },
    { ...tilePalette.notInWord,   border: undefined,   label: 'Not in this word, in the puzzle' },
    { ...tilePalette.notInPuzzle, border: '#D3D3D6',   label: 'Not in the puzzle' },
  ];

  const KEY_LEGEND = [
    { bg: '#fff', border: '#e2e2e2', label: 'Still in play', textColor: '#1c1b21' },
    { bg: feedbackColors.keyboardAbsent.bg, border: '#999', label: 'Not in this puzzle', textColor: '#fff' },
  ];

  const handlePress = (key: string) => {
    if (key === '⌫') onBackspace();
    else if (key === '↵') onSubmit();
    else if (key === '?') setLegendVisible(true);
    else onKey(key);
  };

  return (
    <>
      <View style={[styles.container, { paddingTop: kbPadTop, paddingBottom: kbPadBottom, gap: kbGap }, darkMode && { backgroundColor: '#1b1b1b' }]}>
        {ROWS.map((row, rowIdx) => (
          <View key={rowIdx} style={styles.row}>
            {row.map((key) => {
              const state = IS_LETTER.test(key) ? (letterStates[key] ?? 'white') : undefined;
              const isAction = key === '⌫' || key === '↵';
              const isLegend = key === '?';
              return (
                <Pressable
                  key={key}
                  onPress={() => handlePress(key)}
                  disabled={disabled && !isLegend}
                  style={({ pressed }) => [
                    styles.key,
                    { height: keyHeight },
                    darkMode && { backgroundColor: '#2a2a2a', borderColor: '#3a3a3a' },
                    isAction && styles.actionKey,
                    darkMode && isAction && { backgroundColor: '#232323', borderColor: '#3a3a3a' },
                    isLegend && styles.legendKey,
                    darkMode && isLegend && { backgroundColor: '#232323', borderColor: '#3a3a3a' },
                    state === 'grey' && { backgroundColor: feedbackColors.keyboardAbsent.bg, borderColor: feedbackColors.keyboardAbsent.bg },
                    pressed && styles.keyPressed,
                    disabled && !isLegend && styles.keyDisabled,
                  ]}
                >
                  <Text style={[
                    styles.keyText,
                    darkMode && { color: '#f2f2f2' },
                    state === 'grey' && styles.keyTextLight,
                    isAction && styles.actionKeyText,
                    darkMode && isAction && { color: '#ccc' },
                    isLegend && styles.legendKeyText,
                    darkMode && isLegend && { color: '#999' },
                  ]}>
                    {key}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      {/* ── Color legend modal ─────────────────────────────── */}
      <Modal
        visible={legendVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLegendVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setLegendVisible(false)}>
          <Pressable style={[styles.legendCard, darkMode && { backgroundColor: '#1b1b1b' }]} onPress={() => {}}>
            <Text style={[styles.legendTitle, darkMode && { color: '#f2f2f2' }]}>Color Guide</Text>

            <Text style={styles.legendSection}>Board tiles</Text>
            {GUESS_LEGEND.map(({ bg, letter: textColor, border, label }) => (
              <View key={label} style={styles.legendRow}>
                <View style={[styles.legendSwatch, { backgroundColor: bg, borderWidth: border ? 1 : 0, borderColor: border }]}>
                  <Text style={[styles.legendSwatchText, { color: textColor }]}>A</Text>
                </View>
                <Text style={[styles.legendLabel, darkMode && { color: '#ccc' }]}>{label}</Text>
              </View>
            ))}

            <View style={[styles.legendDivider, darkMode && { backgroundColor: '#333' }]} />

            <Text style={styles.legendSection}>Cross squares</Text>
            <View style={styles.legendRow}>
              <View style={[styles.legendSwatch, { backgroundColor: tilePalette.wrongSpot.bg }]}>
                <Text style={[styles.legendSwatchText, { color: tilePalette.wrongSpot.letter }]}>A</Text>
              </View>
              <Text style={[styles.legendLabel, darkMode && { color: '#ccc' }]}>In either or both of these words</Text>
            </View>
            <View style={styles.legendRow}>
              <View style={[styles.legendSwatch, { backgroundColor: tilePalette.notInWord.bg }]}>
                <Text style={[styles.legendSwatchText, { color: tilePalette.notInWord.letter }]}>A</Text>
              </View>
              <Text style={[styles.legendLabel, darkMode && { color: '#ccc' }]}>Not in either word, but elsewhere in the puzzle</Text>
            </View>

            <View style={[styles.legendDivider, darkMode && { backgroundColor: '#333' }]} />

            <Text style={styles.legendSection}>Keyboard keys</Text>
            {KEY_LEGEND.map(({ bg, border, label, textColor }) => (
              <View key={label} style={styles.legendRow}>
                <View style={[styles.legendKeyChip, { backgroundColor: bg, borderColor: border }]}>
                  <Text style={[styles.legendKeyChipText, { color: textColor }]}>A</Text>
                </View>
                <Text style={[styles.legendLabel, darkMode && { color: '#ccc' }]}>{label}</Text>
              </View>
            ))}
            <Pressable onPress={() => setLegendVisible(false)} style={styles.legendClose}>
              <Text style={styles.legendCloseText}>Got it</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    paddingHorizontal: 6,
    // paddingTop, paddingBottom, gap are applied dynamically (scale with screen height)
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  key: {
    flex: 1,
    maxWidth: 36,
    // height is applied dynamically via keyHeight (scales with screen size)
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionKey: {
    maxWidth: 48,
    backgroundColor: '#f8f8f8',
    borderColor: '#e2e2e2',
  },
  legendKey: {
    maxWidth: 48,
    backgroundColor: '#f8f8f8',
    borderColor: '#e2e2e2',
  },
  keyPressed: {
    opacity: 0.5,
  },
  keyDisabled: {
    opacity: 0.4,
  },
  keyText: {
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 13,
    letterSpacing: 1,
    color: '#1c1b21',
  },
  keyTextLight: {
    color: '#ffffff',
  },
  actionKeyText: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 16,
    letterSpacing: 0,
    color: '#444',
  },
  legendKeyText: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 16,
    letterSpacing: 0,
    color: '#888',
  },

  // ── Legend modal ──────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    paddingBottom: 160, // floats just above the keyboard area
  },
  legendCard: {
    marginHorizontal: 20,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  legendTitle: {
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 16,
    color: '#1c1b21',
    marginBottom: 2,
  },
  legendSection: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 11,
    fontWeight: '700',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: -4,
  },
  legendDivider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 2,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  legendSwatch: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendSwatchText: {
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 14,
    color: '#fff',
  },
  legendLabel: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 14,
    color: '#444',
    flex: 1,
  },
  legendKeyChip: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendKeyChipText: {
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 14,
  },
  legendClose: {
    alignSelf: 'center',
    marginTop: 4,
    paddingHorizontal: 28,
    paddingVertical: 10,
    backgroundColor: '#E7131A',
    borderRadius: 8,
  },
  legendCloseText: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});
