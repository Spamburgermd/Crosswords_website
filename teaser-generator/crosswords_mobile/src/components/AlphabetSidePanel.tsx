/**
 * AlphabetSidePanel
 * ------------------
 * Slide-in dev rail that shows discovered blue letters, a compact
 * color-code legend, and optional UI perf timings.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DESIGN_TOKEN_SETS } from '@src/theme/designTokens';
import colors from '@src/theme/colors';
import { useFeedbackColors } from '@src/theme/feedbackColors';
import { buildDevUiPerfLines, type DevUiPerfMetrics } from '@src/lib/devUiPerf';
import useUIStore from '@stores/uiStore';

type Props = {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  motifRed: string;
  motifBlue: string;
  /** Blue/discovered letters (unique, sorted). */
  blueLetters: string[];
  /** Blue letter entries with remaining counts. */
  blueLetterCounts?: Array<[string, number]>;
  devTargetWords?: string[];
  devUiPerf?: DevUiPerfMetrics | null;
  isDevUiPerfLogging?: boolean;
  devUiPerfLogCount?: number;
  onToggleDevUiPerfLogging?: () => void;
  onCopyDevUiPerfLog?: () => void;
  onClearDevUiPerfLog?: () => void;
};

const PANEL_WIDTH = 260;
const TAB_WIDTH = 24;
const TAB_HEIGHT = 56;
const tAtlantic = DESIGN_TOKEN_SETS.atlantic;

