/**
 * AtlanticSettingsPreview.tsx
 * Static mock of the settings screen with Atlantic styling.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { DESIGN_TOKEN_SETS } from '@src/theme/designTokens';

const t = DESIGN_TOKEN_SETS.atlantic;

export default function AtlanticSettingsPreview(): React.JSX.Element {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Header onBack={() => navigation.goBack()} />

        <Card title="ACCOUNT">
          <InputBlock label="DISPLAY NAME" placeholder="Your name" />
          <InputBlock label="API KEY" placeholder="Your API key" helper="Required for online multiplayer features" />
        </Card>

        <Card title="PREFERENCES">
          <ToggleRow label="Notifications" helper="Receive game updates" value />
          <ToggleRow label="Sound Effects" helper="Play audio feedback" value />
          <ToggleRow label="Dark Mode" helper="Coming soon" value={false} disabled />
        </Card>

        <Card title="ABOUT">
          <InfoRow label="Version" value="1.0.0" />
          <InfoRow label="Publisher" value="Artisan Beef Designs" />
          <InfoRow label="Year" value="2026" />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ onBack }: { onBack: () => void }): React.JSX.Element {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}>
        <Text style={styles.headerAction}>{'←'}</Text>
      </Pressable>
      <View style={styles.brandCircle}>
        <Text style={styles.brandLetter}>AB</Text>
      </View>
      <Text style={styles.headerTitle}>Settings</Text>
      <Text style={styles.headerSpacer} />
    </View>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <View style={{ gap: 16 }}>{children}</View>
    </View>
  );
}

function InputBlock({
  label,
  placeholder,
  helper,
}: {
  label: string;
  placeholder: string;
  helper?: string;
}): React.JSX.Element {
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.blockLabel}>{label}</Text>
      <View style={styles.inputStub}>
        <Text style={styles.placeholder}>{placeholder}</Text>
      </View>
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
}

function ToggleRow({
  label,
  helper,
  value,
  disabled,
}: {
  label: string;
  helper?: string;
  value: boolean;
  disabled?: boolean;
}): React.JSX.Element {
  return (
    <View style={styles.toggleRow}>
      <View>
        <Text style={styles.rowLabel}>{label}</Text>
        {helper ? <Text style={styles.rowHelper}>{helper}</Text> : null}
      </View>
      <Switch value={value} disabled={disabled} />
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll: { flexGrow: 1, padding: 16, gap: 14 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderColor: '#e0e0e0',
  },
  headerAction: { fontSize: 18, color: '#000' },
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
  headerSpacer: { width: 24 },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#e6e6e6',
  },
  cardTitle: {
    fontFamily: t.typography.displayFamily,
    fontSize: 12,
    letterSpacing: 1,
    color: '#000',
  },
  blockLabel: {
    fontFamily: t.typography.displayFamily,
    fontSize: 12,
    letterSpacing: 1,
    color: '#000',
  },
  inputStub: {
    borderWidth: 1,
    borderColor: '#d7d7d7',
    paddingHorizontal: 10,
    height: 42,
    justifyContent: 'center',
  },
  placeholder: {
    color: '#8a8a8a',
    fontFamily: t.typography.bodyFamily,
  },
  helper: {
    fontSize: 12,
    color: '#777',
    fontFamily: t.typography.bodyFamily,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabel: {
    fontFamily: t.typography.displayFamily,
    fontSize: 14,
    color: '#000',
  },
  rowHelper: {
    fontFamily: t.typography.bodyFamily,
    fontSize: 12,
    color: '#666',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderColor: '#ececec',
  },
  rowValue: {
    fontFamily: t.typography.bodyFamily,
    fontSize: 14,
    color: '#000',
  },
});
