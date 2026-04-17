/**
 * GameBoardPanel
 * ─────────────────────────────────────────────────────────────
 * Shared Atlantic board layout used by BoardScreen and TutorialScreen:
 *   • Board frame (L-bracket corners + BoardView)
 *   • Status rail (blue letters + optional extra content slot)
 *   • Word cards (numbered rail + scrollable stage + input row)
 *   • GameKeyboard
 *
 * All state and business logic stay in the consuming screen.
 * Pass dark-mode style overrides (darkCard, etc.) from the screen.
 */
import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { DESIGN_TOKEN_SETS } from '@src/theme/designTokens';
import colors from '@src/theme/colors';
import type { FeedbackPalette } from '@src/theme/feedbackColors';
import { useTilePalette, codeToTileFromPalette, type TilePalette } from '@src/theme/tilePalette';
import type { KeyboardLetterState } from '@src/lib/keyboardLetterStates';
import type { BoardTile } from '@src/lib/boardRevealMap';
import useUIStore from '@stores/uiStore';
import BoardView from '@components/BoardView';
import GameKeyboard from '@components/GameKeyboard';
import type { CanonicalWordSlot } from '@src/utils/wordSlots';

const tAtlantic = DESIGN_TOKEN_SETS.atlantic;

const MOTIF_RED = '#E7131A';

// ── Board corner constants ────────────────────────────────────
// CORNER_INSET_H = 0: left/right edges flush with boardFrame, matching statusRail width.
// CORNER_INSET_V = 10: top/bottom inset so brackets don't kiss the grey border lines.
// Body paddingHorizontal:16 keeps right corner 16dp from screen — clear of Samsung Edge panel.
const CORNER_INSET_H = 0;
const CORNER_INSET_V = 10;
const CORNER_OUTER_WIDTH = 70;
const CORNER_OUTER_HEIGHT = 220;
const CORNER_OUTER_STROKE_H = 3;
const CORNER_OUTER_STROKE_V = 3;
const CORNER_INNER_GAP = 6;
const CORNER_INNER_WIDTH = CORNER_OUTER_WIDTH - CORNER_INNER_GAP * 2;
const CORNER_INNER_HEIGHT = CORNER_OUTER_HEIGHT - CORNER_INNER_GAP * 2;
const CORNER_INNER_STROKE_H = 2;
const CORNER_INNER_STROKE_V = 2;
const CORNER_RADIUS = 2;

const ROW_PAD_COMPACT = 4;
const TILE_COMPACT = 24;

/** Full height of the badge rail — export for CoachMark measurement callers. */
export const RAIL_FULL_H = 34 * 5 + 10 * 4; // 210

// Feedback colors are now resolved via useFeedbackColors() hook.

/** A single history/guess entry rendered in the stage panel. */
export type CodeEntry = {
  rowId?: string;
  codes: string[];
  guess: string;
  kind?: 'native' | 'shadow';
  interactive?: boolean;
  isPreviewed?: boolean;
  isLocked?: boolean;
};

/** One row in list mode (one per word slot). */
export type ListItem = {
  slot: CanonicalWordSlot;
  entry?: CodeEntry;
};

export interface GameBoardPanelProps {
  // ── Board ──────────────────────────────────────────────────
  maskedSegments: any[];
  revealedCoords: any[];
  activeTargetIndex: number;
  boardTilesByCoord?: Map<string, BoardTile>;
  boardDiagnostics?: string[];
  targetsMeta: any[];
  /** Optional reveal target forwarded to BoardView for tile-flip parity. */
  revealTargetIndex?: number | null;
  /** Optional reveal epoch forwarded to BoardView to trigger a new reveal pass. */
  revealEpoch?: number;
  onTilePress: (targetIndex: number) => void;
  boardRef?: React.RefObject<View | null>;
  boardWidth?: number | null;
  /** Called with the inner content width so BoardView can scale correctly. */
  onBoardWidthChange?: (w: number) => void;
  /** Called when the boardFrame lays out — use to trigger measureInWindow. */
  onBoardFrameLayout?: () => void;
  /** Reports the computed tile size from BoardView. */
  onTileSizeComputed?: (size: number) => void;
  /** When true the board uses the compact minHeight (keyboard is visible). */
  compact?: boolean;
  windowHeight: number;