export default function AlphabetSidePanel({
  isOpen,
  onOpen,
  onClose,
  motifRed,
  motifBlue,
  blueLetters,
  blueLetterCounts,
  devTargetWords,
  devUiPerf,
  isDevUiPerfLogging = false,
  devUiPerfLogCount = 0,
  onToggleDevUiPerfLogging,
  onCopyDevUiPerfLog,
  onClearDevUiPerfLog,
}: Props): React.ReactElement {
  const insets = useSafeAreaInsets();
  const feedbackColors = useFeedbackColors();
  const darkModeEnabled = useUIStore((s) => s.darkModeEnabled);
  const alphabetShowBlueCounts = useUIStore((s) => s.alphabetShowBlueCounts);
  const panelBg = darkModeEnabled ? '#1b1b1b' : '#f8f8f8';
  const panelBorder = darkModeEnabled ? '#2d2d2d' : '#e0e0e0';
  const headingColor = darkModeEnabled ? '#f2f2f2' : '#222';
  const mutedTextColor = darkModeEnabled ? '#999' : '#666';
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(translateX, {
      toValue: isOpen ? -PANEL_WIDTH : 0,
      useNativeDriver: true,
      damping: 20,
      stiffness: 200,
    }).start();
  }, [isOpen, translateX]);

  const blueCountMap = useMemo(() => {
    if (!blueLetterCounts) return null;
    const m = new Map<string, number>();
    for (const [letter, count] of blueLetterCounts) {
      m.set(letter, count);
    }
    return m;
  }, [blueLetterCounts]);

  const perfLines = useMemo(
    () => (devUiPerf ? buildDevUiPerfLines(devUiPerf) : []),
    [devUiPerf],
  );

  const LEGEND_ITEMS: Array<{ color: string; example: string; label: string; strikethrough?: boolean }> = [
    { color: feedbackColors.G.bg, example: 'A', label: 'Correct spot' },
    { color: feedbackColors.Y.bg, example: 'B', label: 'Wrong spot' },
    { color: feedbackColors.B.bg, example: 'C', label: 'In puzzle' },
    { color: feedbackColors.R.bg, example: 'D', label: 'Not in puzzle' },
    { color: colors.muted, example: 'E', label: 'Guessed', strikethrough: true },
  ];

  const hasTargetWords = Boolean(devTargetWords && devTargetWords.length > 0);
  const hasPerfSection = perfLines.length > 0;
  if (!hasTargetWords && !hasPerfSection) return null as unknown as React.ReactElement;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {isOpen ? (
        <Pressable
          style={[styles.overlay, darkModeEnabled && { backgroundColor: 'rgba(0,0,0,0.35)' }]}
          onPress={onClose}
        />
      ) : null}

      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.panelContainer,
          { transform: [{ translateX }] },
        ]}
      >
        <Pressable
          onPress={isOpen ? onClose : onOpen}
          style={[styles.tab, { backgroundColor: motifRed }]}
        >
          <Text style={styles.tabText}>{isOpen ? '>' : '<'}</Text>
        </Pressable>

        <ScrollView
          style={[
            styles.panel,
            { backgroundColor: panelBg, borderColor: panelBorder },
            {
              paddingTop: insets.top + 12,
            },
          ]}
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.heading, { color: headingColor }]}>Puzzle Debug</Text>

          {blueLetters.length > 0 ? (
            <View style={styles.section}>
              <Text style={[styles.subHeading, { color: headingColor }]}>Discovered</Text>
              <View style={styles.blueLetterRow}>
                {blueLetters.map((ch) => {
                  const count = blueCountMap?.get(ch) ?? 1;
                  return (
                    <View key={ch} style={[styles.blueLetterTile, { backgroundColor: motifBlue }]}>
                      <Text style={styles.blueLetterText}>{ch}</Text>
                      {alphabetShowBlueCounts && count > 1 ? (
                        <View style={styles.countBadge}>
                          <Text style={styles.countBadgeText}>{count}</Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={[styles.subHeading, { color: headingColor }]}>Color Codes</Text>
            {LEGEND_ITEMS.map((item) => (
              <View key={item.label} style={styles.legendRow}>
                <View style={[styles.legendTile, { backgroundColor: item.color }]}>
                  <Text
                    style={[
                      styles.legendTileText,
                      item.strikethrough && styles.guessedLetterText,
                    ]}
                  >
                    {item.example}
                  </Text>
                </View>
                <Text style={[styles.legendLabel, { color: mutedTextColor }]}>{item.label}</Text>
              </View>
            ))}
          </View>

          {hasPerfSection ? (
            <View style={[styles.devBox, darkModeEnabled && { backgroundColor: '#202020', borderColor: '#3a3a3a' }]}>
              <Text style={[styles.devHeading, darkModeEnabled && { color: '#d2d2d2' }]}>UI PERF</Text>
              {perfLines.map((line) => (
                <View key={line.label} style={styles.metricRow}>
                  <Text style={[styles.metricLabel, { color: mutedTextColor }]}>{line.label}</Text>
                  <Text style={[styles.metricValue, darkModeEnabled && { color: '#f2f2f2' }]}>{line.value}</Text>
                </View>
              ))}
              <View style={styles.perfActionsRow}>
                <Pressable style={[styles.perfButton, isDevUiPerfLogging && styles.perfButtonActive]} onPress={onToggleDevUiPerfLogging}>
                  <Text style={styles.perfButtonText}>{isDevUiPerfLogging ? 'Stop Log' : 'Start Log'}</Text>
                </Pressable>
                <Pressable style={styles.perfButton} onPress={onCopyDevUiPerfLog}>
                  <Text style={styles.perfButtonText}>Copy Log</Text>
                </Pressable>
                <Pressable style={styles.perfButton} onPress={onClearDevUiPerfLog}>
                  <Text style={styles.perfButtonText}>Clear</Text>
                </Pressable>
              </View>
              <Text style={[styles.logMetaText, { color: mutedTextColor }]}>Log rows: {devUiPerfLogCount}</Text>
            </View>
          ) : null}

          {hasTargetWords ? (
            <View style={[styles.devBox, darkModeEnabled && { backgroundColor: '#202020', borderColor: '#3a3a3a' }]}>
              <Text style={[styles.devHeading, darkModeEnabled && { color: '#d2d2d2' }]}>TARGET WORDS</Text>
              <Text style={[styles.devBody, darkModeEnabled && { color: '#f2f2f2' }]}>
                {devTargetWords!.join(' · ')}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  panelContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: -PANEL_WIDTH,
    width: PANEL_WIDTH + TAB_WIDTH,
    flexDirection: 'row',
  },
  tab: {
    width: TAB_WIDTH,
    height: TAB_HEIGHT,
    marginTop: '40%',
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: -1, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  tabText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  panel: {
    flex: 1,
    backgroundColor: '#f8f8f8',
    borderLeftWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  heading: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
    marginBottom: 4,
    letterSpacing: 1,
  },
  subHeading: {
    fontSize: 12,
    fontWeight: '600',
    color: '#222',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  section: {
    marginTop: 18,
  },
  guessedLetterText: {
    textDecorationLine: 'line-through',
  },
  blueLetterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  blueLetterTile: {
    width: 28,
    height: 28,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blueLetterText: {
    fontFamily: tAtlantic.typography.displayFamily,
    color: '#fff',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  countBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#fff',
    borderRadius: 6,
    minWidth: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  countBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#333',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  legendTile: {
    width: 28,
    height: 28,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendTileText: {
    fontFamily: tAtlantic.typography.displayFamily,
    color: '#fff',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  legendLabel: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 12,
    color: '#666',
  },
  devBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
  },
  devHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#444',
    marginBottom: 4,
    letterSpacing: 1,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 2,
  },
  metricLabel: {
    flexShrink: 1,
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 12,
    color: '#666',
  },
  metricValue: {
    flexShrink: 1,
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 12,
    color: '#222',
    textAlign: 'right',
  },
  perfActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  perfButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.red ?? '#E7131A',
  },
  perfButtonActive: {
    backgroundColor: '#7d1114',
  },
  perfButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  logMetaText: {
    marginTop: 10,
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 11,
    color: '#666',
  },
  devBody: {
    fontSize: 12,
    color: '#222',
    letterSpacing: 1,
  },
});
