/**
 * AtlanticWelcomePreview.tsx
 * -------------------------------------------------------------
 * Static mock of the Atlantic-styled Welcome screen.
 * No logic, no network calls—pure layout for visual review.
 */
import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { DESIGN_TOKEN_SETS } from '@src/theme/designTokens';
import type { PreviewStackParamList } from '@src/preview/PreviewNavigator';

const t = DESIGN_TOKEN_SETS.atlantic;

export default function AtlanticWelcomePreview(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<PreviewStackParamList, 'Welcome'>>();

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Header onGearPress={() => navigation.navigate('Settings')} />

        <View style={styles.heroBlock}>
          <Text style={styles.heroTitle}>Welcome</Text>
          <Text style={styles.heroSubtitle}>Enter your details to begin</Text>
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.label}>DISPLAY NAME</Text>
          <TextInput style={styles.input} placeholder="Enter your name" placeholderTextColor="#888" />
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.label}>API KEY</Text>
          <TextInput style={styles.input} placeholder="Enter your API key" placeholderTextColor="#888" />
          <Text style={styles.helper}>Optional: Required for online play</Text>
        </View>

        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>SERVER STATUS</Text>
            <Text style={styles.statusValue}>Disconnected</Text>
          </View>
          <View style={styles.statusButton}>
            <Text style={styles.statusButtonText}>Test Connection</Text>
          </View>
        </View>

        <View style={styles.ctaBlock}>
          <Pressable
            onPress={() => navigation.navigate('Lobby')}
            style={({ pressed }) => [styles.continueButton, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.continueButtonText}>Continue to Lobby</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => navigation.navigate('PreviewMenu')}
          style={({ pressed }) => [styles.previewMenuLink, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.previewMenuLinkText}>Preview all screens</Text>
        </Pressable>

        <View style={styles.footer}>
          <Image source={require('../../../assets/design/icons/BluePrintBurgernotext_centered.png')} style={styles.footerIcon} />
          <Text style={styles.footerText}>ARTISAN BEEF DESIGNS • 2026</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ onGearPress }: { onGearPress?: () => void }): React.JSX.Element {
  const gear = (
    <Image source={require('../../../assets/design/icons/GearE1713A.png')} style={styles.headerIcon} />
  );
  return (
    <View style={styles.header}>
      <View style={styles.brandCircle}>
        <Text style={styles.brandLetter}>AB</Text>
      </View>
      <Text style={styles.headerTitle}>CROS<Text style={{ color: '#E7131A' }}>S</Text>WORD<Text style={{ color: '#E7131A' }}>S</Text></Text>
      {onGearPress ? (
        <Pressable onPress={onGearPress} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
          {gear}
        </Pressable>
      ) : (
        gear
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fdfdfd' },
  scroll: { padding: 20, gap: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
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
  brandLetter: {
    fontFamily: t.typography.displayFamily,
    fontSize: 16,
    color: t.colors.accent,
  },
  headerTitle: {
    flex: 1,
    marginLeft: 10,
    fontFamily: 'CinzelDecorative_700Bold',
    fontSize: 18,
    color: '#000',
  },
  headerIcon: { width: 20, height: 20 },
  heroBlock: { alignItems: 'center', gap: 6, marginTop: 8 },
  heroTitle: { fontFamily: t.typography.displayFamily, fontSize: 26, color: '#000' },
  heroSubtitle: { fontFamily: t.typography.bodyFamily, fontSize: 15, color: '#666' },
  fieldBlock: { gap: 6 },
  label: {
    fontFamily: t.typography.displayFamily,
    fontSize: 12,
    letterSpacing: 1,
    color: '#000',
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
  helper: { fontFamily: t.typography.bodyFamily, fontSize: 12, color: '#777' },
  statusCard: {
    backgroundColor: '#f4f4f4',
    padding: 14,
    gap: 10,
  },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusLabel: {
    fontFamily: t.typography.displayFamily,
    fontSize: 12,
    letterSpacing: 1,
    color: '#000',
  },
  statusValue: { fontFamily: t.typography.bodyFamily, fontSize: 14, color: '#444' },
  statusButton: {
    borderWidth: 2,
    borderColor: '#1e1e1e',
    paddingVertical: 10,
    alignItems: 'center',
  },
  statusButtonText: { fontFamily: t.typography.displayFamily, fontSize: 16, color: '#1e1e1e' },
  ctaBlock: { gap: 10 },
  continueButton: {
    backgroundColor: '#e89ca6',
    paddingVertical: 12,
    alignItems: 'center',
  },
  continueButtonText: { fontFamily: t.typography.displayFamily, fontSize: 16, color: '#fff' },
  previewMenuLink: { alignItems: 'center', paddingVertical: 12 },
  previewMenuLinkText: { fontFamily: t.typography.bodyFamily, fontSize: 14, color: '#666', textDecorationLine: 'underline' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderTopWidth: 1, borderColor: '#eaeaea' },
  footerIcon: { width: 24, height: 24 },
  footerText: { fontFamily: t.typography.displayFamily, fontSize: 12, letterSpacing: 1, color: '#777' },
});
