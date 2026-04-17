import React from 'react';
import { StyleSheet, View } from 'react-native';

import colors from '../theme/colors';

type RopeRuleProps = {
  thin?: boolean;
};

export default function RopeRule({ thin }: RopeRuleProps): React.JSX.Element {
  return <View style={[styles.base, thin && styles.thin]} />;
}

const styles = StyleSheet.create({
  base: {
    height: 2,
    borderRadius: 999,
    backgroundColor: colors.rope,
    opacity: 1,
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 0,
    elevation: 2,
    marginVertical: 6,
  },
  thin: {
    height: 2,
  },
});
