/**
 * AtlanticLobbyPreview.tsx
 * -------------------------------------------------------------
 * Static mock of the Atlantic-styled Lobby screen (Create/Join only).
 * No backend calls; purely visual for review.
 */
import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { DESIGN_TOKEN_SETS } from '@src/theme/designTokens';
import type { PreviewStackParamList } from '@src/preview/PreviewNavigator';

const t = DESIGN_TOKEN_SETS.atlantic;

export default function AtlanticLobbyPreview(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<PreviewStackParamList, 'Lobby'>>();

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Header onGearPress={() => navigation.navigate('Settings')} />

        <TabRow onFriendsPress={() => navigation.navigate('Friends')} />

        <Card>
          <Text style={styles.sectionTitle}>Create Game</Text>
          <Divider />

          <View style={styles.rowBetween}>
            <Text style={styles.inlineLabel}>PLAY VS BOT</Text>
            <Switch value={false} />
          </View>

          <Text style={styles.inlineLabel}>YOUR 5 WORDS (4–6 LETTERS)</Text>
          {Array.from({ length: 5 }).map((_, idx) => (
            <TextInput
              key={idx}
              style={styles.input}
              placeholder={`WORD ${idx + 1}`}
              placeholderTextColor="#888"
            />
          ))}

          <View style={styles.buttonMuted}>
            <Text style={styles.buttonMutedText}>Submit Words</Text>
          </View>
          <View style={styles.buttonSecondary}>
            <Text style={styles.buttonSecondaryText}>Create Game</Text>
          </View>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Join Game</Text>
          <Divider />
          <Text style={styles.inlineLabel}>GAME ID</Text>
          <TextInput style={styles.input} placeholder="Enter 6-digit code" placeholderTextColor="#888" />
          <View style={styles.buttonOutline}>
            <Text style={styles.buttonOutlineText}>#   Join Game</Text>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ onGearPress }: { onGearPress?: () => void }): React.JSX.Element {
  const gear = (
    <Image source={require('../../../assets/design/icons/GearE1713A.png')} style={styles.headerIconImage} />
  );
  return (
    <View style={styles.header}>
      <View style={styles.brandCircle}>
        <Text style={styles.brandLetter}>A</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle}>Lobby</Text>
        <Text style={styles.headerSub}>xxx</Text>
      </View>
      {onGearPress ? (
        <Pressable onPress={onGearPress} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
          {gear}
        </Pressable>
      ) : (
        gear
      )}
      <Text style={styles.headerIcon}>↻</Text>
    </View>
  );
}

function TabRow({ onFriendsPress }: { onFriendsPress?: () => void }): React.JSX.Element {
  return (
    <View style={styles.tabRow}>
      <Pressable
        onPress={onFriendsPress}
        style={({ pressed }) => [styles.tab, styles.tabInactive, pressed && onFriendsPress && { opacity: 0.8 }]}
        disabled={!onFriendsPress}
      >
        <Text style={styles.tabText}>Friends</Text>
      </Pressable>
      <View style={[styles.tab, styles.tabActive]}>
        <Text style={styles.tabTextActive}>Quick Play</Text>
      </View>
    </View>
  );
}

function Divider(): React.JSX.Element {
  return <View style={styles.divider} />;
}

function Card({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fdfdfd' },
  scroll: { padding: 16, gap: 16, paddingBottom: 32 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderColor: '#e2e2e2',
  },
  brandCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: t.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLetter: { color: t.colors.accent, fontFamily: t.typography.displayFamily, fontSize: 16 },
  headerTitle: { fontFamily: t.typography.displayFamily, fontSize: 18, color: '#000' },
  headerSub: { fontFamily: t.typography.bodyFamily, fontSize: 12, color: '#777' },
  headerIcon: { fontSize: 18, marginLeft: 8 },
  headerIconImage: { width: 20, height: 20 },
  tabRow: { flexDirection: 'row', gap: 10 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderWidth: 1, borderColor: '#1e1e1e' },
  tabInactive: { backgroundColor: '#fff' },
  tabActive: { backgroundColor: t.colors.accent },
  tabText: { fontFamily: t.typography.displayFamily, fontSize: 14, color: '#000' },
  tabTextActive: { fontFamily: t.typography.displayFamily, fontSize: 14, color: '#fff' },
  card: {
    backgroundColor: '#fff',
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e2e2',
    gap: 12,
  },
  sectionTitle: { fontFamily: t.typography.displayFamily, fontSize: 18, color: '#000' },
  divider: { borderBottomWidth: 1, borderColor: '#e4e4e4' },
  inlineLabel: {
    fontFamily: t.typography.displayFamily,
    fontSize: 12,
    letterSpacing: 1,
    color: '#000',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d7d7d7',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: t.typography.bodyFamily,
    fontSize: 15,
    color: '#333',
  },
  buttonMuted: {
    backgroundColor: '#7f7f7f',
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonMutedText: { fontFamily: t.typography.displayFamily, fontSize: 16, color: '#fff' },
  buttonSecondary: {
    backgroundColor: '#e89ca6',
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonSecondaryText: { fontFamily: t.typography.displayFamily, fontSize: 16, color: '#fff' },
  buttonOutline: {
    borderWidth: 1,
    borderColor: '#1e1e1e',
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonOutlineText: { fontFamily: t.typography.displayFamily, fontSize: 16, color: '#1e1e1e' },
});
