/**
 * src/ui/ScreenFrame.tsx
 * -----------------------------------------------------------
 * Beginner-friendly wrapper that applies the active design tokens
 * to each screen. We centralize background colors, padding, and
 * safe-area handling so Title/Lobby/Board can focus on gameplay.
 *
 * Props:
 * - children: whatever content the screen renders inside the frame.
 *
 * Later we can extend this component to support themed backgrounds,
 * gradients, or scrollable variants without rewriting every screen.
 */
import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useUIStore from '@stores/uiStore';

type ScreenFrameProps = ViewProps & {
  children: React.ReactNode;
  /** When true, content hugs the device edges (only safe-area padding remains). */
  edgeToEdge?: boolean;
};

export default function ScreenFrame({
  children,
  style,
  edgeToEdge = false,
  ...rest
}: ScreenFrameProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const tokens = useUIStore((state) => state.designTokens);

  /**
   * We merge safe-area padding with themed spacing numbers so the layout
   * hugs the device edges on phones with notches or gesture bars.
   */
  const containerStyle = [
    styles.base,
    edgeToEdge && styles.edgeToEdgeBase,
    {
      backgroundColor: tokens.colors.screenBackground,
      paddingTop: edgeToEdge ? insets.top : Math.max(insets.top, tokens.spacing.lg),
      paddingBottom: edgeToEdge ? insets.bottom : Math.max(insets.bottom, tokens.spacing.lg),
      paddingLeft: edgeToEdge ? insets.left : tokens.spacing.md,
      paddingRight: edgeToEdge ? insets.right : tokens.spacing.md,
    },
    style,
  ];

  return (
    <View style={containerStyle} {...rest}>
      <View
        style={[
          styles.surface,
          {
            backgroundColor: tokens.colors.canvas,
            borderRadius: edgeToEdge ? 0 : tokens.radii.lg,
            padding: edgeToEdge ? 0 : tokens.spacing.sm,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    justifyContent: 'center',
  },
  edgeToEdgeBase: {
    justifyContent: 'flex-start',
  },
  surface: {
    flex: 1,
    overflow: 'hidden',
  },
});
