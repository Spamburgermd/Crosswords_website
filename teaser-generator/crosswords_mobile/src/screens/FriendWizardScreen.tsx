/**
 * src/screens/FriendWizardScreen.tsx
 * -------------------------------------------------------------
 * PvP friend challenge wizard. Routes to ChallengeScreen.
 */
import React from 'react';
import { StyleSheet, Text, Pressable, View, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

import { DESIGN_TOKEN_SETS } from '@src/theme/designTokens';

const t = DESIGN_TOKEN_SETS.atlantic;
const LOBBY_ACCENT = '#E7131A';
const LOBBY_SCREEN_BG = '#fdfdfd';
const LOBBY_SURFACE = '#fff';
const LOBBY_BORDER = '#e2e2e2';
const LOBBY_DIVIDER = '#e4e4e4';
type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function FriendWizardScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => [styles.backIconBtn, pressed && { opacity: 0.75 }]}>
          <Image
            source={require('../../assets/design/icons/CWMotifRed.png')}
            style={styles.backIcon}
            resizeMode="contain"
          />
        </Pressable>
        <Text style={styles.title}>Challenge</Text>
      </View>

      {/* Create a challenge */}
      <View style={styles.card}>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>Create a Challenge</Text>
          <View style={styles.cardRule} />
          <Text style={styles.cardBody}>{'Challenge your opponent with your vocabulary.\n\n\'Unless the enemy has studied his Agrippa... which I have.\'\n— Inigo Montoya'}</Text>
          <Pressable
            onPress={() => (navigation as any).navigate('Challenge', { showOnly: 'create' })}
            style={({ pressed }) => [styles.button, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.buttonText}>Create Challenge</Text>
          </Pressable>
        </View>
      </View>

      {/* Blind Match */}
      <View style={[styles.card, { borderLeftColor: LOBBY_ACCENT, borderLeftWidth: 3 }]}>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>Blind Match</Text>
          <View style={styles.cardRule} />
          <Text style={styles.cardBody}>{'Same target words. Fastest player wins.\n\n"By night all cats are grey."\n— Sancho Panza, Don Quixote'}</Text>
          <Pressable
            onPress={() => (navigation as any).navigate('Challenge', { showOnly: 'blind' })}
            style={({ pressed }) => [styles.button, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.buttonText}>Blind Match</Text>
          </Pressable>
        </View>
      </View>

      {/* Enter a code */}
      <View style={styles.card}>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>Enter a Code</Text>
          <View style={styles.cardRule} />
          <Text style={styles.cardBody}>Got a code from a friend? Paste it to accept and start playing.</Text>
          <Pressable
            onPress={() => (navigation as any).navigate('Challenge', { showOnly: 'enter' })}
            style={({ pressed }) => [styles.buttonOutline, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.buttonOutlineText}>Enter Code</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: LOBBY_SCREEN_BG,
    padding: 20,
    gap: 16,
  },
  headerRow: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backIconBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    width: 40,
    height: 40,
    tintColor: LOBBY_ACCENT,
  },
  title: {
    fontFamily: t.typography.displayFamily,
    fontSize: t.typography.headingSize - 2,
    color: t.colors.textPrimary,
  },
  subtitle: {
    fontFamily: t.typography.bodyFamily,
    fontSize: t.typography.baseSize,
    color: t.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  card: {
    backgroundColor: LOBBY_SURFACE,
    borderRadius: 0,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: LOBBY_BORDER,
  },
  cardContent: {
    gap: 6,
    width: '100%',
  },
  cardTitle: {
    fontFamily: t.typography.displayFamily,
    fontSize: 18,
    color: '#000',
  },
  cardRule: {
    borderBottomWidth: 1,
    borderBottomColor: LOBBY_DIVIDER,
    marginTop: 2,
    marginBottom: 6,
  },
  cardBody: {
    fontFamily: t.typography.bodyFamily,
    fontSize: 12,
    color: '#444',
    lineHeight: 20,
  },
  button: {
    backgroundColor: LOBBY_ACCENT,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 0,
    marginTop: 6,
  },
  buttonText: {
    color: t.colors.accentText,
    fontFamily: t.typography.displayFamily,
    textAlign: 'center',
  },
  buttonOutline: {
    borderWidth: 1,
    borderColor: '#1e1e1e',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 0,
    backgroundColor: '#fff',
    marginTop: 6,
  },
  buttonOutlineText: {
    color: '#000',
    fontFamily: t.typography.displayFamily,
    textAlign: 'center',
  },
});
