/**
 * src/components/InfoTooltip.tsx
 * -----------------------------------------------------------
 * Lightweight tooltip triggered by long-press. Shows a floating
 * card with title + body text over a light dimmed backdrop.
 * Tap anywhere to dismiss.
 *
 * Positioning logic adapted from CoachMark but without the
 * four-panel cutout — just a simple floating card with arrow.
 */
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DESIGN_TOKEN_SETS } from '@src/theme/designTokens';
import useUIStore from '@stores/uiStore';
import { useTilePalette } from '@src/theme/tilePalette';
import { parseTutorialBody } from '@src/screens/tutorial/parseTutorialBody';

const tokens = DESIGN_TOKEN_SETS.atlantic;
const BACKDROP_COLOR = 'rgba(0,0,0,0.2)';
const ARROW_SIZE = 8;
const FADE_MS = 200;
const TOOLTIP_ESTIMATE_HEIGHT = 120;
const TOOLTIP_MARGIN = 10;

export type AnchorRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type InfoTooltipProps = {
  visible: boolean;
  title: string;
  body: string;
  anchorRect: AnchorRect | null;
  onDismiss: () => void;
};

export default function InfoTooltip({
  visible,
  title,
  body,
  anchorRect,
  onDismiss,
}: InfoTooltipProps): React.JSX.Element | null {
  const opacity = useRef(new Animated.Value(0)).current;
  const darkMode = useUIStore((s) => s.darkModeEnabled);
  const tilePalette = useTilePalette();
  const { top: topInset } = useSafeAreaInsets();

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: FADE_MS,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  if (!visible || !anchorRect) return null;

  const { width: screenW, height: screenH } = Dimensions.get('window');
  const { x, width, height } = anchorRect;
  const y = anchorRect.y + topInset;

  // Decide position: prefer below, flip if not enough space
  const spaceBelow = screenH - (y + height + TOOLTIP_MARGIN);
  const spaceAbove = y - TOOLTIP_MARGIN;
  const actualPosition =
    spaceBelow >= TOOLTIP_ESTIMATE_HEIGHT ? 'below'
    : spaceAbove > spaceBelow ? 'above'
    : 'below';

  const cardBg = darkMode ? '#1e1e1e' : '#fff';
  const titleColor = darkMode ? '#f2f2f2' : '#1c1b18';
  const bodyColor = darkMode ? '#d1d1d1' : '#444';

  const tooltipStyle: Record<string, number> = {};
  if (actualPosition === 'above') {
    const bottomPos = screenH - y + TOOLTIP_MARGIN;
    tooltipStyle.bottom = Math.max(8, bottomPos);
  } else {
    const topPos = y + height + TOOLTIP_MARGIN;
    tooltipStyle.top = Math.min(topPos, screenH - TOOLTIP_ESTIMATE_HEIGHT - 8);
  }

  // Center arrow on the anchor element
  const arrowLeft = Math.min(Math.max(x + width / 2 - ARROW_SIZE, 24), screenW - 48);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity, zIndex: 999 }]} pointerEvents="box-none">
      {/* Dimmed backdrop — tap to dismiss */}
      <Pressable style={[StyleSheet.absoluteFill, styles.backdrop]} onPress={onDismiss} />

      {/* Tooltip card */}
      <View style={[styles.tooltip, tooltipStyle, { backgroundColor: cardBg }]} pointerEvents="box-none">
        {/* Arrow */}
        <View
          style={[
            styles.arrow,
            actualPosition === 'above' ? styles.arrowDown : styles.arrowUp,
            {
              left: arrowLeft,
              borderBottomColor: actualPosition === 'above' ? undefined : cardBg,
              borderTopColor: actualPosition === 'above' ? cardBg : undefined,
            },
          ]}
        />
        <Text style={[styles.title, { color: titleColor }]}>
          {parseTutorialBody(title).map((seg, i) =>
            seg.type === 'text' ? (
              <Text key={i}>{seg.value}</Text>
            ) : (
              <Text
                key={i}
                style={[styles.titleSwatch, { color: tilePalette[seg.paletteKey].bg }]}
              >
                {'\u25A0'}
              </Text>
            ),
          )}
        </Text>
        <Text style={[styles.body, { color: bodyColor }]}>
          {parseTutorialBody(body).map((seg, i) =>
            seg.type === 'text' ? (
              <Text key={i}>{seg.value}</Text>
            ) : (
              <Text
                key={i}
                style={[styles.bodySwatch, { color: tilePalette[seg.paletteKey].bg }]}
              >
                {'\u25A0'}
              </Text>
            ),
          )}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: BACKDROP_COLOR,
  },
  tooltip: {
    position: 'absolute',
    left: 24,
    right: 24,
    borderRadius: tokens.radii.md,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
  arrow: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: ARROW_SIZE,
    borderRightWidth: ARROW_SIZE,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  arrowUp: {
    top: -ARROW_SIZE,
    borderBottomWidth: ARROW_SIZE,
  },
  arrowDown: {
    bottom: -ARROW_SIZE,
    borderTopWidth: ARROW_SIZE,
  },
  title: {
    fontFamily: tokens.typography.displayFamily,
    fontSize: 15,
    marginBottom: 4,
  },
  titleSwatch: {
    fontSize: 17,
  },
  body: {
    fontFamily: tokens.typography.bodyFamily,
    fontSize: 13,
    lineHeight: 19,
  },
  bodySwatch: {
    fontSize: 15,
  },
});
