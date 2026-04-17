/**
 * src/components/CoachMark.tsx
 * -----------------------------------------------------------
 * Reusable tutorial overlay that highlights a target UI element
 * with a semi-transparent backdrop and an explanatory tooltip.
 *
 * Uses the four-panel cutout approach (no SVG dependency) to
 * create a transparent window over the target rect.
 *
 * Auto-positions the tooltip above or below based on available
 * screen space, preferring the caller's hint but flipping if
 * the tooltip would go off-screen.
 */
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DESIGN_TOKEN_SETS } from '@src/theme/designTokens';
import useUIStore from '@stores/uiStore';

const tokens = DESIGN_TOKEN_SETS.atlantic;
const BACKDROP_COLOR = 'rgba(0,0,0,0.6)';
const ARROW_SIZE = 10;
const FADE_MS = 200;
const TOOLTIP_ESTIMATE_HEIGHT = 240; // rough height of tooltip card for position checks
const TOOLTIP_MARGIN = 14; // gap between cutout edge and tooltip

export type TargetRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type CoachMarkProps = {
  /** Bounding box of the element to highlight (from onLayout / measure). */
  targetRect: TargetRect | null;
  title: string;
  body: string | React.ReactNode;
  /** Preferred tooltip position. Will flip if not enough space. */
  position?: 'above' | 'below';
  /** Button text. Pass `null` to hide the button (for "wait for user action" steps). */
  buttonLabel?: string | null;
  /** Optional progress label, e.g. "Step 3 of 7". */
  stepLabel?: string;
  onPress?: () => void;
  visible: boolean;
};

export default function CoachMark({
  targetRect,
  title,
  body,
  position: positionHint = 'below',
  buttonLabel = 'Next',
  stepLabel,
  onPress,
  visible,
}: CoachMarkProps): React.JSX.Element | null {
  const opacity = useRef(new Animated.Value(0)).current;
  const darkMode = useUIStore((s) => s.darkModeEnabled);
  // measureInWindow returns y from the app-window origin (below the status bar),
  // but absoluteFill starts at the physical screen top. Adding insets.top aligns them.
  const { top: topInset } = useSafeAreaInsets();

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: FADE_MS,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  if (!visible || !targetRect) return null;

  const { width: screenW, height: screenH } = Dimensions.get('window');
  const { x, width, height } = targetRect;
  const y = targetRect.y + topInset;

  // Decide actual position: prefer hint, but flip if tooltip would go off-screen
  const spaceBelow = screenH - (y + height + TOOLTIP_MARGIN);
  const spaceAbove = y - TOOLTIP_MARGIN;
  let actualPosition = positionHint;
  if (positionHint === 'below' && spaceBelow < TOOLTIP_ESTIMATE_HEIGHT && spaceAbove > spaceBelow) {
    actualPosition = 'above';
  } else if (positionHint === 'above' && spaceAbove < TOOLTIP_ESTIMATE_HEIGHT && spaceBelow > spaceAbove) {
    actualPosition = 'below';
  }

  const cardBg = darkMode ? '#1e1e1e' : '#fff';
  const titleColor = darkMode ? '#f2f2f2' : '#1c1b18';
  const bodyColor = darkMode ? '#d1d1d1' : '#444';

  // Position the tooltip, clamping to screen bounds
  const tooltipStyle: Record<string, number> = {};
  if (actualPosition === 'above') {
    // Place tooltip bottom edge above the cutout top
    const bottomPos = screenH - y + TOOLTIP_MARGIN;
    tooltipStyle.bottom = Math.max(8, bottomPos);
  } else {
    // Place tooltip top edge below the cutout bottom
    const topPos = y + height + TOOLTIP_MARGIN;
    tooltipStyle.top = Math.min(topPos, screenH - TOOLTIP_ESTIMATE_HEIGHT - 8);
  }

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity, zIndex: 999 }]} pointerEvents="box-none">
      {/* Top panel */}
      <View style={[styles.backdrop, { top: 0, left: 0, right: 0, height: Math.max(0, y) }]} />
      {/* Bottom panel */}
      <View style={[styles.backdrop, { top: y + height, left: 0, right: 0, bottom: 0 }]} />
      {/* Left panel */}
      <View style={[styles.backdrop, { top: y, left: 0, width: Math.max(0, x), height }]} />
      {/* Right panel */}
      <View style={[styles.backdrop, { top: y, left: x + width, right: 0, height }]} />

      {/* Cutout highlight border */}
      <View
        pointerEvents="none"
        style={[
          styles.cutoutBorder,
          { top: y - 2, left: Math.max(0, x - 2), width: width + 4, height: height + 4 },
        ]}
      />

      {/* Tooltip card */}
      <View style={[styles.tooltip, tooltipStyle, { backgroundColor: cardBg }]}>
        {/* Arrow pointing to cutout */}
        <View
          style={[
            styles.arrow,
            actualPosition === 'above' ? styles.arrowDown : styles.arrowUp,
            {
              left: Math.min(Math.max(x + width / 2 - ARROW_SIZE, 16), screenW - 48),
              borderBottomColor: actualPosition === 'above' ? undefined : cardBg,
              borderTopColor: actualPosition === 'above' ? cardBg : undefined,
            },
          ]}
        />
        <ScrollView style={styles.tooltipScroll} showsVerticalScrollIndicator={false}>
          <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
          {stepLabel ? (
            <Text style={[styles.stepLabel, { color: bodyColor }]}>{stepLabel}</Text>
          ) : null}
          {typeof body === 'string' ? (
            <Text style={[styles.body, { color: bodyColor }]}>{body}</Text>
          ) : (
            <View style={styles.body}>{body}</View>
          )}
        </ScrollView>
        {buttonLabel ? (
          <Pressable
            onPress={onPress}
            style={({ pressed }) => [styles.button, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
            accessibilityLabel={buttonLabel}
          >
            <Text style={styles.buttonText}>{buttonLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    backgroundColor: BACKDROP_COLOR,
  },
  cutoutBorder: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 6,
  },
  tooltip: {
    position: 'absolute',
    left: 16,
    right: 16,
    maxHeight: 320,
    borderRadius: tokens.radii.md,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  tooltipScroll: {
    maxHeight: 220,
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
    fontSize: 18,
    marginBottom: 4,
  },
  stepLabel: {
    fontFamily: tokens.typography.bodyFamily,
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 6,
  },
  body: {
    fontFamily: tokens.typography.bodyFamily,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  button: {
    alignSelf: 'flex-end',
    backgroundColor: '#E7131A',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: tokens.radii.sm,
    marginTop: 4,
  },
  buttonText: {
    fontFamily: tokens.typography.bodyFamily,
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
});
