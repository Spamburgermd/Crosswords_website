/**
 * AtlanticFriendsPreview.tsx
 * Static mock of the Friends screen using Atlantic styling.
 */
import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { DESIGN_TOKEN_SETS } from '@src/theme/designTokens';
import type { PreviewStackParamList } from '@src/preview/PreviewNavigator';

const t = DESIGN_TOKEN_SETS.atlantic;

const incoming = [{ name: 'Bob Wilson', time: '2:30 PM' }];
const pending = [{ name: 'Carol Davis', time: 'Sent 1:45 PM' }];
const friends = [
  { name: 'Jane Smith', id: 'user123', online: true },
  { name: 'John Doe', id: 'user456', online: false },
  { name: 'Alice Johnson', id: 'user789', online: true },
];

export default function AtlanticFriendsPreview(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<PreviewStackParamList, 'Friends'>>();

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Header title="Friends" onBack={() => navigation.navigate('Lobby')} />

        <Card title="ADD FRIEND">
          <View style={styles.inputRow}>
            <Text style={styles.placeholder}>Enter User ID</Text>
            <View style={styles.addButton}>
              <Text style={styles.addButtonText}>+</Text>
            </View>
          </View>
        </Card>

        <Card title={`INCOMING REQUESTS (${incoming.length})`}>
          {incoming.map((item) => (
            <ListRow key={item.name} primary={item.name} secondary={item.time} actions="accept-decline" />
          ))}
        </Card>

        <Card title={`PENDING REQUESTS (${pending.length})`}>
          {pending.map((item) => (
            <ListRow key={item.name} primary={item.name} secondary={item.time} actions="cancel" />
          ))}
        </Card>

        <Card title={`YOUR FRIENDS (${friends.length})`}>
          {friends.map((f) => (
            <ListRow
              key={f.id}
              primary={f.name}
              secondary={f.id}
              presence={f.online}
              actions="challenge-remove"
            />
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }): React.JSX.Element {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}>
        <Text style={styles.headerAction}>{'←'}</Text>
      </Pressable>
      <View style={styles.brandCircle}>
        <Text style={styles.brandLetter}>AB</Text>
      </View>
      <Text style={styles.headerTitle}>{title}</Text>
      <Text style={styles.headerSpacer} />
    </View>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <View style={{ gap: 12 }}>{children}</View>
    </View>
  );
}

function ListRow({
  primary,
  secondary,
  presence,
  actions,
}: {
  primary: string;
  secondary: string;
  presence?: boolean;
  actions: 'accept-decline' | 'cancel' | 'challenge-remove';
}): React.JSX.Element {
  return (
    <View style={styles.row}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
        {presence !== undefined ? (
          <View
            style={[
              styles.dot,
              { backgroundColor: presence ? '#2ecc71' : '#c0c0c0' },
            ]}
          />
        ) : null}
        <View>
          <Text style={styles.rowPrimary}>{primary}</Text>
          <Text style={styles.rowSecondary}>{secondary}</Text>
        </View>
      </View>
      <View style={styles.rowActions}>
        {actions === 'accept-decline' && (
          <>
            <SquareButton color="#3c8c3a" label="?" />
            <SquareButton color={t.colors.accent} label="?" />
          </>
        )}
        {actions === 'cancel' && <SquareButton color="#e0e0e0" label="?" textColor="#000" />}
        {actions === 'challenge-remove' && (
          <>
            <View style={styles.motifIconBox}>
              <Image source={require('../../../assets/design/icons/CWMotifRed.png')} style={styles.motifIcon} />
            </View>
            <SquareButton color="#000" label="??" textColor="#fff" />
          </>
        )}
      </View>
    </View>
  );
}

function SquareButton({
  color,
  label,
  textColor,
}: {
  color: string;
  label: string;
  textColor?: string;
}): React.JSX.Element {
  return (
    <View style={[styles.squareButton, { backgroundColor: color }]}>
      <Text style={[styles.squareButtonText, { color: textColor || '#fff' }]}>{label}</Text>
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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d7d7d7',
    paddingHorizontal: 10,
    height: 42,
  },
  placeholder: {
    flex: 1,
    color: '#8a8a8a',
    fontFamily: t.typography.bodyFamily,
  },
  addButton: {
    width: 36,
    height: 36,
    backgroundColor: t.colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    fontSize: 18,
    color: '#fff',
    fontFamily: t.typography.displayFamily,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowPrimary: {
    fontFamily: t.typography.displayFamily,
    fontSize: 14,
    color: '#000',
  },
  rowSecondary: {
    fontFamily: t.typography.bodyFamily,
    fontSize: 12,
    color: '#666',
  },
  rowActions: { flexDirection: 'row', gap: 8 },
  motifIconBox: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  motifIcon: { width: 24, height: 24 },
  squareButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  squareButtonText: {
    fontSize: 16,
    fontFamily: t.typography.displayFamily,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
