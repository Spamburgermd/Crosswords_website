// crosswords_mobile/src/screens/tutorial/TutorialOverlay.tsx
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { TutorialStep } from './types';
import { parseTutorialBody } from './parseTutorialBody';
import { useTilePalette } from '../../theme/tilePalette';

interface Props {
  step: TutorialStep
  onDismiss: () => void
}

export default function TutorialOverlay({ step, onDismiss }: Props) {
  const palette = useTilePalette();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [step.id]);   // re-run when step changes so each hint fades in

  return (
    <Animated.View style={[styles.backdrop, { opacity }]} pointerEvents="box-none">
      <View style={styles.card}>
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
                style={{ color: palette[seg.paletteKey].bg, fontSize: 16 }}
              >
                {'\u25A0'}
              </Text>
            ),
          )}
        </Text>
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
          <Pressable
            style={styles.closeButton}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Dismiss hint"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
    paddingBottom: 180,   // float above keyboard
    paddingHorizontal: 16,
  },
  card: {
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
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1c1b21',
  },
  body: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
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
});
