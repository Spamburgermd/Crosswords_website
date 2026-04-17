/**
 * src/ui/HeaderChip.tsx
 * -----------------------------------------------------------
 * Displays the paired icon-label text blocks from the Crossroads
 * mock. Each chip can align left or right while reusing spacing,
 * typography, and colors from the active design tokens.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import useUIStore from '@stores/uiStore';

type HeaderChipProps = {
  /** Primary uppercase label (e.g., "Citizenware"). */
  label: string;
  /** Secondary descriptor shown underneath (e.g., "Fantasy"). */
  subLabel: string;
  /** Optional alignment toggle to mirror the design's right-justified chip. */
  align?: 'left' | 'right';
};

export default function HeaderChip({
  label,
  subLabel,
  align = 'left',
}: HeaderChipProps): React.JSX.Element {
  const tokens = useUIStore((state) => state.designTokens);
  const isRightAligned = align === 'right';

  return (
    <View
      style={[
        styles.wrap,
        {
          alignItems: isRightAligned ? 'flex-end' : 'flex-start',
          padding: tokens.spacing.xs,
          borderRadius: tokens.radii.sm,
          backgroundColor: 'transparent',
          borderColor: 'transparent',
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          {
            color: tokens.colors.textPrimary,
            fontFamily: tokens.typography.displayFamily,
            fontSize: tokens.typography.baseSize - 1,
          },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.subLabel,
          {
            color: tokens.colors.textSecondary,
            fontFamily: tokens.typography.bodyFamily,
            fontSize: tokens.typography.captionSize,
          },
        ]}
      >
        {subLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minWidth: 112,
  },
  label: {
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  subLabel: {
    marginTop: 2,
    letterSpacing: 1,
  },
});
