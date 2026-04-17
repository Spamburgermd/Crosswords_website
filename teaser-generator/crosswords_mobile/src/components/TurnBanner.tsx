/**
 * src/components/TurnBanner.tsx
 * ---------------------------------------------
 * Displays whose turn it is inside the parchment toolbar.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import useUIStore from '@stores/uiStore';

export type TurnBannerProps = {
  isPlayersTurn: boolean;
  playerName: string;
  opponentName: string;
};

export default function TurnBanner({
  isPlayersTurn,
  playerName,
  opponentName,
}: TurnBannerProps): React.JSX.Element {
  const theme = useUIStore((state) => state.activeTheme);

  const headline = isPlayersTurn
    ? `Your turn, ${playerName}!`
    : `Waiting on ${opponentName}`;

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: isPlayersTurn ? theme.bannerActive : theme.bannerWaiting,
        },
      ]}
    >
      <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.bannerText, { color: theme.accentText }]}>
        {headline}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    minWidth: 0,
  },
  bannerText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.4,
    fontFamily: 'Cinzel-Regular',
  },
});

