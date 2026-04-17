/**
 * src/screens/TitleScreen.tsx
 * ---------------------------------------------
 * Entry screen: name, API key, Test Connection, Continue to Lobby.
 * When USE_ATLANTIC_SKIN=true, uses Atlantic preview look (light bg, header, footer).
 */

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { pingServer } from '@lib/api';
import { USE_ATLANTIC_SKIN } from '@src/flags';
import { RootStackParamList } from '@src/navigation/AppNavigator';
import useSessionStore from '@stores/sessionStore';
import useUIStore from '@stores/uiStore';
import useUserStore from '@stores/userStore';
import { DESIGN_TOKEN_SETS } from '@src/theme/designTokens';
import ScreenFrame from '@ui/ScreenFrame';

type TitleNav = NativeStackNavigationProp<RootStackParamList, 'Title'>;

const t = DESIGN_TOKEN_SETS.atlantic;

function AtlanticHeader({ darkModeEnabled = false }: { darkModeEnabled?: boolean }): React.JSX.Element {
  const gear = (
    <Image source={require('../../assets/design/icons/GearE1713A.png')} style={atlanticStyles.headerIcon} />
  );
  return (
    <View style={[atlanticStyles.header, darkModeEnabled && { borderColor: '#2d2d2d' }]}>
      <View style={[atlanticStyles.brandCircle, darkModeEnabled && { borderColor: '#E7131A' }]}>
        <Text style={atlanticStyles.brandLetter}>AB</Text>
      </View>
      <Text style={[atlanticStyles.headerTitle, darkModeEnabled && { color: '#f2f2f2' }]}>CROS<Text style={{ color: '#E7131A' }}>S</Text>WORD<Text style={{ color: '#E7131A' }}>S</Text></Text>
      {gear}
    </View>
  );
}

