/**
 * src/components/BoardView.tsx
 * ---------------------------------------------
 * Displays a crossword grid whose layout is derived directly from the masked
 * segments supplied by the server. Each tile can be a clued word, the active
 * highlight, a solved letter, or a void square.
 */

import React, { useMemo, useRef, useEffect } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing as REasing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Shadow } from 'react-native-shadow-2';

import type { MaskedSegment } from '@schemas/api';
import {
  type BoardTile,
} from '@src/lib/boardRevealMap';
import type { DisplayGuessByTarget } from '@src/lib/guessDisplayState';
import useUIStore from '@stores/uiStore';
import type { BoardPalette } from '@stores/uiStore';
import colors from '../theme/colors';
import { DESIGN_TOKEN_SETS } from '../theme/designTokens';
import { useFeedbackColors } from '../theme/feedbackColors';
import { useTilePalette, codeToTileFromPalette, type TilePalette } from '../theme/tilePalette';
import { buildCanonicalWordSlots, type TargetMeta } from '@src/utils/wordSlots';
import {
  normalizeBoardTilesByViewCoords,
  resolveBoardTileRevealMap,
  resolveAtlanticTileRenderState,
} from './boardViewHelpers';
import type { DevUiPerfRenderCounts } from '@src/lib/devUiPerf';

const tAtlantic = DESIGN_TOKEN_SETS.atlantic;

type TileState = 'void' | 'hidden' | 'revealed';

type CellInfo = {
  state: TileState;
  segmentIndices: number[];
};

const GRID = 10;
const ATLANTIC_GAP = 2;
const ATLANTIC_TILE_DEFAULT = 32;
const ATLANTIC_TILE_MIN = 18;
const ATLANTIC_TILE_MAX = 56;

type BoardViewProps = {
  maskedSegments: MaskedSegment[];
  revealedCoords: number[][];
  activeTargetIndex?: number | null;
  activeClueNumber?: number | null;
  activeGuessText?: string;
  activeGuessCodes?: string[];
  solvedWordsByTarget?: Record<number, string>;
  /** Canonical steady-state board tile map. Preferred for Atlantic board paint. */
  boardTilesByCoord?: Map<string, BoardTile>;
  /** Non-fatal pipeline diagnostics for explicit production failure states. */
  boardDiagnostics?: string[];
  onTilePress?: (targetIndex: number) => void;
  useAtlanticMode?: boolean;
  availableWidth?: number;
  availableHeight?: number;
  tileSize?: number;
  targetsMeta?: TargetMeta[];
  /** Target index whose tiles should animate (the just-submitted word). */
  revealTargetIndex?: number | null;
  /** Increment each time a word is submitted to trigger animation. */
  revealEpoch?: number;
  /** Reports the computed tile size so callers can position overlays accurately. */
  onTileSizeComputed?: (size: number) => void;
  /** Reports crop info so callers can compute overlay coordinates for the cropped subgrid. */
  onCropComputed?: (info: { minRow: number; minCol: number; rows: number; cols: number }) => void;
  /** Dev-only mutable render counters shared with the live board screen. */
  devRenderCountsRef?: React.MutableRefObject<DevUiPerfRenderCounts> | null;
};

const DEFAULT_GRID_SIZE = 10;
const CLUED_FILL = '#f6f6f9'; // Soft white to mirror BasicBox tiles with a hint of paper tone
const CLUED_BORDER = '#000000'; // Darker stroke to mimic crisp grid lines
const VOID_FILL = 'transparent'; // Let the metallic board base show through empty/void tiles
const VOID_BORDER = '#c5c6ce'; // Subtle silver outline to keep the grid visible over the frame
const FILLED_BORDER = '#000000'; // Stronger black border for filled/guess tiles
const HIGHLIGHT_FILL = '#ffffff'; // Brighter fill when the active target is focused
const HIGHLIGHT_BORDER = '#1d1b1bff';
const SOLVED_BORDER = colors.ink;
const DEFAULT_NUMBERING_COLOR = '#3d2918';
const FRAME_GRADIENT = ['#f7f7fa', '#d6d6de']; // Background/edge blend from BasicBox frame
const FRAME_BORDER = '#c5c6ce'; // Thin outline around the frame
const GRID_BACKGROUND = '#e9eaf0'; // Light metallic backdrop that will show through void tiles
const BOARD_SHADOW_COLOR = 'rgba(0, 0, 0, 0.24)';

// Intersection tile assets
const CW_MOTIF_ASSET = require('../../assets/design/icons/CWMotifRed.png');

// Re-exported from shared animation timing module.
export { REVEAL_STAGGER_MS, FLIP_HALF_MS, totalRevealMs } from '@src/animations/revealTiming';
import { REVEAL_STAGGER_MS, FLIP_HALF_MS } from '@src/animations/revealTiming';

type TileRevealInfo = {
  letter: string;
  primaryTargetIndex: number;
  primaryCode: string;
  primaryDirection: 'A' | 'D';
  positionInWord: number;
  shouldAnimate: boolean;
  isLocked: boolean;
};

// ─── AtlanticTileInner ────────────────────────────────────────────────────────
// Renders a single Atlantic board tile with optional flip + reveal animation.
// This must be a React component (not a plain function) because it uses hooks.

type AtlanticTileInnerProps = {
  tileSize: number;
  colorA: { bg: string; letter: string } | null;  // primary/active word — face color
  wordDirection: 'A' | 'D';    // primary word direction — controls flip axis
  shouldAnimate: boolean;
  staggerDelay: number;
  revealEpoch: number;
  letter?: string;
  feedbackStyle?: { bg: string; text: string } | null;
  feedbackLetter?: string;
  solvedLetter?: string;
  solvedBg?: string;
  idleBg: string;
  idleBorder: string;
  isIntersection?: boolean;
  motifTintColor?: string;
  motifOpacity?: number;
  glyphFontSize: number;
  tileIdleLetter: string;
};

