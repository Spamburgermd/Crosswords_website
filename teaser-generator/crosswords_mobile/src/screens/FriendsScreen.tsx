/**
 * src/screens/FriendsScreen.tsx
 * ---------------------------------------------
 * Friends manager: incoming/outgoing requests, friends list, add by user ID.
 * When USE_ATLANTIC_SKIN=true, uses Atlantic-styled layout. All logic preserved.
 */

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  challengeFriend,
  createFriendRequest,
  fetchFriendRequests,
  fetchFriends,
  removeFriend,
  respondFriendRequest,
} from '@lib/api';
import { USE_ATLANTIC_SKIN } from '@src/flags';
import { RootStackParamList } from '@src/navigation/AppNavigator';
import useSessionStore from '@stores/sessionStore';
import useUIStore from '@stores/uiStore';
import { DESIGN_TOKEN_SETS } from '@src/theme/designTokens';

type FriendsNav = NativeStackNavigationProp<RootStackParamList, 'Friends'>;

const t = DESIGN_TOKEN_SETS.atlantic;

export default function FriendsScreen(): React.JSX.Element {
  const apiKey = useSessionStore((state) => state.apiKey);
  const navigation = useNavigation<FriendsNav>();
  const designTokens = useUIStore((state) => state.designTokens);
  const darkModeEnabled = useUIStore((state) => state.darkModeEnabled);
  const queryClient = useQueryClient();
  const screenBg = darkModeEnabled ? '#121212' : '#f5f5f5';
  const cardBg = darkModeEnabled ? '#1b1b1b' : '#fff';
  const borderColor = darkModeEnabled ? '#2d2d2d' : '#e6e6e6';
  const titleColor = darkModeEnabled ? '#f2f2f2' : '#000';
  const textMuted = darkModeEnabled ? '#b0b0b0' : '#8a8a8a';

  const [newRequestId, setNewRequestId] = useState('');
  const hasCredentials = apiKey.trim().length > 0;

  const requestsQuery = useQuery({
    queryKey: ['friendRequests'],
    queryFn: () => fetchFriendRequests(apiKey, 'all'),
    enabled: hasCredentials,
  });

  const friendsQuery = useQuery({
    queryKey: ['friends'],
    queryFn: () => fetchFriends(apiKey),
    enabled: hasCredentials,
  });

  const mutateAccept = useMutation({
    mutationFn: (id: number) => respondFriendRequest(apiKey, id, 'accept'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friendRequests'] });
      queryClient.invalidateQueries({ queryKey: ['friends'] });
    },
  });

  const mutateDecline = useMutation({
    mutationFn: (id: number) => respondFriendRequest(apiKey, id, 'decline'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['friendRequests'] }),
  });

  const mutateCancel = useMutation({
    mutationFn: (id: number) => respondFriendRequest(apiKey, id, 'cancel'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['friendRequests'] }),
  });

  const mutateCreate = useMutation({
    mutationFn: (userId: number) => createFriendRequest(apiKey, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['friendRequests'] }),
  });

  const mutateRemove = useMutation({
    mutationFn: (userId: number) => removeFriend(apiKey, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['friends'] }),
  });

  const mutateChallenge = useMutation({
    mutationFn: (userId: number) => challengeFriend(apiKey, userId),
    onSuccess: () => navigation.navigate('Lobby'),
  });

  const incoming = useMemo(
    () => (requestsQuery.data || []).filter((r) => r.to_user_id && r.status === 'pending'),
    [requestsQuery.data],
  );
  const outgoing = useMemo(
    () => (requestsQuery.data || []).filter((r) => r.from_user_id && r.status === 'pending'),
    [requestsQuery.data],
  );
  const friends = friendsQuery.data || [];

  const handleAddFriend = () => {
    const idNum = Number.parseInt(newRequestId, 10);
    if (!Number.isNaN(idNum)) mutateCreate.mutate(idNum);
  };

  // Atlantic skin: layout matching AtlanticFriendsPreview
  if (USE_ATLANTIC_SKIN) {
    return (
      <SafeAreaView style={[atlanticStyles.screen, { backgroundColor: screenBg }]}>
        <ScrollView contentContainerStyle={atlanticStyles.scroll}>
          <View style={[atlanticStyles.header, { borderColor }]}>
            <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}>
              <Text style={[atlanticStyles.headerAction, { color: titleColor }]}>{'←'}</Text>
            </Pressable>
            <View style={[atlanticStyles.brandCircle, { borderColor: darkModeEnabled ? '#E7131A' : t.colors.accent }]}>
              <Text style={atlanticStyles.brandLetter}>AB</Text>
            </View>
            <Text style={[atlanticStyles.headerTitle, { color: titleColor }]}>Friends</Text>
            <View style={atlanticStyles.headerSpacer} />
          </View>

          <View style={[atlanticStyles.card, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[atlanticStyles.cardTitle, { color: titleColor }]}>ADD FRIEND</Text>
            <View style={[atlanticStyles.inputRow, { borderColor }]}>
              <TextInput
                style={[atlanticStyles.input, { color: darkModeEnabled ? '#f2f2f2' : '#333' }]}
                placeholder="Enter User ID"
                placeholderTextColor={textMuted}
                value={newRequestId}
                onChangeText={setNewRequestId}
                keyboardType="number-pad"
              />
              <Pressable
                onPress={handleAddFriend}
                disabled={mutateCreate.isPending}
                style={({ pressed }) => [
                  atlanticStyles.addButton,
                  (pressed || mutateCreate.isPending) && { opacity: 0.9 },
                ]}
              >
                {mutateCreate.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={atlanticStyles.addButtonText}>+</Text>
                )}
              </Pressable>
            </View>
          </View>

          <View style={[atlanticStyles.card, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[atlanticStyles.cardTitle, { color: titleColor }]}>INCOMING REQUESTS ({incoming.length})</Text>
            {incoming.length === 0 ? (
              <Text style={[atlanticStyles.muted, { color: textMuted }]}>No incoming requests.</Text>
            ) : (
              incoming.map((item) => (
                <View key={`in-${item.id}`} style={atlanticStyles.row}>
                  <View style={atlanticStyles.rowContent}>
                    <Text style={atlanticStyles.rowPrimary}>
                      {item.from_display_name ?? `User ${item.from_user_id}`}
                    </Text>
                    <Text style={atlanticStyles.rowSecondary}>From • Request pending</Text>
                  </View>
                  <View style={atlanticStyles.rowActions}>
                    <Pressable
                      style={[atlanticStyles.squareButton, { backgroundColor: '#3c8c3a' }]}
                      onPress={() => mutateAccept.mutate(item.id)}
                    >
                      <Text style={atlanticStyles.squareButtonText}>✓</Text>
                    </Pressable>
                    <Pressable
                      style={[atlanticStyles.squareButton, { backgroundColor: t.colors.danger }]}
                      onPress={() => mutateDecline.mutate(item.id)}
                    >
                      <Text style={atlanticStyles.squareButtonText}>✗</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>

          <View style={[atlanticStyles.card, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[atlanticStyles.cardTitle, { color: titleColor }]}>PENDING REQUESTS ({outgoing.length})</Text>
            {outgoing.length === 0 ? (
              <Text style={[atlanticStyles.muted, { color: textMuted }]}>No pending requests.</Text>
            ) : (
              outgoing.map((item) => (
                <View key={`out-${item.id}`} style={atlanticStyles.row}>
                  <View style={atlanticStyles.rowContent}>
                    <Text style={atlanticStyles.rowPrimary}>
                      {item.to_display_name ?? `User ${item.to_user_id}`}
                    </Text>
                    <Text style={atlanticStyles.rowSecondary}>Sent • Awaiting response</Text>
                  </View>
                  <Pressable
                    style={[atlanticStyles.squareButton, { backgroundColor: '#e0e0e0' }]}
                    onPress={() => mutateCancel.mutate(item.id)}
                  >
                    <Text style={[atlanticStyles.squareButtonText, { color: '#000' }]}>Cancel</Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>

          <View style={[atlanticStyles.card, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[atlanticStyles.cardTitle, { color: titleColor }]}>YOUR FRIENDS ({friends.length})</Text>
            {friends.length === 0 ? (
              <Text style={[atlanticStyles.muted, { color: textMuted }]}>No friends yet.</Text>
            ) : (
              friends.map((item) => (
                <View key={`friend-${item.user_id}`} style={atlanticStyles.row}>
                  <View style={atlanticStyles.rowContent}>
                    <Text style={atlanticStyles.rowPrimary}>
                      {item.display_name ?? `User ${item.user_id}`}
                    </Text>
                    <Text style={atlanticStyles.rowSecondary}>ID: {item.user_id}</Text>
                  </View>
                  <View style={atlanticStyles.rowActions}>
                    <Pressable
                      style={[atlanticStyles.challengeButton]}
                      onPress={() => mutateChallenge.mutate(item.user_id)}
                    >
                      <Image
                        source={require('../../assets/design/icons/CWMotifRed.png')}
                        style={[atlanticStyles.motifIcon, { tintColor: '#E7131A' }]}
                      />
                    </Pressable>
                    <Pressable
                      style={[atlanticStyles.squareButton, { backgroundColor: '#000' }]}
                      onPress={() => mutateRemove.mutate(item.user_id)}
                    >
                      <Text style={atlanticStyles.squareButtonText}>Remove</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Legacy layout
  return (
    <SafeAreaView style={[legacyStyles.safeArea, { backgroundColor: designTokens?.colors?.canvas ?? '#0b1220' }]}>
      <View style={legacyStyles.header}>
        <Text style={legacyStyles.title}>Friends</Text>
        <Pressable style={legacyStyles.btn} onPress={() => navigation.goBack()}>
          <Text style={legacyStyles.btnText}>Back</Text>
        </Pressable>
      </View>

      <View style={legacyStyles.card}>
        <Text style={legacyStyles.cardTitle}>Send request (user id)</Text>
        <View style={legacyStyles.row}>
          <TextInput
            value={newRequestId}
            onChangeText={setNewRequestId}
            placeholder="Enter user id"
            placeholderTextColor="#94a3b8"
            keyboardType="number-pad"
            style={legacyStyles.input}
          />
          <Pressable style={legacyStyles.btn} onPress={handleAddFriend}>
            <Text style={legacyStyles.btnText}>Send</Text>
          </Pressable>
        </View>
      </View>

      <View style={legacyStyles.card}>
        <Text style={legacyStyles.cardTitle}>Incoming requests</Text>
        {incoming.length === 0 ? (
          <Text style={legacyStyles.muted}>No incoming requests.</Text>
        ) : (
          incoming.map((item) => (
            <View key={`in-${item.id}`} style={legacyStyles.row}>
              <Text style={legacyStyles.rowText}>
                From {item.from_display_name ?? item.from_user_id}
              </Text>
              <View style={legacyStyles.rowActions}>
                <Pressable style={legacyStyles.btn} onPress={() => mutateAccept.mutate(item.id)}>
                  <Text style={legacyStyles.btnText}>Accept</Text>
                </Pressable>
                <Pressable style={legacyStyles.btn} onPress={() => mutateDecline.mutate(item.id)}>
                  <Text style={legacyStyles.btnText}>Decline</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={legacyStyles.card}>
        <Text style={legacyStyles.cardTitle}>Outgoing requests</Text>
        {outgoing.length === 0 ? (
          <Text style={legacyStyles.muted}>No outgoing requests.</Text>
        ) : (
          outgoing.map((item) => (
            <View key={`out-${item.id}`} style={legacyStyles.row}>
              <Text style={legacyStyles.rowText}>
                To {item.to_display_name ?? item.to_user_id}
              </Text>
              <Pressable style={legacyStyles.btn} onPress={() => mutateCancel.mutate(item.id)}>
                <Text style={legacyStyles.btnText}>Cancel</Text>
              </Pressable>
            </View>
          ))
        )}
      </View>

      <View style={legacyStyles.card}>
        <Text style={legacyStyles.cardTitle}>Friends</Text>
        {friends.length === 0 ? (
          <Text style={legacyStyles.muted}>No friends yet.</Text>
        ) : (
          friends.map((item) => (
            <View key={`friend-${item.user_id}`} style={legacyStyles.row}>
              <Text style={legacyStyles.rowText}>{item.display_name ?? `User ${item.user_id}`}</Text>
              <View style={legacyStyles.rowActions}>
                <Pressable style={legacyStyles.btn} onPress={() => mutateChallenge.mutate(item.user_id)}>
                  <Text style={legacyStyles.btnText}>Challenge</Text>
                </Pressable>
                <Pressable style={legacyStyles.btn} onPress={() => mutateRemove.mutate(item.user_id)}>
                  <Text style={legacyStyles.btnText}>Remove</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </View>
    </SafeAreaView>
  );
}

const atlanticStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll: { flexGrow: 1, padding: 16, gap: 14, paddingBottom: 32 },
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
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    fontFamily: t.typography.bodyFamily,
    fontSize: 15,
    color: '#333',
  },
  addButton: {
    width: 36,
    height: 36,
    backgroundColor: t.colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { fontSize: 18, color: '#fff', fontFamily: t.typography.displayFamily },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
  },
  rowContent: { flex: 1 },
  rowPrimary: { fontFamily: t.typography.displayFamily, fontSize: 14, color: '#000' },
  rowSecondary: { fontFamily: t.typography.bodyFamily, fontSize: 12, color: '#666' },
  rowActions: { flexDirection: 'row', gap: 8 },
  squareButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  squareButtonText: {
    fontSize: 12,
    fontFamily: t.typography.displayFamily,
    color: '#fff',
  },
  challengeButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  motifIcon: { width: 24, height: 24 },
  muted: { fontFamily: t.typography.bodyFamily, fontSize: 13, color: '#8a8a8a' },
});

const legacyStyles = StyleSheet.create({
  safeArea: { flex: 1, padding: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '700', color: '#e2e8f0' },
  card: { marginBottom: 12, padding: 10, borderRadius: 10, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#1f2937' },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 6, color: '#cbd5e1' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  rowText: { color: '#e2e8f0', flex: 1 },
  rowActions: { flexDirection: 'row', gap: 6 },
  btn: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#1d4ed8', borderRadius: 6 },
  btnText: { color: '#e2e8f0', fontWeight: '600' },
  input: { flex: 1, backgroundColor: '#111827', color: '#e2e8f0', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#1f2937', marginRight: 8 },
  muted: { color: '#94a3b8', fontSize: 13 },
});