  // ── Status rail ────────────────────────────────────────────
  blueLetters: string[];
  /** Slot rendered above the blue letters (e.g. bot duel stats banner). */
  statusRailExtra?: React.ReactNode;

  // ── Rail badges ────────────────────────────────────────────
  wordSlots: CanonicalWordSlot[];
  solvedFlags: boolean[] | Record<number, boolean>;
  selectedTargetIndex: number;
  intersectionPositionsByTarget?: Map<number, Set<number>>;
  onRailPress: (targetIndex: number) => void;
  railRef?: React.RefObject<View | null>;

  // ── Stage panel ────────────────────────────────────────────
  /** Defaults to 'detail'. BoardScreen also uses 'list'. */
  stageMode?: 'list' | 'detail';
  stageScrollRef?: React.RefObject<ScrollView | null>;

  // Detail mode
  historyItems: CodeEntry[];
  onHistoryPress?: (gIdx: number) => void;
  onHistoryLongPress?: (gIdx: number) => void;
  /** Ref for the first history row — used for CoachMark targeting. */
  firstHistoryRef?: React.RefObject<View | null>;
  /** Show "Solved ✓" badge above the stage. */
  isSolvedWord?: boolean;

  // List mode (stageMode === 'list')
  listItems?: ListItem[];
  onListItemPress?: (targetIndex: number) => void;
  /** Fallback word lengths for list-mode placeholder cells. */
  targetLengths?: Record<number, number>;

  // ── Input row ──────────────────────────────────────────────
  showGuessInput: boolean;
  guessText: string;
  wordLength: number;
  /** Green-confirmed letters by position index, shown as dimmed placeholders. */
  greenLetters: Record<number, string>;
  guessError?: string | null;
  letterInputRef?: React.RefObject<View | null>;
  inputDisabled?: boolean;

  // ── Keyboard ───────────────────────────────────────────────
  onKey: (letter: string) => void;
  onBackspace: () => void;
  onSubmit: () => void;
  letterStates: Record<string, KeyboardLetterState>;
  keyboardDisabled?: boolean;
  /**
   * When false the keyboard is not rendered by this component (caller owns it).
   * Defaults to `showGuessInput`.
   */
  showKeyboard?: boolean;
  /** Passed as paddingBottom on the keyboard wrapper for the home-indicator gap. */
  safeAreaBottom?: number;
  /**
   * The horizontal padding of the parent container.
   * The keyboard wrapper uses a matching negative margin to bleed full-width.
   * Default: 16.
   */
  outerHorizontalPadding?: number;

  // ── Dark mode overrides ────────────────────────────────────
  darkCard?: ViewStyle | null;
  darkDivider?: ViewStyle | null;
  darkText?: TextStyle | null;
  darkInputBox?: ViewStyle | null;

  // —— Tutorial-only hooks ————————————————————————————————————————
  /** Optional layout callback per zone — used by TutorialScreen for spotlight positioning. */
  onZoneLayout?: (zone: string, e: LayoutChangeEvent) => void;
  emphasizeBoard?: boolean;
  emphasizeStatusRail?: boolean;
  emphasizedRailTargetIndex?: number | null;
  emphasizeHistoryRow?: number | null;
  emphasizeInput?: boolean;
  emphasizeKeyboard?: boolean;
}