function AtlanticTileInnerComponent({
  tileSize, colorA, wordDirection,
  shouldAnimate, staggerDelay, revealEpoch,
  letter, feedbackStyle, feedbackLetter,
  solvedLetter, solvedBg,
  idleBg, idleBorder,
  isIntersection = false,
  motifTintColor,
  motifOpacity,
  glyphFontSize,
  tileIdleLetter,
}: AtlanticTileInnerProps) {
  const flipAnim = useSharedValue(0);
  const isFirstRevealRef = useRef(true);

  // ── Committed state as shared values (UI-thread) ──────────────────
  // These drive backgroundColor and letter color via useAnimatedStyle so the
  // midpoint color swap happens on the same frame as the flip — zero delay.
  const committedBg = useSharedValue(colorA && !shouldAnimate ? colorA.bg : '');
  const committedBorder = useSharedValue(colorA && !shouldAnimate ? colorA.bg : '');
  const committedLetterColor = useSharedValue(
    colorA && !shouldAnimate ? colorA.letter : tileIdleLetter,
  );

  // Two-layer letter cross-fade: old (committed) letter fades out, new (pending)
  // letter fades in — both at the flip midpoint on the UI thread, same frame.
  const committedLetterOpacity = useSharedValue(colorA && !shouldAnimate ? 1 : 0);
  const pendingLetterOpacity = useSharedValue(0);
  const committedLetterRef = useRef<string | undefined>(
    letter && !shouldAnimate ? letter : undefined,
  );

  // Pending props: what the NEXT reveal should show. Set from JS when colorA
  // changes, read from the UI thread at the flip midpoint.
  const pendingBg = useSharedValue(colorA?.bg ?? '');
  const pendingBorder = useSharedValue(colorA?.bg ?? '');
  const pendingLetterColor = useSharedValue(colorA?.letter ?? tileIdleLetter);

  // Keep pending values in sync with incoming props.
  const colorARef = useRef(colorA);
  colorARef.current = colorA;
  const letterRef = useRef(letter);
  letterRef.current = letter;
  useEffect(() => {
    pendingBg.value = colorA?.bg ?? '';
    pendingBorder.value = colorA?.bg ?? '';
    pendingLetterColor.value = colorA?.letter ?? tileIdleLetter;
  }, [colorA?.bg, colorA?.letter]); // eslint-disable-line react-hooks/exhaustive-deps

  // UI-thread flag: 1 once committed state exists, 0 otherwise.
  const hasCommittedSV = useSharedValue(colorA && !shouldAnimate ? 1 : 0);

  // Settled (non-animating) tiles: sync committed state from props immediately.
  useEffect(() => {
    if (shouldAnimate) return;
    if (!colorA) {
      committedBg.value = '';
      committedBorder.value = '';
      committedLetterColor.value = tileIdleLetter;
      hasCommittedSV.value = 0;
      committedLetterOpacity.value = 0;
      pendingLetterOpacity.value = 0;
      committedLetterRef.current = undefined;
      return;
    }
    committedBg.value = colorA.bg;
    committedBorder.value = colorA.bg;
    committedLetterColor.value = colorA.letter;
    hasCommittedSV.value = 1;
    committedLetterOpacity.value = 1;
    pendingLetterOpacity.value = 0;
    committedLetterRef.current = letter;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorA?.bg, shouldAnimate, letter]);

  // Promote the just-revealed letter into committedLetterRef so the NEXT
  // re-reveal render shows the correct old letter in the committed layer.
  const promoteCommittedLetter = () => {
    committedLetterRef.current = letterRef.current;
  };

  // Animation trigger: fires on the UI thread when revealEpoch increments.
  useEffect(() => {
    if (isFirstRevealRef.current) { isFirstRevealRef.current = false; return; }
    if (!shouldAnimate || !colorA) return;

    // Show the committed (old) letter during the closing half-flip;
    // hide the pending (new) letter until midpoint swaps them.
    committedLetterOpacity.value = 1;
    pendingLetterOpacity.value = 0;

    flipAnim.value = 0;
    flipAnim.value = withDelay(
      staggerDelay,
      withSequence(
        withTiming(0.5, { duration: FLIP_HALF_MS, easing: REasing.inOut(REasing.ease) }),
        withTiming(1, { duration: FLIP_HALF_MS, easing: REasing.inOut(REasing.ease) }),
      ),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealEpoch]);

  // Midpoint commit: swap colors + cross-fade letters on the UI thread.
  // All commits are shared-value operations — same frame, zero bridge delay.
  useAnimatedReaction(
    () => flipAnim.value,
    (current, previous) => {
      if ((previous ?? 0) < 0.5 && current >= 0.5) {
        committedBg.value = pendingBg.value;
        committedBorder.value = pendingBorder.value;
        committedLetterColor.value = pendingLetterColor.value;
        hasCommittedSV.value = 1;
        committedLetterOpacity.value = 0;
        pendingLetterOpacity.value = 1;
        // Promote the just-revealed letter so the committed layer is ready
        // if this word gets a subsequent reveal (re-guess).
        runOnJS(promoteCommittedLetter)();
      }
    },
  );

  // ── Animated styles (UI thread) ───────────────────────────────────
  const animStyle = useAnimatedStyle(() => {
    const v = flipAnim.value;
    const deg = v <= 0.5 ? v * 180 : (1 - v) * 180;
    return {
      transform: [
        { perspective: 300 },
        wordDirection === 'A'
          ? { rotateY: `${deg}deg` }
          : { rotateX: `${deg}deg` },
      ],
    };
  });

  // Display priority: live feedback > committed reveal > solved > idle.
  const hasFeedback = feedbackStyle != null;
  const hasSolved   = !hasFeedback && !shouldAnimate && solvedLetter != null;
  const renderState = resolveAtlanticTileRenderState({
    hasFeedback,
    hasSolved,
    shouldAnimate,
  });

  // Background + border: driven by shared values on the UI thread.
  // hasCommittedSV gates whether the committed colors override the static fallback.
  // For feedback/solved/idle states, hasFeedback/hasSolved are JS booleans — these
  // states are non-animating so the JS render path is correct.
  const bgStyle = useAnimatedStyle(() => {
    if (hasCommittedSV.value === 0) return {};
    return {
      backgroundColor: committedBg.value,
      borderColor: committedBorder.value,
    };
  });

  const letterColorStyle = useAnimatedStyle(() => {
    if (hasCommittedSV.value === 0) return {};
    return { color: committedLetterColor.value };
  });

  const committedLetterOpacityStyle = useAnimatedStyle(() => ({
    opacity: committedLetterOpacity.value,
  }));
  const pendingLetterOpacityStyle = useAnimatedStyle(() => ({
    opacity: pendingLetterOpacity.value,
  }));

  let staticBg: string;
  let staticBorder: string;
  let staticDisplayLetter: string | undefined;
  let staticLetterColor: string;
  // letterOpacityStyle only applies to the reveal path.
  // Feedback and solved tiles render letters immediately without opacity gating.
  let applyLetterOpacity = renderState.applyLetterCrossFade;

  if (hasFeedback) {
    staticBg = feedbackStyle!.bg;
    staticBorder = feedbackStyle!.bg;
    staticDisplayLetter = feedbackLetter;
    staticLetterColor = feedbackStyle!.text;
  } else if (hasSolved) {
    staticBg = solvedBg ?? tileIdleLetter;
    staticBorder = staticBg;
    staticDisplayLetter = solvedLetter;
    staticLetterColor = '#fff';
  } else {
    // Settled and animating reveal tiles share the same static fallback;
    // bgStyle will override once committed at the reveal midpoint.
    staticBg = idleBg;
    staticBorder = idleBorder;
    staticDisplayLetter = letter;
    staticLetterColor = tileIdleLetter;
  }

  return (
    <Animated.View
      style={[
        {
          width: tileSize,
          height: tileSize,
          backgroundColor: staticBg,
          borderWidth: 1,
          borderColor: staticBorder,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          shadowOpacity: 0,
          elevation: 0,
        },
        bgStyle,
        animStyle,
      ]}
      accessible={false}
    >
      {/* Watermark (intersection motif) */}
      {isIntersection ? (
        <View pointerEvents="none" style={{ position: 'absolute', width: tileSize - 2, height: tileSize - 2 }}>
          <Image
            source={CW_MOTIF_ASSET}
            style={{
              width: tileSize - 2,
              height: tileSize - 2,
              opacity: motifOpacity ?? 0.18,
              tintColor: motifTintColor,
            }}
            resizeMode="contain"
          />
        </View>
      ) : null}

      {/* Committed (old) letter — visible during closing half-flip, fades at midpoint */}
      {renderState.showCommittedLetterLayer && committedLetterRef.current ? (
        <Animated.Text
          style={[
            {
              fontFamily: tAtlantic.typography.displayFamily,
              fontSize: glyphFontSize,
              lineHeight: glyphFontSize + 2,
              includeFontPadding: false,
              color: staticLetterColor,
              position: 'absolute',
              zIndex: 2,
            },
            letterColorStyle,
            committedLetterOpacityStyle,
          ]}
        >
          {committedLetterRef.current}
        </Animated.Text>
      ) : null}

      {/* Pending (new) / static letter — appears at midpoint, or immediately for feedback/solved */}
      {staticDisplayLetter ? (
        <Animated.Text
          style={[
            {
              fontFamily: tAtlantic.typography.displayFamily,
              fontSize: glyphFontSize,
              lineHeight: glyphFontSize + 2,
              includeFontPadding: false,
              color: staticLetterColor,
              position: 'relative',
              zIndex: 2,
            },
            letterColorStyle,
            applyLetterOpacity ? pendingLetterOpacityStyle : undefined,
          ]}
        >
          {staticDisplayLetter}
        </Animated.Text>
      ) : null}
    </Animated.View>
  );
}

const AtlanticTileInner = React.memo(AtlanticTileInnerComponent, (prev, next) => {
  return (
    prev.tileSize === next.tileSize &&
    prev.colorA?.bg === next.colorA?.bg &&
    prev.colorA?.letter === next.colorA?.letter &&
    prev.wordDirection === next.wordDirection &&
    prev.shouldAnimate === next.shouldAnimate &&
    prev.staggerDelay === next.staggerDelay &&
    prev.revealEpoch === next.revealEpoch &&
    prev.letter === next.letter &&
    prev.feedbackStyle?.bg === next.feedbackStyle?.bg &&
    prev.feedbackStyle?.text === next.feedbackStyle?.text &&
    prev.feedbackLetter === next.feedbackLetter &&
    prev.solvedLetter === next.solvedLetter &&
    prev.solvedBg === next.solvedBg &&
    prev.idleBg === next.idleBg &&
    prev.idleBorder === next.idleBorder &&
    prev.isIntersection === next.isIntersection &&
    prev.motifTintColor === next.motifTintColor &&
    prev.motifOpacity === next.motifOpacity &&
    prev.glyphFontSize === next.glyphFontSize &&
    prev.tileIdleLetter === next.tileIdleLetter
  );
});

const FALLBACK_BOARD_PALETTE: BoardPalette = {
  frameBackground: FRAME_GRADIENT[0],
  frameBorder: FRAME_BORDER,
  openFill: CLUED_FILL,
  blockedFill: VOID_FILL, // Transparent so the metallic base shows through
  numbering: DEFAULT_NUMBERING_COLOR,
  highlightFill: HIGHLIGHT_FILL,
  highlightBorder: HIGHLIGHT_BORDER,
};

function renderAtlanticStage(
  boardMatrix: CellInfo[][],
  clueNumbers: Map<string, number>,
  _coordToSegmentPosition: Map<string, Array<{ segmentIndex: number; positionInWord: number }>>,
  activeSlotIndex: number | null,
  tileSize: number,
  _theme: { accentText: string },
  _numberingTone: string,
  slotIndexToTargetIndex?: Map<number, number>,
  onTilePress?: (targetIndex: number) => void,
  darkModeEnabled?: boolean,
  tileRevealMap?: Map<string, TileRevealInfo>,
  revealEpoch?: number,
  cropInfo?: { minRow: number; minCol: number; rows: number; cols: number },
  tilePalette?: TilePalette,
): React.ReactNode {
  const tp = tilePalette!;
  const crop = cropInfo ?? { minRow: 0, minCol: 0, rows: GRID, cols: GRID };
  const stageWidth = crop.cols * tileSize + (crop.cols - 1) * ATLANTIC_GAP;
  const stageHeight = crop.rows * tileSize + (crop.rows - 1) * ATLANTIC_GAP;
  const tiles: React.ReactNode[] = [];

  boardMatrix.forEach((row, rowIndex) => {
    // Skip rows outside crop bounds
    if (rowIndex < crop.minRow || rowIndex >= crop.minRow + crop.rows) return;
    row.forEach((cell, columnIndex) => {
      // Skip columns outside crop bounds
      if (columnIndex < crop.minCol || columnIndex >= crop.minCol + crop.cols) return;
      if (cell.segmentIndices.length === 0) return; // Skip unused squares

      const key = `${rowIndex}:${columnIndex}`;
      const _clueNumber = clueNumbers.get(key);
      const isRevealed = cell.state === 'revealed';
      const isActiveSegment =
        typeof activeSlotIndex === 'number' && cell.segmentIndices.includes(activeSlotIndex);

      const isIntersection = cell.segmentIndices.length > 1;

      const x = (columnIndex - crop.minCol) * (tileSize + ATLANTIC_GAP);
      const y = (rowIndex - crop.minRow) * (tileSize + ATLANTIC_GAP);

      const handlePress = onTilePress && slotIndexToTargetIndex ? () => {
        const segIndices = cell.segmentIndices;
        if (segIndices.length === 0) return;
        if (segIndices.length === 1) {
          const targetIdx = slotIndexToTargetIndex.get(segIndices[0]);
          if (targetIdx != null) onTilePress(targetIdx);
          return;
        }
        // Intersection: cycle to the other word
        const targetIndices = segIndices
          .map((si) => slotIndexToTargetIndex.get(si))
          .filter((ti): ti is number => ti != null);
        if (targetIndices.length === 0) return;
        const activeTargetIdx = typeof activeSlotIndex === 'number'
          ? slotIndexToTargetIndex.get(activeSlotIndex)
          : undefined;
        const next = targetIndices.find((ti) => ti !== activeTargetIdx) ?? targetIndices[0];
        onTilePress(next);
      } : undefined;

      const glyphFontSize = Math.round(tileSize * 0.47);

      const tileRevealInfo = tileRevealMap?.get(key);
      const resolvedPrimaryCode = tileRevealInfo?.primaryCode ?? '';
      const colorA = resolvedPrimaryCode ? codeToTileFromPalette(resolvedPrimaryCode, tp) : null;
      const wordDirection = tileRevealInfo?.primaryDirection ?? 'A';
      const staggerDelay = (tileRevealInfo?.positionInWord ?? 0) * REVEAL_STAGGER_MS;

      // Idle background when active and not yet revealed (highlight effect)
      const idleBg = isActiveSegment && !isRevealed && !tileRevealInfo
        ? HIGHLIGHT_FILL
        : CLUED_FILL;
      const idleBorder = isActiveSegment && !isRevealed && !tileRevealInfo
        ? HIGHLIGHT_BORDER
        : FILLED_BORDER;

      const positionStyle = { position: 'absolute' as const, left: x, top: y, width: tileSize, height: tileSize };
      const tileNode = (
        <AtlanticTileInner
          key={key}
          tileSize={tileSize}
          colorA={colorA}
          wordDirection={wordDirection}
          shouldAnimate={tileRevealInfo?.shouldAnimate ?? false}
          staggerDelay={staggerDelay}
          revealEpoch={revealEpoch ?? 0}
          letter={tileRevealInfo?.letter}
          feedbackStyle={null}
          feedbackLetter={undefined}
          solvedLetter={undefined}
          solvedBg={undefined}
          idleBg={idleBg}
          idleBorder={idleBorder}
          isIntersection={isIntersection}
          motifTintColor={isRevealed ? '#ffffff' : (darkModeEnabled ? '#ffffff' : colors.ink)}
          motifOpacity={isRevealed ? 0.20 : 0.18}
          glyphFontSize={glyphFontSize}
          tileIdleLetter={tp.correct.bg}
        />
      );

      if (handlePress) {
        tiles.push(
          <Pressable
            key={key}
            onPress={handlePress}
            style={positionStyle}
            accessibilityLabel={`Row ${rowIndex + 1}, Column ${columnIndex + 1}`}
          >
            {tileNode}
          </Pressable>,
        );
      } else {
        tiles.push(
          <View
            key={key}
            style={positionStyle}
            accessibilityLabel={`Row ${rowIndex + 1}, Column ${columnIndex + 1}`}
          >
            {tileNode}
          </View>,
        );
      }
    });
  });

  return (
    <View style={{ alignItems: 'center' }}>
      <View
        accessible
        accessibilityLabel="Opponent board"
        style={{
          width: stageWidth,
          height: stageHeight,
          position: 'relative',
        }}
      >
        {tiles}
      </View>
    </View>
  );
}

/**
 * BoardView renders tiles based on server masked segments.
 */
function BoardView({
  maskedSegments,
  revealedCoords,
  activeTargetIndex,
  activeClueNumber,
  activeGuessText = '',
  activeGuessCodes = [],
  solvedWordsByTarget: _solvedWordsByTarget,
  boardTilesByCoord,
  boardDiagnostics,
  onTilePress,
  useAtlanticMode = false,
  availableWidth,
  availableHeight,
  tileSize: tileSizeProp = 38,
  targetsMeta,
  revealTargetIndex,
  revealEpoch = 0,
  onTileSizeComputed,
  onCropComputed,
  devRenderCountsRef,
}: BoardViewProps): React.JSX.Element {
  if (__DEV__ && devRenderCountsRef) {
    devRenderCountsRef.current.boardView += 1;
  }
  const theme = useUIStore((state) => state.activeTheme);
  const darkModeEnabled = useUIStore((state) => state.darkModeEnabled);
  const feedbackColors = useFeedbackColors();
  const tilePalette = useTilePalette();
  const solvedFill = tilePalette.correct.bg;

  // Lock the palette to the BasicBox mock so the board always matches that visual spec.
  const boardPalette: BoardPalette = { ...FALLBACK_BOARD_PALETTE };
  const frameBackground = boardPalette.frameBackground ?? FALLBACK_BOARD_PALETTE.frameBackground;
  const frameBorder = boardPalette.frameBorder ?? FALLBACK_BOARD_PALETTE.frameBorder;
  const openFill = boardPalette.openFill ?? FALLBACK_BOARD_PALETTE.openFill;
  const highlightFill = boardPalette.highlightFill ?? FALLBACK_BOARD_PALETTE.highlightFill;
  const highlightBorder = boardPalette.highlightBorder ?? FALLBACK_BOARD_PALETTE.highlightBorder;
  const numberingTone = boardPalette.numbering ?? theme.textSecondary ?? DEFAULT_NUMBERING_COLOR;

  const {
    boardMatrix,
    clueNumbers,
    coordToSegmentPosition,
    clueNumberToSlotIndex,
    targetIndexToSlotIndex,
    canonicalSlots,
    occupiedBounds,
  } = useMemo(() => {
    const createVoidMatrix = (): CellInfo[][] =>
      Array.from({ length: DEFAULT_GRID_SIZE }, () =>
        Array.from({ length: DEFAULT_GRID_SIZE }, (): CellInfo => ({
          state: 'void',
          segmentIndices: [],
        })),
      );

    const canonicalSlots = buildCanonicalWordSlots(maskedSegments, targetsMeta);
    const numbers = new Map<string, number>();
    const clueNumberToSlotIndex = new Map<number, number>();
    const targetIndexToSlotIndex = new Map<number, number>();

    if (canonicalSlots.length === 0 && (revealedCoords ?? []).length === 0) {
      return {
        boardMatrix: createVoidMatrix(),
        clueNumbers: numbers,
        coordToSegmentPosition: new Map<string, Array<{ segmentIndex: number; positionInWord: number }>>(),
        clueNumberToSlotIndex,
        targetIndexToSlotIndex,
        canonicalSlots,
        occupiedBounds: undefined,
      };
    }

    let minRow = Number.POSITIVE_INFINITY;
    let minCol = Number.POSITIVE_INFINITY;
    let maxRow = Number.NEGATIVE_INFINITY;
    let maxCol = Number.NEGATIVE_INFINITY;

    // --- BEGIN SAFE EXTENTS HELPERS ---
    const applyExtents = (row: number, col: number) => {
      if (!Number.isInteger(row) || !Number.isInteger(col)) return;
      minRow = Math.min(minRow, row);
      minCol = Math.min(minCol, col);
      maxRow = Math.max(maxRow, row);
      maxCol = Math.max(maxCol, col);
    };

    (canonicalSlots ?? []).forEach((slot) => {
      (slot?.coords ?? []).forEach((coord) => {
        const [row, col] = coord ?? [];
        applyExtents(row as number, col as number);
      });
    });

    (revealedCoords ?? []).forEach((coord) => {
      const [row, col] = coord ?? [];
      applyExtents(row as number, col as number);
    });
    // --- END SAFE EXTENTS HELPERS ---

    if (!Number.isFinite(minRow) || !Number.isFinite(minCol)) {
      return {
        boardMatrix: createVoidMatrix(),
        clueNumbers: numbers,
        coordToSegmentPosition: new Map<string, Array<{ segmentIndex: number; positionInWord: number }>>(),
        clueNumberToSlotIndex,
        targetIndexToSlotIndex,
        canonicalSlots,
      };
    }

    const normalizedHeight = Math.max(1, Math.floor(maxRow - minRow + 1));
    const normalizedWidth = Math.max(1, Math.floor(maxCol - minCol + 1));
    const boardCenter = Math.floor(DEFAULT_GRID_SIZE / 2);

    const clampOffset = (offset: number, span: number): number => {
      if (span >= DEFAULT_GRID_SIZE) {
        return 0;
      }

      let adjusted = offset;
      let minIndex = adjusted;
      let maxIndex = adjusted + span - 1;

      if (minIndex < 0) {
        adjusted -= minIndex;
        minIndex = 0;
        maxIndex = adjusted + span - 1;
      }

      if (maxIndex >= DEFAULT_GRID_SIZE) {
        adjusted -= maxIndex - (DEFAULT_GRID_SIZE - 1);
      }

      return adjusted;
    };

    let rowOffset = Math.round(boardCenter - (normalizedHeight - 1) / 2);
    let colOffset = Math.round(boardCenter - (normalizedWidth - 1) / 2);

    rowOffset = clampOffset(rowOffset, normalizedHeight);
    colOffset = clampOffset(colOffset, normalizedWidth);

    const matrix = createVoidMatrix();
    const normalizedRevealedKeys = new Set<string>();
    const coordToSegmentPosition = new Map<string, Array<{ segmentIndex: number; positionInWord: number }>>();

    (revealedCoords ?? []).forEach(([row, col]) => {
      if (!Number.isInteger(row) || !Number.isInteger(col)) {
        return
      }
      const normalizedRow = row - minRow;
      const normalizedCol = col - minCol;
      if (normalizedRow < 0 || normalizedCol < 0) {
        return
      }

      const finalRow = normalizedRow + rowOffset;
      const finalCol = normalizedCol + colOffset;

      if (
        finalRow < 0 ||
        finalCol < 0 ||
        finalRow >= DEFAULT_GRID_SIZE ||
        finalCol >= DEFAULT_GRID_SIZE
      ) {
        return
      }

      normalizedRevealedKeys.add(`${finalRow}:${finalCol}`);
    })

    canonicalSlots.forEach((slot, slotIndex) => {
      const coords = slot.coords ?? [];
      if (coords.length === 0) {
        return
      }

      const [firstRow, firstCol] = coords[0] ?? [];
      if (Number.isInteger(firstRow) && Number.isInteger(firstCol)) {
        const normalizedClueRow = firstRow - minRow;
        const normalizedClueCol = firstCol - minCol;
        const finalClueRow = normalizedClueRow + rowOffset;
        const finalClueCol = normalizedClueCol + colOffset;
        if (
          finalClueRow >= 0 &&
          finalClueCol >= 0 &&
          finalClueRow < DEFAULT_GRID_SIZE &&
          finalClueCol < DEFAULT_GRID_SIZE
        ) {
          numbers.set(`${finalClueRow}:${finalClueCol}`, slot.clueNumber);
          if (!clueNumberToSlotIndex.has(slot.clueNumber)) {
            clueNumberToSlotIndex.set(slot.clueNumber, slotIndex);
          }
        }
      }
      targetIndexToSlotIndex.set(slot.targetIndex, slotIndex);

      coords.forEach(([row, col], positionInWord) => {
        if (!Number.isInteger(row) || !Number.isInteger(col)) {
          return
        }

        const normalizedRow = row - minRow;
        const normalizedCol = col - minCol;
        const finalRow = normalizedRow + rowOffset;
        const finalCol = normalizedCol + colOffset;

        if (
          finalRow < 0 ||
          finalCol < 0 ||
          finalRow >= DEFAULT_GRID_SIZE ||
          finalCol >= DEFAULT_GRID_SIZE
        ) {
          return
        }

        const existing = matrix[finalRow][finalCol];
        const nextSegments = existing.segmentIndices.includes(slotIndex)
          ? existing.segmentIndices
          : [...existing.segmentIndices, slotIndex];
        const coordKey = `${finalRow}:${finalCol}`;
        const state: TileState = normalizedRevealedKeys.has(coordKey) ? 'revealed' : 'hidden';

        matrix[finalRow][finalCol] = {
          state,
          segmentIndices: nextSegments,
        };

        const entries = coordToSegmentPosition.get(coordKey) ?? [];
        entries.push({ segmentIndex: slotIndex, positionInWord });
        coordToSegmentPosition.set(coordKey, entries);
      })
    })

    return {
      boardMatrix: matrix,
      clueNumbers: numbers,
      coordToSegmentPosition,
      clueNumberToSlotIndex,
      targetIndexToSlotIndex,
      canonicalSlots,
      /** Occupied cell range within the 10×10 grid (after centering). */
      occupiedBounds: { rowStart: rowOffset, colStart: colOffset, rows: normalizedHeight, cols: normalizedWidth },
    }
  }, [maskedSegments, revealedCoords]);

  // ── Crop: use the true occupied bounding box from boardMatrix ──────
  // No padding cells — boardFrame padding provides breathing room.
  // This guarantees the tile bounding box fills the stage edge-to-edge,
  // so the stage (centered on screen) always centers the content.
  const cropInfo = useMemo(() => {
    if (!useAtlanticMode || !occupiedBounds) return { minRow: 0, minCol: 0, rows: GRID, cols: GRID };
    return {
      minRow: occupiedBounds.rowStart,
      minCol: occupiedBounds.colStart,
      rows: occupiedBounds.rows,
      cols: occupiedBounds.cols,
    };
  }, [useAtlanticMode, occupiedBounds]);

  const tileSize = useMemo(() => {
    if (!useAtlanticMode) return tileSizeProp;
    let size = ATLANTIC_TILE_DEFAULT;
    if (availableWidth != null && availableWidth > 0) {
      // +1 reserves 0.5 tile padding on each side of the horizontal axis
      size = Math.floor((availableWidth - ATLANTIC_GAP * (cropInfo.cols - 1)) / (cropInfo.cols + 1));
    }
    if (availableHeight != null && availableHeight > 0) {
      // +1 reserves 0.5 tile padding on each side of the vertical axis
      const fromHeight = Math.floor((availableHeight - ATLANTIC_GAP * (cropInfo.rows - 1)) / (cropInfo.rows + 1));
      size = Math.min(size, fromHeight);
    }
    // No upper clamp — tiles scale up freely to fill available space
    return Math.max(ATLANTIC_TILE_MIN, size);
  }, [useAtlanticMode, availableWidth, availableHeight, tileSizeProp, cropInfo]);

  useEffect(() => {
    onTileSizeComputed?.(tileSize);
  }, [tileSize, onTileSizeComputed]);
  useEffect(() => {
    onCropComputed?.(cropInfo);
  }, [cropInfo, onCropComputed]);

  // Reverse map: slotIndex → targetIndex (for tile press handler)
  const slotIndexToTargetIndex = useMemo(() => {
    const map = new Map<number, number>();
    targetIndexToSlotIndex.forEach((slotIdx, targetIdx) => {
      map.set(slotIdx, targetIdx);
    });
    return map;
  }, [targetIndexToSlotIndex]);

  const resolvedDisplayGuessByTarget = useMemo<DisplayGuessByTarget>(() => {
    if (useAtlanticMode) {
      return {};
    }

    const fallback: DisplayGuessByTarget = {};

    if (
      typeof activeTargetIndex === 'number' &&
      activeGuessText.length > 0 &&
      activeGuessCodes.length > 0
    ) {
      fallback[activeTargetIndex] = {
        guess: activeGuessText,
        codes: activeGuessCodes,
        sourceIndex: -1,
        locked: false,
      };
    }

    return fallback;
  }, [useAtlanticMode, activeTargetIndex, activeGuessText, activeGuessCodes]);

  const normalizedBoardTilesByCoord = useMemo(() => {
    return normalizeBoardTilesByViewCoords(
      boardTilesByCoord,
      coordToSegmentPosition,
      canonicalSlots,
    );
  }, [boardTilesByCoord, coordToSegmentPosition, canonicalSlots]);

  const tileRevealMap = useMemo(() => {
    return resolveBoardTileRevealMap({
      useAtlanticMode,
      normalizedBoardTilesByCoord,
      revealTargetIndex,
      activeTargetIndex,
      displayGuessByTarget: resolvedDisplayGuessByTarget,
      coordToSegmentPosition,
      slotIndexToTargetIndex,
      canonicalSlots,
    });
  }, [
    useAtlanticMode,
    normalizedBoardTilesByCoord,
    revealTargetIndex,
    activeTargetIndex,
    resolvedDisplayGuessByTarget,
    coordToSegmentPosition,
    slotIndexToTargetIndex,
    canonicalSlots,
  ]);

  // Build a map of coord → solved/green letter for board display

  // Build coord → { letter, code, isLocked } map for last guesses on non-active words

  const resolvedTargetIndex = useMemo(() => {
    if (typeof activeClueNumber === 'number') {
      return clueNumberToSlotIndex.get(activeClueNumber) ?? null;
    }
    if (typeof activeTargetIndex === 'number') {
      return targetIndexToSlotIndex.get(activeTargetIndex) ?? null;
    }
    return null;
  }, [activeClueNumber, activeTargetIndex, clueNumberToSlotIndex, targetIndexToSlotIndex]);


  return (
    <View style={[styles.outerWrapper, useAtlanticMode && styles.outerWrapperAtlantic]}>
      {/* Atlantic: flat container, no gradient. Legacy: BasicBox aluminum-like frame */}
      <LinearGradient
        colors={(useAtlanticMode ? ['transparent', 'transparent'] : FRAME_GRADIENT) as [string, string, ...string[]]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={[styles.frameGradient, useAtlanticMode && styles.frameGradientAtlantic]}
      >
        <View
          style={[
            styles.boardFrame,
            useAtlanticMode && styles.boardFrameAtlantic,
            {
              backgroundColor: useAtlanticMode ? 'transparent' : frameBackground,
              borderColor: useAtlanticMode ? 'transparent' : (frameBorder ?? FRAME_BORDER),
            },
          ]}
        >
          <View style={[styles.boardBackground, useAtlanticMode && styles.boardBackgroundAtlantic]}>
            {useAtlanticMode && (boardDiagnostics?.length ?? 0) > 0 ? (
            <View accessible accessibilityLabel="Board unavailable" style={styles.boardErrorWrap}>
              <Text style={styles.boardErrorText}>Board unavailable</Text>
            </View>
            ) : useAtlanticMode ? (
            renderAtlanticStage(
              boardMatrix,
              clueNumbers,
              coordToSegmentPosition,
              resolvedTargetIndex,
              tileSize,
              theme,
              numberingTone,
              slotIndexToTargetIndex,
              onTilePress,
              darkModeEnabled,
              tileRevealMap,
              revealEpoch,
              cropInfo,
              tilePalette,
            )
            ) : (
            <View accessible accessibilityLabel="Opponent board" style={styles.gridWrapper}>
              {boardMatrix.map((row, rowIndex) => (
                <View key={`row-${rowIndex}`} style={styles.row}>
                  {row.map((cell, columnIndex) => {
                    const key = `${rowIndex}:${columnIndex}`;
                    const clueNumber = clueNumbers.get(key);
                    const isVoid = cell.segmentIndices.length === 0;
                    const isRevealed = cell.state === 'revealed';
                    const isActiveSegment =
                      !isVoid && typeof resolvedTargetIndex === 'number' && cell.segmentIndices.includes(resolvedTargetIndex);
                    // Wordle-on-board: get position in active target word for guess overlay
                    const segmentPositions = coordToSegmentPosition.get(key) ?? [];
                    const activePosEntry = typeof resolvedTargetIndex === 'number'
                      ? segmentPositions.find((e) => e.segmentIndex === resolvedTargetIndex)
                      : undefined;
                    const positionInWord = activePosEntry?.positionInWord ?? -1;
                    const hasGuessOverlay =
                      !isVoid &&
                      activePosEntry != null &&
                      activeGuessText.length > 0 &&
                      positionInWord >= 0 &&
                      positionInWord < activeGuessText.length;
                    const overlayLetter = hasGuessOverlay ? activeGuessText[positionInWord] ?? '' : '';
                    const overlayCode = hasGuessOverlay && positionInWord < (activeGuessCodes?.length ?? 0)
                      ? (activeGuessCodes[positionInWord] ?? '').toUpperCase()
                      : '';
                    const feedbackStyle = overlayCode && feedbackColors[overlayCode]
                      ? feedbackColors[overlayCode]
                      : null;

                    let backgroundColor = isVoid ? VOID_FILL : openFill;
                    let borderColor = isVoid ? 'transparent' : FILLED_BORDER;
                    let borderWidth = isVoid ? 0 : 1;

                    if (feedbackStyle) {
                      backgroundColor = feedbackStyle.bg;
                      borderColor = feedbackStyle.bg;
                      borderWidth = 1;
                    } else if (!isVoid && isActiveSegment && !isRevealed) {
                      backgroundColor = highlightFill;
                      borderColor = highlightBorder;
                      borderWidth = 2;
                    }

                    if (!isVoid && isRevealed && !feedbackStyle) {
                      backgroundColor = solvedFill;
                      borderColor = SOLVED_BORDER;
                    }

                    const accessibilityLabel = isVoid
                      ? 'void tile'
                      : feedbackStyle
                      ? `guess ${overlayLetter} ${overlayCode}`
                      : isRevealed
                      ? 'revealed letter'
                      : cell.state === 'hidden'
                      ? 'hidden tile'
                      : 'tile';

                    const tileView = (
                      <View
                        key={`tile-${rowIndex}-${columnIndex}`}
                        style={[
                          styles.tile,
                          isVoid ? styles.blockTile : styles.whiteTile,
                          isActiveSegment && !feedbackStyle ? styles.activeTile : null,
                          isRevealed && !feedbackStyle ? styles.revealedTile : null,
                          useAtlanticMode && !isVoid ? styles.tileAtlantic : null,
                          {
                            width: tileSize,
                            height: tileSize,
                            backgroundColor,
                            borderColor,
                            borderWidth,
                          },
                        ]}
                        accessibilityLabel={`Row ${rowIndex + 1}, Column ${columnIndex + 1}, ${accessibilityLabel}`}
                      >
                        {!isVoid && !useAtlanticMode ? (
                          <LinearGradient
                            pointerEvents="none"
                            colors={['rgba(255,255,255,0.96)', 'rgba(240,240,244,0.35)', 'rgba(0,0,0,0.06)']}
                            locations={[0, 0.55, 1]}
                            start={{ x: 0.2, y: 0 }}
                            end={{ x: 0.8, y: 1 }}
                            style={styles.tileSheen}
                          />
                        ) : null}

                        {feedbackStyle ? (
                          <Text style={[styles.tileGlyph, { color: feedbackStyle.text }]}>{overlayLetter}</Text>
                        ) : isRevealed ? (
                          <Text style={[styles.tileGlyph, { color: theme.accentText }]}>?</Text>
                        ) : null}
                      </View>
                    );

                    if (isVoid) {
                      return tileView;
                    }

                    if (useAtlanticMode) {
                      return tileView;
                    }

                      const shadowConfig = isActiveSegment
                        ? {
                          offset: [7, 10] as [number, number],
                          distance: 15,
                          startColor: 'rgba(0,0,0,0.34)',
                        }
                      : isRevealed
                      ? {
                          offset: [7, 9] as [number, number],
                          distance: 14,
                          startColor: 'rgba(0,0,0,0.30)',
                        }
                      : {
                          offset: [6, 9] as [number, number],
                          distance: 14,
                          startColor: 'rgba(0,0,0,0.28)',
                        };

                    return (
                      <Shadow
                        key={`shadow-${rowIndex}-${columnIndex}`}
                        offset={shadowConfig.offset}
                        distance={shadowConfig.distance}
                        startColor={shadowConfig.startColor}
                        endColor="rgba(0,0,0,0)"
                        sides={{ end: true, bottom: true }}
                        containerStyle={styles.shadowWrapper}
                      >
                        {tileView}
                      </Shadow>
                    );
                  })}
                </View>
              ))}
            </View>
            )}
          </View>
        </View>
      </LinearGradient>

      {!useAtlanticMode ? (
        <Text style={[styles.hintText, { color: theme.textSecondary }]}>Revealed tiles glow with the accent colour.</Text>
      ) : null}
    </View>
  );
}

export default React.memo(BoardView);

const styles = StyleSheet.create({
  outerWrapper: {
    gap: 12,
    alignItems: 'center',
  },
  frameGradient: {
    padding: 12,
    borderRadius: 0,
    shadowColor: BOARD_SHADOW_COLOR,
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.6,
    shadowRadius: 22,
    elevation: 18,
  },
  boardFrame: {
    padding: 10,
    borderRadius: 0,
    borderWidth: 0, // remove white outline around the silver frame
  },
  boardBackground: {
    padding: 8,
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: GRID_BACKGROUND,
    borderWidth: 0, // remove inner border to avoid visible white edge
    borderColor: FRAME_BORDER,
  },
  gridWrapper: {
    gap: 0,
    alignSelf: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 0,
  },
  tile: {
    borderRadius: 0,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // No margins so tiles sit on a clean grid without misalignment.
    marginHorizontal: 0,
    marginVertical: 0,
  },
  shadowWrapper: {
    marginHorizontal: 0,
    marginVertical: 0,
  },
  whiteTile: {
    shadowColor: '#000000ff',
    shadowOpacity: 0,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 0,
    elevation: 0, // Shadow handled by react-native-shadow-2
  },
  blockTile: {
    shadowColor: '#121314',
    shadowOpacity: 0, // no shadow so void cells disappear against the metallic base
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 0,
    elevation: 0,
    backgroundColor: 'transparent',
  },
  activeTile: {
    shadowOpacity: 0,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 0,
    elevation: 0,
  },
  revealedTile: {
    shadowOpacity: 0,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 0,
    elevation: 0,
  },
  tileGlyph: {
    fontFamily: tAtlantic.typography.displayFamily,
    fontSize: 16, // overridden dynamically per tile — this is the fallback
    includeFontPadding: false, // Android: remove extra ascender/descender padding for true centering
  },
  cellNumber: {
    position: 'absolute',
    top: 4,
    left: 4,
    fontSize: 8,
    fontFamily: 'Cinzel-Regular',
    opacity: 0.75,
  },
  tileSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 0,
  },
  hintText: {
    fontSize: 12,
    textAlign: 'center',
  },
  outerWrapperAtlantic: {
    backgroundColor: 'transparent',
    maxWidth: '100%',
  },
  frameGradientAtlantic: {
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
    backgroundColor: 'transparent',
    padding: 0,
    borderWidth: 0,
  },
  boardFrameAtlantic: {
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  boardBackgroundAtlantic: {
    backgroundColor: 'transparent',
    padding: 0,
  },
  boardErrorWrap: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  boardErrorText: {
    fontFamily: tAtlantic.typography.bodyFamily,
    fontSize: 13,
    color: colors.red,
    textAlign: 'center',
  },
  tileAtlantic: {
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  tileAtlanticAbsolute: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0,
    elevation: 0,
  },
});
