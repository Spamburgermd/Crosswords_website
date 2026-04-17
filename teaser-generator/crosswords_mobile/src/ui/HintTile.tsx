/**
 * src/ui/HintTile.tsx
 * -----------------------------------------------------------
 * Tiny square tile that mirrors the hint legend in the Crossroads
 * design. Helpful for preview cards and future guess-history views.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import useUIStore from '@stores/uiStore';

type HintStatus = 'correct' | 'present' | 'absent';

type HintTileProps = {
  /** Single character to display inside the tile. */
  letter: string;
  /** Determines the tile color (green / yellow / red). */
  status: HintStatus;
};

export default function HintTile({ letter, status }: HintTileProps): React.JSX.Element {
  const tokens = useUIStore((state) => state.designTokens);

  const backgroundColor =
    status === 'correct'
      ? tokens.colors.success
      : status === 'present'
        ? tokens.colors.warning
        : tokens.colors.danger;
  const textColor = status === 'present' ? '#111111' : tokens.colors.canvas;

  return (
    <View
      accessible
      accessibilityLabel={`${letter} ${status}`}
      style={[
        styles.tile,
        {
          backgroundColor,
          borderRadius: tokens.radii.sm,
          shadowColor: tokens.shadows.soft.color,
          shadowOffset: tokens.shadows.soft.offset,
          shadowOpacity: tokens.shadows.soft.opacity,
          shadowRadius: tokens.shadows.soft.radius,
        },
      ]}
    >
      <Text
        style={{
          color: textColor,
          fontFamily: tokens.typography.displayFamily,
          fontSize: tokens.typography.baseSize,
        }}
      >
        {letter}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 48,
    height: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

