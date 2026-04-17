/**
 * PreviewMenuScreen.tsx
 * -------------------------------------------------------------
 * Simple in-app menu to open Atlantic preview mocks without relying
 * on env flags. DEV-only entry point.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';

import type { PreviewStackParamList } from '@src/preview/PreviewNavigator';

type Nav = NativeStackNavigationProp<PreviewStackParamList, 'PreviewMenu'>;

type PreviewRoute = Exclude<keyof PreviewStackParamList, 'PreviewMenu'>;

const items: { label: string; route: PreviewRoute }[] = [
  { label: 'Atlantic Welcome Preview', route: 'Welcome' },
  { label: 'Atlantic Lobby Preview', route: 'Lobby' },
  { label: 'Atlantic Board Preview', route: 'Board' },
  { label: 'Atlantic Friends Preview', route: 'Friends' },
  { label: 'Atlantic Settings Preview', route: 'Settings' },
  { label: 'Atlantic Outcome Preview', route: 'Outcome' },
];

export default function PreviewMenuScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.title}>Preview Menu</Text>
      <View style={{ gap: 12 }}>
        {items.map((item) => (
          <Pressable
            key={item.route}
            onPress={() => navigation.navigate(item.route)}
            style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.buttonText}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable
        onPress={() => navigation.goBack()}
        style={({ pressed }) => [styles.back, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.backText}>Back</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000',
    padding: 20,
    gap: 20,
  },
  title: {
    fontSize: 22,
    color: '#fff',
    fontWeight: '700',
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: '#E7131A',
    borderRadius: 6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  back: {
    marginTop: 20,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#fff',
    borderRadius: 6,
  },
  backText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
  },
});
