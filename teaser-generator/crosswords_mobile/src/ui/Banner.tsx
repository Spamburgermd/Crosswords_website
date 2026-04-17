import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import colors from '../theme/colors';

type BannerProps = {
  title: string;
  subtitle?: string;
};

export default function Banner({ title, subtitle }: BannerProps): React.JSX.Element {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderWidth: 2,
    borderColor: colors.rope,
    borderRadius: 0,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 0,
    elevation: 3,
    marginVertical: 8,
  },
  title: {
    fontFamily: 'CinzelDecorative_700Bold',
    fontSize: 28,
    color: colors.ink,
    letterSpacing: 1,
  },
  subtitle: {
    fontFamily: 'LibreBaskerville_400Regular',
    fontSize: 14,
    color: colors.muted,
    marginTop: 4,
  },
});