function renderCodeRow(
  codes: string[],
  guess: string,
  _palette?: FeedbackPalette,
  _activeBlueLetters?: Set<string>,
  tilePalette?: TilePalette,
  crossPositions?: Set<number>,
  tight = false,
): React.ReactElement {
  return (
    <View style={tight ? s.codeRowInline : s.codeRow}>
      {codes.map((code, i) => {
        const c = codeToTileFromPalette(code, tilePalette!);
        const isCrossCell = crossPositions?.has(i) ?? false;
        return (
          <View
            key={i}
            style={[
              s.codeCell,
              { backgroundColor: c.bg },
            ]}
          >
            {isCrossCell ? <View pointerEvents="none" style={s.codeCellCrossOutline} /> : null}
            <Text style={[s.codeLetter, { color: c.letter }]}>
              {guess[i] ?? ''}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default function GameBoardPanel({
  maskedSegments,
  revealedCoords,
  activeTargetIndex,
  boardTilesByCoord,
  boardDiagnostics,
  targetsMeta,
  revealTargetIndex = null,
  revealEpoch = 0,
  onTilePress,
  boardRef,
  boardWidth,
  onBoardWidthChange,
  onBoardFrameLayout,
  onTileSizeComputed,
  compact = false,
  windowHeight,
  blueLetters,
  statusRailExtra,
  wordSlots,
  solvedFlags,
  selectedTargetIndex,
  intersectionPositionsByTarget,
  onRailPress,
  railRef,
  stageMode = 'detail',
  stageScrollRef,
  historyItems,
  onHistoryPress,
  onHistoryLongPress,
  firstHistoryRef,
  isSolvedWord,
  listItems,
  onListItemPress,
  targetLengths = {},
  showGuessInput,
  guessText,
  wordLength,
  greenLetters,
  guessError,
  letterInputRef,
  inputDisabled,
  onKey,
  onBackspace,
  onSubmit,
  letterStates,
  keyboardDisabled,
  showKeyboard,
  safeAreaBottom = 0,
  outerHorizontalPadding = 16,
  darkCard,
  darkDivider,
  darkText,
  darkInputBox,
  onZoneLayout,
  emphasizeBoard = false,
  emphasizeStatusRail = false,
  emphasizedRailTargetIndex = null,
  emphasizeHistoryRow = null,
  emphasizeInput = false,
  emphasizeKeyboard = false,
}: GameBoardPanelProps): React.JSX.Element {
  const darkMode = useUIStore((st) => st.darkModeEnabled);
  const tilePalette = useTilePalette();
  // Track the scroll+input area height so we can cap the ScrollView and let the
  // input "rain down" from the top, pinning at the bottom once history fills up.
  const GUESS_FOOTER_HEIGHT = 66;
  const [scrollAreaHeight, setScrollAreaHeight] = useState(0);
  const scrollMaxHeight =
    scrollAreaHeight > 0
      ? Math.max(0, scrollAreaHeight - (showGuessInput ? GUESS_FOOTER_HEIGHT : 0))
      : null;

  const boardMinHeight = Math.min(
    compact ? 160 : 320,
    windowHeight * (compact ? 0.22 : 0.45),
  );
  return (
    <>
      {/* ── Board frame ──────────────────────────────────────── */}
      <View
        ref={boardRef}
        onLayout={(e: LayoutChangeEvent) => { onBoardFrameLayout?.(); onZoneLayout?.('board', e); }}
        style={[s.boardFrame, s.sectionSpacer, darkCard, emphasizeBoard && s.boardFrameEmphasized]}
      >
        <View pointerEvents="none" style={s.boardCornerTL} />
        <View pointerEvents="none" style={s.boardCornerTLInner} />
        <View pointerEvents="none" style={s.boardCornerBR} />
        <View pointerEvents="none" style={s.boardCornerBRInner} />
        <View style={[s.boardCenterWrap, compact ? { height: Math.round(windowHeight * 0.33) } : { minHeight: boardMinHeight }]}>
          {maskedSegments.length > 0 && (
            <View
              style={{ width: '100%', alignItems: 'center' }}
              onLayout={onBoardWidthChange ? (e) => onBoardWidthChange(e.nativeEvent.layout.width) : undefined}
            >
              <BoardView
                maskedSegments={maskedSegments}
                revealedCoords={revealedCoords}
                activeTargetIndex={activeTargetIndex}
                boardTilesByCoord={boardTilesByCoord}
                boardDiagnostics={boardDiagnostics}
                targetsMeta={targetsMeta}
                availableWidth={boardWidth ?? undefined}
                availableHeight={compact ? Math.round(windowHeight * 0.33) : undefined}
                revealTargetIndex={revealTargetIndex}
                revealEpoch={revealEpoch}
                onTilePress={onTilePress}
                onTileSizeComputed={onTileSizeComputed}
                useAtlanticMode
              />
            </View>
          )}
        </View>
      </View>

      {/* ── Status rail ──────────────────────────────────────── */}
      <View
        style={[s.statusRail, darkCard, emphasizeStatusRail && s.statusRailEmphasized]}
        onLayout={onZoneLayout ? (e: LayoutChangeEvent) => onZoneLayout('statusRail', e) : undefined}
      >
        {statusRailExtra}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.statusRailLetters}
        >
          {blueLetters.map((ch) => (
            <View key={ch} style={[s.statusRailLetterTile, { backgroundColor: tilePalette.notInWord.bg }]}>
              <Text style={s.statusRailLetterText}>{ch}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* ── Word cards ───────────────────────────────────────── */}
      <View
        style={[s.wordCardsCard, s.sectionSpacer, darkCard]}
        onLayout={onZoneLayout ? (e: LayoutChangeEvent) => onZoneLayout('wordCards', e) : undefined}
      >
        <View style={s.railRow}>
          {/* Numbered rail badges */}
          <ScrollView
            ref={railRef as unknown as React.RefObject<ScrollView>}
            style={s.rail}
            contentContainerStyle={s.railContent}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            {wordSlots.map((slot) => {
              const isSelected = selectedTargetIndex === slot.targetIndex;
              const isSolved = solvedFlags[slot.targetIndex];
              return (
                <Pressable
                  key={`rail-${slot.key}`}
                  onPress={() => onRailPress(slot.targetIndex)}
                  style={[
                    s.railBadgeWrap,
                    isSelected && s.railBadgeWrapSelected,
                    emphasizedRailTargetIndex === slot.targetIndex && s.railBadgeWrapEmphasized,
                  ]}
                >
                  <View
                    style={[
                      s.railBadge,
                      isSolved && s.railBadgeSolved,
                      isSelected && s.railBadgeSelectedInner,
                      emphasizedRailTargetIndex === slot.targetIndex && s.railBadgeEmphasized,
                    ]}
                  >
                    <Text style={s.railBadgeText}>{slot.displayIndex}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Stage panel */}
          <View
            style={s.stagePanel}
            onLayout={onZoneLayout ? (e: LayoutChangeEvent) => onZoneLayout('history', e) : undefined}
          >
            <View style={{ flex: 1, minHeight: 0 }}>
              {stageMode === 'detail' && isSolvedWord && (
                <View style={s.detailHeaderRow}>
                  <Text style={[s.detailHeaderText, { color: tilePalette.correct.bg }, darkText]}>Solved ✓</Text>
                </View>
              )}

              {/* Measured wrapper: ScrollView grows to content height up to maxHeight,
                  then scrolls. Input sits right after — "rains down" until it pins. */}
              <View
                style={{ flex: 1, minHeight: 0 }}
                onLayout={(e) => setScrollAreaHeight(e.nativeEvent.layout.height)}
              >
                <ScrollView
                  ref={stageScrollRef}
                  style={[
                    s.stageScroll,
                    scrollMaxHeight != null && { flex: 0, flexGrow: 0, maxHeight: scrollMaxHeight },
                  ]}
                  contentContainerStyle={s.stageScrollContent}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                  keyboardShouldPersistTaps="always"
                >
                  {stageMode === 'list' && listItems ? (
                    <View style={s.listStage}>
                      {listItems.map(({ slot, entry }) => (
                        <Pressable
                          key={`list-${slot.key}`}
                          style={s.listRow}
                          onPress={() => onListItemPress?.(slot.targetIndex)}
                          accessibilityRole="button"
                          accessibilityLabel={`Select word ${slot.displayIndex}`}
                        >
                          {entry ? (
                            renderCodeRow(
                              entry.codes,
                              entry.guess,
                              undefined,
                              undefined,
                              tilePalette,
                              intersectionPositionsByTarget?.get(slot.targetIndex),
                              true,
                            )
                          ) : (
                            <View style={s.codeRowInline}>
                              {Array.from({
                                length: Math.max(1, slot.length ?? targetLengths[slot.targetIndex] ?? 5),
                              }).map((_, idx) => (
                                <View key={idx} style={[s.codeCell, s.codeCellPlaceholder, darkMode && { backgroundColor: '#3a3a3a', borderWidth: 1, borderColor: '#555' }]}>
                                  <Text style={s.codeLetter}>{' '}</Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    historyItems.map((entry, gIdx) => (
                      <Pressable
                        key={`hist-${gIdx}`}
                        ref={gIdx === 0 ? firstHistoryRef : undefined}
                        disabled={entry.interactive === false}
                        onPress={() => onHistoryPress?.(gIdx)}
                        onLongPress={() => onHistoryLongPress?.(gIdx)}
                        delayLongPress={300}
                        accessibilityRole="button"
                        accessibilityLabel={
                          entry.interactive === false
                            ? 'Informational cross-history row.'
                            : (entry.isLocked
                                ? 'Guess row. Tap to preview, long-press to unlock.'
                                : 'Guess row. Tap to preview, long-press to lock.')
                        }
                        style={[
                          s.guessRow,
                          s.guessRowCompact,
                          entry.interactive === false && s.guessRowInformational,
                          emphasizeHistoryRow === gIdx && s.guessRowEmphasized,
                          gIdx === historyItems.length - 1 && { borderBottomWidth: 0, paddingBottom: ROW_PAD_COMPACT },
                        ]}
                      >
                        <View style={s.historyContentCluster}>
                          {renderCodeRow(
                            entry.codes,
                            entry.guess,
                            undefined,
                            undefined,
                            tilePalette,
                            intersectionPositionsByTarget?.get(selectedTargetIndex),
                            true,
                          )}
                          <View style={s.historyMarkerGutter}>
                            {entry.interactive === false ? <Text style={s.historyInfoLabel}>INFO</Text> : null}
                            {entry.isLocked ? <View style={s.historyLockBullet} /> : null}
                          </View>
                        </View>
                      </Pressable>
                    ))
                  )}
                </ScrollView>

                {/* Input row — sits right after history, pins at bottom when history fills the space */}
                {showGuessInput && (
                  <View style={[s.guessFooter, darkDivider, emphasizeInput && s.guessFooterEmphasized]}>
                    <View
                      ref={letterInputRef}
                      style={[s.letterInputWrap, inputDisabled && s.guessBarDisabled, emphasizeInput && s.letterInputWrapEmphasized]}
                    >
                      <View style={s.letterRow}>
                        {Array.from({ length: Math.max(1, wordLength) }).map((_, idx) => {
                          const char = guessText[idx] ?? '';
                          const greenLetter = greenLetters[idx];
                          const displayChar = char || greenLetter || ' ';
                          const isGreenPlaceholder = !char && greenLetter;
                          return (
                            <View key={idx} style={[s.letterBox, darkInputBox]}>
                              <Text
                                style={[
                                  s.letterBoxText,
                                  darkText,
                                  isGreenPlaceholder && { color: tilePalette.correct.bg, opacity: 0.6 },
                                ]}
                              >
                                {displayChar}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                    {guessError ? <Text style={s.errorText}>{guessError}</Text> : null}
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* ── Keyboard ─────────────────────────────────────────── */}
      {(showKeyboard ?? showGuessInput) && (
        <View
          style={[s.keyboardWrapper, {
            marginHorizontal: -outerHorizontalPadding,
            paddingBottom: safeAreaBottom,
          }, emphasizeKeyboard && s.keyboardWrapperEmphasized]}
          onLayout={onZoneLayout ? (e: LayoutChangeEvent) => onZoneLayout('keyboard', e) : undefined}
        >
          <GameKeyboard
            onKey={onKey}
            onBackspace={onBackspace}
            onSubmit={onSubmit}
            letterStates={letterStates}
            disabled={keyboardDisabled}
          />
        </View>
      )}
    </>
  );
}

const s = StyleSheet.create({
  sectionSpacer: { marginTop: 2 },

  // ── Board frame ────────────────────────────────────────────
  boardFrame: {
    backgroundColor: '#fff',
    padding: 20,
    gap: 6,
    alignItems: 'center',
    position: 'relative',
  },
  boardFrameEmphasized: {},
  boardCornerTL: {
    position: 'absolute',
    left: CORNER_INSET_H,
    top: CORNER_INSET_V,
    width: CORNER_OUTER_WIDTH,
    height: CORNER_OUTER_HEIGHT,
    borderLeftWidth: CORNER_OUTER_STROKE_V,
    borderTopWidth: CORNER_OUTER_STROKE_H,
    borderColor: MOTIF_RED,
    backgroundColor: 'transparent',
    borderRadius: CORNER_RADIUS,
  },
  boardCornerTLInner: {
    position: 'absolute',
    left: CORNER_INSET_H + CORNER_INNER_GAP,
    top: CORNER_INSET_V + CORNER_INNER_GAP,
    width: CORNER_INNER_WIDTH,
    height: CORNER_INNER_HEIGHT,
    borderLeftWidth: CORNER_INNER_STROKE_V,
    borderTopWidth: CORNER_INNER_STROKE_H,
    borderColor: MOTIF_RED,
    backgroundColor: 'transparent',
    borderRadius: CORNER_RADIUS,
  },
  boardCornerBR: {
    position: 'absolute',
    right: CORNER_INSET_H,
    bottom: CORNER_INSET_V,
    width: CORNER_OUTER_WIDTH,
    height: CORNER_OUTER_HEIGHT,
    borderRightWidth: CORNER_OUTER_STROKE_V,
    borderBottomWidth: CORNER_OUTER_STROKE_H,
    borderColor: MOTIF_RED,
    backgroundColor: 'transparent',
    borderRadius: CORNER_RADIUS,
  },
  boardCornerBRInner: {
    position: 'absolute',
    right: CORNER_INSET_H + CORNER_INNER_GAP,
    bottom: CORNER_INSET_V + CORNER_INNER_GAP,
    width: CORNER_INNER_WIDTH,
    height: CORNER_INNER_HEIGHT,
    borderRightWidth: CORNER_INNER_STROKE_V,
    borderBottomWidth: CORNER_INNER_STROKE_H,
    borderColor: MOTIF_RED,
    backgroundColor: 'transparent',
    borderRadius: CORNER_RADIUS,
  },
  boardCenterWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },

  // ── Status rail ────────────────────────────────────────────
  statusRail: {
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 6,
    borderWidth: 1,
    borderColor: '#e7e7e7',
    borderLeftWidth: 3,
    borderLeftColor: MOTIF_RED,
    marginBottom: 2,
  },
  statusRailEmphasized: {
    borderColor: colors.blue,
    borderLeftColor: colors.blue,
    backgroundColor: `${colors.blue}12`,
  },
  statusRailLetters: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 22,
  },
  statusRailLetterTile: {
    width: 22,
    height: 22,
    borderRadius: 4,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusRailLetterText: {
    fontFamily: tAtlantic.typography.displayFamily,
    color: '#fff',
    fontSize: 11,
    letterSpacing: 0.5,
  },

  // ── Word cards ─────────────────────────────────────────────
  wordCardsCard: {
    backgroundColor: '#fff',
    padding: 10,
    flex: 1,
    minHeight: 0,
    gap: 8,
  },
  railRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    flex: 1,
    minHeight: 0,
  },
  rail: {
    width: 48,
    flexShrink: 0,
    flexGrow: 0,
  },
  railContent: {
    gap: 10,
    alignItems: 'center',
  },
  railBadgeWrap: {
    marginLeft: -14,
    paddingLeft: 14,
    paddingRight: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  railBadgeWrapSelected: {
    backgroundColor: `${MOTIF_RED}4D`,
  },
  railBadgeWrapEmphasized: {
    backgroundColor: `${colors.blue ?? '#2F6FED'}26`,
  },
  railBadge: {
    width: 34,
    height: 34,
    backgroundColor: MOTIF_RED,
    justifyContent: 'center',
    alignItems: 'center',
  },
  railBadgeEmphasized: {
    borderWidth: 2,
    borderColor: colors.blue ?? '#2F6FED',
  },
  railBadgeSelectedInner: { opacity: 0.3 },
  railBadgeSolved: { opacity: 0.5 },
  railBadgeText: {
    color: '#fff',
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 16,
  },

  // ── Stage panel ────────────────────────────────────────────
  stagePanel: {
    flex: 1,
    minHeight: 0,
    paddingLeft: 8,
  },
  detailHeaderRow: {
    paddingBottom: 4,
  },
  detailHeaderText: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 12,
    color: colors.green,
  },
  stageScroll: { flex: 1, minHeight: 0 },
  stageScrollContent: { gap: 8 },
  listStage: { flexDirection: 'column', gap: 10, alignItems: 'flex-start' },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
  },

  // ── Guess rows ─────────────────────────────────────────────
  guessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: ROW_PAD_COMPACT,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderColor: '#e7e7e7',
  },
  guessRowEmphasized: {
    backgroundColor: `${colors.blue ?? '#2F6FED'}12`,
    borderRadius: 6,
    borderColor: colors.blue ?? '#2F6FED',
    borderWidth: 1,
  },
  guessRowCompact: { paddingVertical: ROW_PAD_COMPACT },
  guessRowInformational: {
    opacity: 0.9,
  },
  historyContentCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    flexShrink: 1,
  },
  historyMarkerGutter: {
    width: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  historyLockBullet: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: MOTIF_RED,
  },
  historyInfoLabel: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 10,
    letterSpacing: 1,
    color: '#777',
  },
  codeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  codeRowInline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flexShrink: 1,
  },
  codeCell: {
    minWidth: TILE_COMPACT,
    minHeight: TILE_COMPACT,
    borderRadius: 4,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  codeCellPlaceholder: {
    backgroundColor: '#f0f0f0',
  },
  codeCellCrossOutline: {
    position: 'absolute',
    top: -3,
    right: -3,
    bottom: -3,
    left: -3,
    borderWidth: 3,
    borderColor: MOTIF_RED,
    borderRadius: 7,
  },
  codeLetter: {
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 12,
    color: '#fff',
  },
  guessFooterEmphasized: {
    borderTopWidth: 2,
    borderColor: colors.blue ?? '#2F6FED',
    paddingTop: 8,
    borderRadius: 8,
  },
  letterInputWrapEmphasized: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.blue ?? '#2F6FED',
    backgroundColor: `${colors.blue ?? '#2F6FED'}10`,
  },
  keyboardWrapperEmphasized: {
    borderTopWidth: 2,
    borderColor: colors.blue ?? '#2F6FED',
  },

  // ── Input row ──────────────────────────────────────────────
  guessFooter: {
    gap: 8,
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1.5,
    borderColor: MOTIF_RED,
  },
  letterInputWrap: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  guessBarDisabled: { opacity: 0.5 },
  letterRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  letterBox: {
    width: 30,
    height: 30,
    borderWidth: 1,
    borderRadius: 4,
    borderColor: '#000',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  letterBoxText: {
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 16,
    letterSpacing: 1,
    color: '#000',
  },
  errorText: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 14,
    color: MOTIF_RED,
  },

  // ── Keyboard wrapper ───────────────────────────────────────
  keyboardWrapper: {},
});
