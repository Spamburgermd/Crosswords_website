/**
 * src/ui/SegmentButton.tsx
 * -----------------------------------------------------------
 * Mimics the segmented control buttons from the Crossroads design.
 * We expose an active state plus an optional onPress handler so the
 * same component can power both the gallery preview and real tabs.
 */
import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, StyleSheet, Text } from 'react-native';

import useUIStore from '@stores/uiStore';

type SegmentButtonProps = {
  /** Visible label inside the segment. */
  label: string;
  /** Whether this segment is the active option. */
  active?: boolean;
  /** Handler fired on tap. Optional for static previews. */
  onPress?: () => void;
  /** Optional style overrides so parent containers can control width. */
  style?: StyleProp<ViewStyle>;
  /** Visual variant. "bare" removes borders for use inside pill groups. */
  variant?: 'default' | 'bare';
};

export default function SegmentButton({
  label,
  active = false,
  onPress,
  style,
  variant = 'default',
}: SegmentButtonProps): React.JSX.Element {
  const tokens = useUIStore((state) => state.designTokens);

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        style,
        {
          backgroundColor:
            active
              ? tokens.colors.accent
              : variant === 'bare'
                ? 'transparent'
                : tokens.colors.surfacePrimary,
          borderColor:
            variant === 'bare'
              ? 'transparent'
              : active
                ? tokens.colors.accent
                : tokens.colors.borderSubtle,
          borderWidth: variant === 'bare' ? 0 : StyleSheet.hairlineWidth,
          borderRadius:
            variant === 'bare'
              ? active
                ? tokens.radii.sm
                : 0
              : tokens.radii.sm,
          paddingHorizontal: tokens.spacing.sm,
          paddingVertical: variant === 'bare' ? tokens.spacing.xs / 2 : tokens.spacing.xs,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <Text
        style={{
          color: active
            ? tokens.colors.accentText
            : variant === 'bare'
              ? tokens.colors.textPrimary
              : tokens.colors.textSecondary,
          fontFamily: tokens.typography.bodyFamily,
          fontSize: tokens.typography.baseSize - 2,
          letterSpacing: 1,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 0,
  },
});
