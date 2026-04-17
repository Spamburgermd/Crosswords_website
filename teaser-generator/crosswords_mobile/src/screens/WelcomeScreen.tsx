/**
 * src/screens/WelcomeScreen.tsx
 * -------------------------------------------------------------
 * Figma-aligned welcome/setup screen.
 * - Black backdrop, centered heading
 * - Two white input bars (name + API key) with serif styling
 * - Helper line under API key
 * - Status card with outlined "Test Connection"
 * - Single red "Continue to Lobby" button
 */

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { pingServer } from '@lib/api';
import { RootStackParamList } from '@src/navigation/AppNavigator';
import useSessionStore from '@stores/sessionStore';
import useUserStore from '@stores/userStore';
import ScreenFrame from '@ui/ScreenFrame';

type WelcomeNav = NativeStackNavigationProp<RootStackParamList>;

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

const Footer = (): React.JSX.Element => (
  <View style={styles.footer}>
    <Text style={styles.footerText}>The Atlantic • 2026</Text>
  </View>
);

export default function WelcomeScreen(): React.JSX.Element {
  const navigation = useNavigation<WelcomeNav>();
  const { username, setUsername } = useUserStore();
  const { apiKey, setApiKey } = useSessionStore();

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
            >
              <Text style={styles.primaryButtonText}>Continue to Lobby</Text>
            </Pressable>
          </View>

          <Footer />

        </View>
      </KeyboardAvoidingView>
    </ScreenFrame>
  );
}

// Style tokens derived from the provided Figma snapshot
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
  screen: {
    flex: 1,
    backgroundColor: stylesTokens.background,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 16,
    gap: 32,
  },
  heroBlock: {
    alignItems: 'center',
    marginBottom: 12,
  },
  hero: {
    fontSize: 22,
    color: stylesTokens.statusMuted,
    fontFamily: 'LibreBaskerville_700Bold',
    textAlign: 'center',
  },
  form: {
    gap: 28,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: stylesTokens.inputBorder,
    borderRadius: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 20,
    color: stylesTokens.inputText,
    fontFamily: 'LibreBaskerville_400Regular',
  },
  helper: {
    fontSize: 14,
    color: stylesTokens.helper,
    fontFamily: 'LibreBaskerville_700Bold',
  },
  statusCard: {
    backgroundColor: stylesTokens.card,
    paddingVertical: 18,
    paddingHorizontal: 16,
    gap: 14,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 14,
    letterSpacing: 1.4,
    color: stylesTokens.statusText,
    fontFamily: 'LibreBaskerville_700Bold',
  },
  statusValue: {
    fontSize: 20,
    color: stylesTokens.statusText,
    fontFamily: 'LibreBaskerville_400Regular',
  },
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
  statusButtonText: {
    fontSize: 20,
    color: '#1e1e1e',
    fontFamily: 'LibreBaskerville_700Bold',
  },
  statusFeedback: {
    fontSize: 14,
    color: stylesTokens.statusText,
    fontFamily: 'LibreBaskerville_400Regular',
  },
  ctaBlock: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: stylesTokens.red,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 20,
    color: '#ffffff',
    fontFamily: 'LibreBaskerville_700Bold',
  },
  footer: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: stylesTokens.statusMuted,
    letterSpacing: 1.5,
    fontFamily: 'LibreBaskerville_700Bold',
  },
});
