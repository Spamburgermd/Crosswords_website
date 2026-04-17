/**
 * TutorialSpotlight.tsx
 * -----------------------------------------------------------
 * Four-panel cutout spotlight for the tutorial. Dims the screen
 * except for the target zone, and positions a hint card adjacent
 * to the cutout.
 *
 * Adapted from CoachMark.tsx. Uses onLayout-derived rects (no
 * measureInWindow) for reliable positioning on older devices.
 *
 * When no zoneRect is provided, renders the card without any
 * backdrop (floating card only).
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { TutorialStep, ZoneRect } from './types';
import { parseTutorialBody } from './parseTutorialBody';
import { useTilePalette } from '../../theme/tilePalette';

const BACKDROP_COLOR = 'rgba(0,0,0,0.55)';
const FADE_MS = 200;
const CARD_MARGIN = 12;
const CUTOUT_PAD = 4; // padding around the zone rect for the cutout hole

interface Props {
  step: TutorialStep;
  zoneRect: ZoneRect | null;
  parentHeight: number;
  onDismiss: () => void;
  hidden?: boolean;
  onHide?: () => void;
  retryHint?: string;
  safeAreaBottom?: number;
}

export default function TutorialSpotlight({
  step,
  zoneRect,
  parentHeight,
  onDismiss,
  hidden = false,
  onHide,
  retryHint,
  safeAreaBottom = 0,
}: Props) {
  const palette = useTilePalette();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: FADE_MS,
      useNativeDriver: true,
    }).start();
  }, [step.id, opacity]);

  const { width: screenW } = Dimensions.get('window');
  const containerH = parentHeight || Dimensions.get('window').height;

  // Cutout rect (with padding), or null for no-spotlight steps
  const cut = zoneRect
    ? {
        x: Math.max(0, zoneRect.x - CUTOUT_PAD),
        y: Math.max(0, zoneRect.y - CUTOUT_PAD),
        w: zoneRect.width + CUTOUT_PAD * 2,
        h: zoneRect.height + CUTOUT_PAD * 2,
      }
    : null;

  // Decide card position: above or below the cutout
  const cardPosition = (() => {
    if (!cut) return 'center' as const;
    const spaceAbove = cut.y;
    const spaceBelow = containerH - (cut.y + cut.h);
    return spaceBelow >= spaceAbove ? ('below' as const) : ('above' as const);
  })();

  const cardStyle: Record<string, number> = {
    left: 16,
    right: 16,
  };
  if (cardPosition === 'below' && cut) {
    cardStyle.top = cut.y + cut.h + CARD_MARGIN;
    cardStyle.maxHeight = containerH - cardStyle.top - safeAreaBottom - CARD_MARGIN;
  } else if (cardPosition === 'above' && cut) {
    cardStyle.bottom = containerH - cut.y + CARD_MARGIN;
  } else {
    // center — no cutout
    cardStyle.bottom = containerH * 0.35;
  }

  if (hidden) return null;

  return (
    <Animated.View
      style={[styles.root, { opacity, height: containerH }]}
      pointerEvents="box-none"
    >
      {cut && (
        <>
          {/* Top panel */}
          <View
            pointerEvents="none"
            style={[
              styles.backdrop,
              { top: 0, left: 0, right: 0, height: Math.max(0, cut.y) },
            ]}
          />
          {/* Bottom panel */}
          <View
            pointerEvents="none"
            style={[
              styles.backdrop,
              { top: cut.y + cut.h, left: 0, right: 0, bottom: 0 },
            ]}
          />
          {/* Left panel */}
          <View
            pointerEvents="none"
            style={[
              styles.backdrop,
              {
                top: cut.y,
                left: 0,
                width: Math.max(0, cut.x),
                height: cut.h,
              },
            ]}
          />
          {/* Right panel */}
          <View
            pointerEvents="none"
            style={[
              styles.backdrop,
              {
                top: cut.y,
                left: cut.x + cut.w,
                right: 0,
                height: cut.h,
              },
            ]}
          />
          {/* Cutout border */}
          <View
            pointerEvents="none"
            style={[
              styles.cutoutBorder,
              {
                top: cut.y - 1,
                left: cut.x - 1,
                width: cut.w + 2,
                height: cut.h + 2,
              },
            ]}
          />
        </>
      )}

      {/* Hint card */}
      <View style={[styles.card, cardPosition === 'center' && styles.cardCenter, cardStyle]}>
        <ScrollView bounces={false} nestedScrollEnabled showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
          {step.hint.title ? (
            <Text style={styles.title}>{step.hint.title}</Text>
          ) : null}
          <Text style={styles.body}>
            {parseTutorialBody(step.hint.body).map((seg, i) =>
              seg.type === 'text' ? (
                <Text key={i}>{seg.value}</Text>
              ) : (
                <Text
                  key={i}
                  style={{ color: palette[seg.paletteKey].bg, fontSize: 24 }}
                >
                  {'\u25A0'}
                </Text>
              ),
            )}
          </Text>
          {retryHint ? <Text style={styles.retryHint}>{retryHint}</Text> : null}
          <View style={styles.buttonRow}>
            {!step.hint.isAction && (
              <Pressable
                style={styles.primaryButton}
                onPress={onDismiss}
                accessibilityRole="button"
                accessibilityLabel="Got it"
              >
                <Text style={styles.primaryButtonText}>Got it!</Text>
              </Pressable>
            )}
            {step.hint.isAction && (
              <Pressable
                style={styles.primaryButton}
                onPress={onHide}
                accessibilityRole="button"
                accessibilityLabel="Go"
              >
                <Text style={styles.primaryButtonText}>Go</Text>
              </Pressable>
            )}
            {!step.hint.isAction && (
              <Pressable
                style={styles.closeButton}
                onPress={onDismiss}
                accessibilityRole="button"
                accessibilityLabel="Dismiss hint"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  backdrop: {
    position: 'absolute',
    backgroundColor: BACKDROP_COLOR,
  },
  cutoutBorder: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    borderRadius: 6,
  },
  card: {
    position: 'absolute',
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  cardCenter: {
    alignSelf: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1c1b21',
  },
  body: {
    fontSize: 14,
    color: '#444',
    lineHeight: 22,
    paddingBottom: 2,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 4,
  },
  primaryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#E7131A',
    borderRadius: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#888',
  },
  retryHint: {
    fontSize: 13,
    color: '#E7131A',
    fontWeight: '600',
  },
});