const atlanticStyles = StyleSheet.create({
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
  statusOk: { color: '#1a7f37' },
  statusError: { color: '#b00000' },
  statusButton: {
    borderWidth: 2,
    borderColor: '#1e1e1e',
    paddingVertical: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  statusButtonText: { fontFamily: t.typography.displayFamily, fontSize: 16, color: '#1e1e1e' },
  autoLoginText: { fontFamily: t.typography.bodyFamily, fontSize: 12, color: '#777', marginTop: 4 },
  autoLoginError: { color: '#b00000' },
  ctaBlock: { gap: 10 },
  continueButton: {
    backgroundColor: '#e89ca6',
    paddingVertical: 12,
    alignItems: 'center',
  },
  continueButtonText: { fontFamily: t.typography.displayFamily, fontSize: 16, color: '#fff' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderColor: '#eaeaea',
  },
  footerIcon: { width: 24, height: 24 },
  footerText: { fontFamily: t.typography.displayFamily, fontSize: 12, letterSpacing: 1, color: '#777' },
});

type InputFieldProps = {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  helperText?: string;
};

const InputField = ({ placeholder, value, onChangeText, helperText }: InputFieldProps): React.JSX.Element => (
  <View style={{ gap: 6 }}>
    <TextInput
      placeholder={placeholder}
      placeholderTextColor={stylesTokens.placeholder}
      value={value}
      onChangeText={onChangeText}
      style={styles.input}
    />
    {helperText ? <Text style={styles.helper}>{helperText}</Text> : null}
  </View>
);

type StatusBoxProps = {
  status: string | null;
  error: string | null;
  isPinging: boolean;
  onTestPress: () => void;
};

const StatusBox = ({ status, error, isPinging, onTestPress }: StatusBoxProps): React.JSX.Element => {
  const displayText = error ?? status ?? 'Disconnected';
  return (
    <View style={styles.statusCard}>
      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>SERVER STATUS</Text>
        <Text style={[styles.statusValue, error ? styles.statusError : status ? styles.statusOk : styles.statusMuted]}>
          {displayText}
        </Text>
      </View>
      <Pressable
        onPress={onTestPress}
        disabled={isPinging}
        style={({ pressed }) => [
          styles.statusButton,
          { opacity: pressed ? 0.9 : 1 },
          isPinging && { opacity: 0.7 },
        ]}
      >
        {isPinging ? <ActivityIndicator size="small" color="#222" /> : null}
        <Text style={styles.statusButtonText}>{isPinging ? 'Testing…' : 'Check server status'}</Text>
      </Pressable>
    </View>
  );
};

export default function TitleScreen(): React.JSX.Element {
  const navigation = useNavigation<TitleNav>();
  const { username, setUsername } = useUserStore();
  const { apiKey, setApiKey, isAutoLoginInFlight, autoLoginError } = useSessionStore();
  const darkModeEnabled = useUIStore((s) => s.darkModeEnabled);

  // ─── First-launch tutorial redirect ───────────────────────
  const hasCompletedTutorial = useUIStore((s) => s.hasCompletedTutorial);
  const uiHydrated = useUIStore((s) => s._hydrated);
  const hasCheckedTutorial = useRef(false);
  useEffect(() => {
    if (!uiHydrated || hasCheckedTutorial.current) return;
    hasCheckedTutorial.current = true;
    if (!hasCompletedTutorial) {
      navigation.navigate('Tutorial', { firstLaunch: true } as any);
    }
  }, [uiHydrated, hasCompletedTutorial, navigation]);

  const [isPinging, setIsPinging] = useState(false);
  const [lastStatus, setLastStatus] = useState<string | null>(null);
  const [pingErrorMessage, setPingErrorMessage] = useState<string | null>(null);

  const canContinue = username.trim().length > 0;

  const handleTestConnection = useCallback(async () => {
    setIsPinging(true);
    setPingErrorMessage(null);
    setLastStatus(null);
    const result = await pingServer();
    if (result.ok) {
      setLastStatus(`Online (${result.latencyMs} ms)`);
      setPingErrorMessage(null);
    } else {
      setLastStatus(null);
      setPingErrorMessage(`Offline: ${result.error}`);
    }
    setIsPinging(false);
  }, []);

  const handleContinue = useCallback(() => {
    if (!canContinue) return;
    navigation.navigate('Lobby');
  }, [canContinue, navigation]);

  // Atlantic skin: light layout matching AtlanticWelcomePreview, wired to real logic
  if (USE_ATLANTIC_SKIN) {
    const displayText = pingErrorMessage ?? lastStatus ?? 'Disconnected';
    const bg = darkModeEnabled ? '#121212' : '#fdfdfd';
    const title = darkModeEnabled ? '#f2f2f2' : '#000';
    const sub = darkModeEnabled ? '#b0b0b0' : '#666';
    const inputBg = darkModeEnabled ? '#202020' : '#fff';
    const inputBorder = darkModeEnabled ? '#2d2d2d' : '#d7d7d7';
    return (
      <SafeAreaView style={[atlanticStyles.screen, { backgroundColor: bg }]}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={[atlanticStyles.scroll, { backgroundColor: bg }]} keyboardShouldPersistTaps="handled">
            <AtlanticHeader darkModeEnabled={darkModeEnabled} />
            <View style={atlanticStyles.heroBlock}>
              <Text style={[atlanticStyles.heroTitle, { color: title }]}>Welcome</Text>
              <Text style={[atlanticStyles.heroSubtitle, { color: sub }]}>Enter your details to begin</Text>
            </View>
            <View style={atlanticStyles.fieldBlock}>
              <Text style={[atlanticStyles.label, { color: title }]}>DISPLAY NAME</Text>
              <TextInput
                style={[atlanticStyles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: title }]}
                placeholder="Enter your name"
                placeholderTextColor={sub}
                value={username}
                onChangeText={setUsername}
              />
            </View>
            <View style={atlanticStyles.fieldBlock}>
              <Text style={[atlanticStyles.label, { color: title }]}>API KEY</Text>
              <TextInput
                style={[atlanticStyles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: title }]}
                placeholder="Enter your API key"
                placeholderTextColor={sub}
                value={apiKey}
                onChangeText={setApiKey}
              />
              <Text style={[atlanticStyles.helper, { color: sub }]}>Optional: Required for online play</Text>
            </View>
            <View style={atlanticStyles.statusCard}>
              <View style={atlanticStyles.statusRow}>
                <Text style={atlanticStyles.statusLabel}>SERVER STATUS</Text>
                <Text
                  style={[
                    atlanticStyles.statusValue,
                    pingErrorMessage ? atlanticStyles.statusError : lastStatus ? atlanticStyles.statusOk : null,
                  ]}
                >
                  {displayText}
                </Text>
              </View>
              <Pressable
                onPress={handleTestConnection}
                disabled={isPinging}
                style={({ pressed }) => [atlanticStyles.statusButton, pressed && { opacity: 0.9 }, isPinging && { opacity: 0.7 }]}
              >
                {isPinging ? <ActivityIndicator size="small" color="#1e1e1e" /> : null}
                <Text style={atlanticStyles.statusButtonText}>
                  {isPinging ? 'Testing…' : 'Check server status'}
                </Text>
              </Pressable>
            </View>
            {isAutoLoginInFlight ? (
              <Text style={atlanticStyles.autoLoginText}>Signing in…</Text>
            ) : autoLoginError ? (
              <Text style={[atlanticStyles.autoLoginText, atlanticStyles.autoLoginError]}>
                Auto-login failed: {autoLoginError}
              </Text>
            ) : null}
            <View style={atlanticStyles.ctaBlock}>
              <Pressable
                onPress={handleContinue}
                disabled={!canContinue}
                style={({ pressed }) => [
                  atlanticStyles.continueButton,
                  { opacity: canContinue ? (pressed ? 0.9 : 1) : 0.5 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Continue to Lobby"
              >
                <Text style={atlanticStyles.continueButtonText}>Continue to Lobby</Text>
              </Pressable>
            </View>
            <View style={atlanticStyles.footer}>
              <Image
                source={require('../../assets/design/icons/BluePrintBurgernotext_centered.png')}
                style={atlanticStyles.footerIcon}
              />
              <Text style={atlanticStyles.footerText}>ARTISAN BEEF DESIGNS • 2026</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Classic layout (original)
  return (
    <ScreenFrame edgeToEdge>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.screen}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.heroBlock}>
              <Text accessibilityRole="header" style={styles.hero}>
                Enter your details to begin
              </Text>
            </View>

            <View style={styles.form}>
              <InputField
                placeholder="Enter your name"
                value={username}
                onChangeText={setUsername}
              />
              <InputField
                placeholder="Enter your API key"
                value={apiKey}
                onChangeText={setApiKey}
                helperText="Optional: Required for online play"
              />
              <StatusBox
                status={lastStatus}
                error={pingErrorMessage}
                isPinging={isPinging}
                onTestPress={handleTestConnection}
              />
              {isAutoLoginInFlight ? (
                <Text style={styles.autoLoginText}>Signing in…</Text>
              ) : autoLoginError ? (
                <Text style={[styles.autoLoginText, styles.autoLoginError]}>
                  Auto-login failed: {autoLoginError}
                </Text>
              ) : null}
            </View>
          </ScrollView>

          <View style={styles.ctaBlock}>
            <Pressable
              onPress={handleContinue}
              disabled={!canContinue}
              style={({ pressed }) => [
                styles.primaryButton,
                { opacity: canContinue ? (pressed ? 0.9 : 1) : 0.5 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Continue to Lobby"
            >
              <Text style={styles.primaryButtonText}>Continue to Lobby</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenFrame>
  );
}

const stylesTokens = {
  background: '#000000',
  card: '#f2f2f2',
  inputBorder: '#d5d5d5',
  inputText: '#5a5a5a',
  placeholder: '#7a7a7a',
  helper: '#565656',
  statusText: '#2c2c2c',
  statusMuted: '#6a6a6a',
  red: '#d30000',
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: stylesTokens.background },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 40, paddingBottom: 16, gap: 32 },
  heroBlock: { alignItems: 'center', marginBottom: 12 },
  hero: { fontSize: 22, color: stylesTokens.statusMuted, textAlign: 'center' },
  form: { gap: 28 },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: stylesTokens.inputBorder,
    borderRadius: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 20,
    color: stylesTokens.inputText,
  },
  helper: { fontSize: 14, color: stylesTokens.helper },
  statusCard: { backgroundColor: stylesTokens.card, paddingVertical: 18, paddingHorizontal: 16, gap: 14 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusLabel: { fontSize: 14, letterSpacing: 1.4, color: stylesTokens.statusText },
  statusValue: { fontSize: 20, color: stylesTokens.statusText },
  statusOk: { color: '#1a7f37' },
  statusError: { color: '#b00000' },
  statusMuted: { color: stylesTokens.statusMuted },
  statusButton: {
    borderWidth: 2,
    borderColor: '#1e1e1e',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusButtonText: { fontSize: 20, color: '#1e1e1e' },
  statusFeedback: { fontSize: 14, color: stylesTokens.statusText },
  autoLoginText: { fontSize: 12, color: stylesTokens.statusMuted, marginTop: 4 },
  autoLoginError: { color: '#b00000' },
  ctaBlock: { paddingHorizontal: 24, paddingBottom: 24, gap: 12 },
  primaryButton: { backgroundColor: stylesTokens.red, paddingVertical: 14, alignItems: 'center' },
  primaryButtonText: { fontSize: 20, color: '#ffffff' },
});
