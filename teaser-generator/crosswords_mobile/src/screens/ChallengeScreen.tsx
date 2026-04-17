/**
 * src/screens/ChallengeScreen.tsx
 * -----------------------------------------------------------
 * Two-section UI for friend challenges:
 *   1. "Create Challenge" — pick words / seed, generate code, share
 *   2. "Enter Code" — paste any code, auto-detect type, route to game
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  Linking,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';

import { DESIGN_TOKEN_SETS } from '@src/theme/designTokens';
import {
  decodeChallenge,
  encodeOffer,
  decodeOffer,
  encodeReturn,
  decodeReturn,
  encodeBundle,
  decodeBundle,
} from '../gameEngine/serialize';
import { stableOfferId } from '../gameEngine/hash';
import {
  DEFAULT_RULES,
  type ChallengePayload,
  type ChallengeOfferPayload,
  type ChallengeReturnPayload,
  type ChallengeBundlePayload,
} from '../gameEngine/types';
import { initGameFromChallenge } from '../gameEngine/state';
import {
  createSessionFromPayload,
  createSessionFromTargets,
  recordOffer,
  recordReturn,
  recordBundle,
  inferRoleForOfferId,
} from '../localChallenge/localChallengeStore';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { canonicalizeDictionaryId, DictionaryId, getDictionaryMeta, getVisibleDictionaryOptions, supportsCurrentTargetPattern } from '../dictionary/dictionaryAdapter';
import { buildLocalPlacement } from '../lib/localPlacement';
import { validateJottForSubmission } from '../jotts/validateJottForSubmission';
import { parseWords } from '../utils/wordParsing';
import { isServerFunctionsEnabled } from '../flags';
import { generateTargetsFromSeed } from '../localChallenge/seededTargets';
import { createRandomSeed, parseExplicitSeed } from '../localChallenge/seedInput';
import useUIStore from '@stores/uiStore';
import useJottsStore from '@src/jotts/jottsStore';

const t = DESIGN_TOKEN_SETS.atlantic;
const LOBBY_ACCENT = '#E7131A';
const LOBBY_SCREEN_BG = '#fdfdfd';
const LOBBY_SURFACE = '#fff';
const LOBBY_BORDER = '#e2e2e2';
const LOBBY_DIVIDER = '#e4e4e4';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Challenge'>;
type Route = RouteProp<RootStackParamList, 'Challenge'>;

// Module-level — survives component unmount/remount so the clipboard banner
// never fires for a code we ourselves just generated.
let _lastGeneratedCode: string | null = null;

/** Helper to prettify code preview links. */
const linkFor = (kind: 'c' | 'offer' | 'return', code: string): string => `myapp://${kind}/${code}`;
const STACK_CARD_WIDTH = 170;
const STACK_CARD_OVERLAP = 54;
const STACK_CARD_STEP = STACK_CARD_WIDTH - STACK_CARD_OVERLAP;
const TARGET_LENGTHS = [4, 4, 5, 5, 6] as const;

/** Generic validation for 5-word lists using the same rules as jotts. */
function validateWordsList(words: string[], dictionaryId: DictionaryId): { ok: boolean; errors: string[] } {
  const candidate = {
    id: 'inline',
    title: 'inline',
    words,
    dictionaryId,
    createdAtMs: Date.now(),
    updatedAtMs: Date.now(),
  };
  const validation = validateJottForSubmission(candidate);
  if (validation.ok) return { ok: true, errors: [] };
  return { ok: false, errors: validation.errors };
}

/** Common alert wrapper for offline placeholder dictionary bypass. */
function guardDictionary(validation: { ok: boolean; errors: string[] }): boolean {
  if (validation.ok) return true;
  if (!isServerFunctionsEnabled()) {
    Alert.alert(
      'Offline dictionary notice',
      'Dictionary check is limited in offline mode (placeholder list). Proceeding without strict validation.',
    );
    return true;
  }
  Alert.alert('Invalid words', validation.errors.join('\n'));
  return false;
}

/** QR code display component with copy/share functionality */
function QRCodeDisplay({ code, type, deepLink }: { code: string; type: string; deepLink?: string }): React.JSX.Element {
  const shareText = `CrosSWords ${type}: ${deepLink || code}`;

  const handleCopy = async () => {
    await Clipboard.setStringAsync(code);
    Alert.alert('Copied!', `${type} code copied to clipboard`);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: shareText,
        title: `Share ${type} Code`,
      });
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  const handleWhatsApp = async () => {
    const url = `whatsapp://send?text=${encodeURIComponent(shareText)}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert('WhatsApp not found', 'WhatsApp is not installed on this device.');
    }
  };

  const handleSMS = async () => {
    try {
      await Linking.openURL(`sms:?body=${encodeURIComponent(shareText)}`);
    } catch {
      Alert.alert('SMS not available', 'Could not open SMS on this device.');
    }
  };

  return (
    <View style={styles.qrContainer}>
      <View style={styles.qrCodeWrapper}>
        <QRCode value={deepLink || code} size={180} />
      </View>
      <Text selectable style={styles.codeText}>{code}</Text>
      <View style={styles.buttonRow}>
        <Pressable style={styles.actionBtn} onPress={handleCopy}>
          <Text style={styles.actionBtnText}>Copy</Text>
        </Pressable>
        <Pressable style={styles.actionBtn} onPress={handleShare}>
          <Text style={styles.actionBtnText}>Share</Text>
        </Pressable>
      </View>
      <View style={styles.buttonRow}>
        <Pressable style={styles.actionBtn} onPress={handleWhatsApp}>
          <Text style={styles.actionBtnText}>WhatsApp</Text>
        </Pressable>
        <Pressable style={styles.actionBtn} onPress={handleSMS}>
          <Text style={styles.actionBtnText}>SMS</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function ChallengeScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const darkModeEnabled = useUIStore((s) => s.darkModeEnabled);
  const screenBg = darkModeEnabled ? '#121212' : LOBBY_SCREEN_BG;
  const topHeadingColor = darkModeEnabled ? '#f2f2f2' : '#111';
  const darkCard = darkModeEnabled ? { backgroundColor: '#1b1b1b', borderColor: '#2d2d2d' } : null;
  const darkHeading = darkModeEnabled ? { color: '#f2f2f2' } : null;
  const darkHelper = darkModeEnabled ? { color: '#b8b8b8' } : null;
  const darkRule = darkModeEnabled ? { borderColor: '#303030' } : null;
  const darkInput = darkModeEnabled
    ? { backgroundColor: '#202020', borderColor: '#363636', color: '#f2f2f2' }
    : null;
  const darkQuickBtn = darkModeEnabled ? { borderColor: '#3a3a3a', backgroundColor: '#202020' } : null;
  const darkQuickBtnText = darkModeEnabled ? { color: '#f2f2f2' } : null;
  const { width: screenWidth } = useWindowDimensions();
  const compactWordRows = screenWidth < 380;
  // Card has 16px padding each side — subtract so active card centers on screen.
  const centeringPad = Math.max(4, (screenWidth - STACK_CARD_WIDTH) / 2 - 16);

  const showOnly = route.params?.showOnly;
  const enterOnly = showOnly === 'enter';
  const createOnly = showOnly === 'create';
  const blindOnly = showOnly === 'blind';
  const masterDictionary = useUIStore((s) => s.dictionary);
  const jotts = useJottsStore((s) => s.jotts);

  // ── Create Challenge state ──────────────────────────────────────────
  const [offerWords, setOfferWords] = useState<string[]>(['', '', '', '', '']);
  const [offerDict, setOfferDict] = useState<DictionaryId>(masterDictionary);
  const [useSeedMode, setUseSeedMode] = useState(false);
  const [seedValue, setSeedValue] = useState(String(createRandomSeed()));
  const [offerCode, setOfferCode] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  // ── Enter Code state ────────────────────────────────────────────────
  const [enterCode, setEnterCode] = useState(route.params?.prefillCode ?? '');
  const [detectedOffer, setDetectedOffer] = useState<ChallengeOfferPayload | null>(null);
  const [returnWordsInput, setReturnWordsInput] = useState('');
  const [returnCode, setReturnCode] = useState<string | null>(null);
  const [selectedJottIndex, setSelectedJottIndex] = useState(0);
  const jottStackScrollX = useRef(new Animated.Value(0)).current;

  // Derived word parsing
  const parsedOfferWords = useMemo(
    () => offerWords.map((w) => w.trim().toUpperCase().replace(/[^A-Z]/g, '')).filter(Boolean),
    [offerWords],
  );
  const parsedReturnWords = useMemo(() => parseWords(returnWordsInput), [returnWordsInput]);

  const setOfferWordAt = useCallback((index: number, value: string) => {
    const cleaned = value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6);
    setOfferWords((prev) => {
      const next = [...prev];
      next[index] = cleaned;
      return next;
    });
  }, []);

  const ensureDictionarySupportsCurrentMode = useCallback((dictionaryIdRaw: string): boolean => {
    const canonical = canonicalizeDictionaryId(dictionaryIdRaw);
    if (supportsCurrentTargetPattern(canonical)) return true;
    Alert.alert('Unsupported dictionary', 'This dictionary needs a different game mode pattern.');
    return false;
  }, []);

  const readExplicitSeed = useCallback((): number | null => {
    const parsed = parseExplicitSeed(seedValue);
    if (!parsed.ok) {
      Alert.alert('Invalid seed', parsed.error);
      return null;
    }
    return parsed.seed;
  }, [seedValue]);

  // ── Clipboard auto-detect ───────────────────────────────────────────
  const [clipboardCode, setClipboardCode] = useState<{ code: string; kind: 'offer' | 'return' | 'bundle' | 'result' | 'unknown' } | null>(null);

  const detectClipboard = useCallback(async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (!text || text.length < 10 || text.length > 5000) {
        setClipboardCode(null);
        return;
      }
      // Skip if this is a code we generated ourselves.
      // Check both module var (fast) and AsyncStorage (survives hot reloads / restarts).
      const trimmed = text.trim();
      const storedCode = await AsyncStorage.getItem('_cwLastGeneratedCode').catch(() => null);
      if ((_lastGeneratedCode && trimmed === _lastGeneratedCode) || (storedCode && trimmed === storedCode)) {
        setClipboardCode(null);
        return;
      }

      if (trimmed.includes(' ') && trimmed.split(' ').length > 3) {
        setClipboardCode(null);
        return;
      }

      try {
        const decoded = JSON.parse(Buffer.from(
          trimmed.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(trimmed.length / 4) * 4, '='),
          'base64'
        ).toString('utf-8'));

        if (decoded && typeof decoded === 'object') {
          if (decoded.senderTargets || decoded.receiverTargets) {
            setClipboardCode({ code: trimmed, kind: 'offer' });
          } else if (decoded.returnWords || decoded.senderWords) {
            setClipboardCode({ code: trimmed, kind: 'return' });
          } else if (decoded.offer && decoded.returnPayload) {
            setClipboardCode({ code: trimmed, kind: 'bundle' });
          } else if (decoded.challengeId && decoded.completed) {
            setClipboardCode({ code: trimmed, kind: 'result' });
          } else if (decoded.words || decoded.v) {
            setClipboardCode({ code: trimmed, kind: 'unknown' });
          } else {
            setClipboardCode(null);
          }
        } else {
          setClipboardCode(null);
        }
      } catch {
        setClipboardCode(null);
      }
    } catch {
      setClipboardCode(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      detectClipboard();
    }, [detectClipboard])
  );

  const handleImportClipboard = () => {
    if (!clipboardCode) return;
    const { code, kind } = clipboardCode;

    if (kind === 'result') {
      (navigation as any).navigate('ResultImport', { prefillCode: code });
    } else {
      // All code types go into the Enter Code box
      setEnterCode(code);
      setClipboardCode(null);
      // Auto-process after a tick so state updates
      setTimeout(() => handleEnterCodeWith(code), 100);
    }
    setClipboardCode(null);
  };

  // ── Deep-link prefill ───────────────────────────────────────────────
  useEffect(() => {
    if (route.params?.prefillCode) {
      setEnterCode(route.params.prefillCode);
    }
    if (route.params?.autoImport && route.params?.prefillCode) {
      // Legacy deep link auto-import
      try {
        const payload = decodeChallenge(route.params.prefillCode);
        const state = initGameFromChallenge(payload);
        const sessionId = createSessionFromPayload(payload, state);
        navigation.navigate('Board', { mode: 'solo', sessionId });
      } catch {
        // Ignore failures; user can still paste manually.
      }
    }
  }, [route.params?.prefillCode, route.params?.autoImport, navigation]);

  // ── Session creation helper ─────────────────────────────────────────
  const startSessionFromTargets = (targets: string[], role: 'sender' | 'receiver' | 'seed', meta?: { offerId?: string; dictionaryId?: string; dictionaryVersion?: string; difficulty?: string; timerLimitSeconds?: number; }) => {
    const sessionId = createSessionFromTargets({
      targets,
      role,
      offerId: meta?.offerId,
      dictionaryId: meta?.dictionaryId,
      dictionaryVersion: meta?.dictionaryVersion,
      difficulty: meta?.difficulty,
      timerLimitSeconds: meta?.timerLimitSeconds,
      rules: { ...DEFAULT_RULES },
    });
    navigation.navigate('Board', { mode: 'solo', sessionId });
  };

  // ── Create Challenge ────────────────────────────────────────────────
  const handleCreateOffer = () => {
    if (!ensureDictionarySupportsCurrentMode(offerDict)) return;

    if (!useSeedMode && parsedOfferWords.length !== 5) {
      Alert.alert('Needs exactly 5 words', `Parsed ${parsedOfferWords.length}.`);
      return;
    }

    if (!useSeedMode) {
      const ok = guardDictionary(validateWordsList(parsedOfferWords, offerDict));
      if (!ok) return;

      const placement = buildLocalPlacement(parsedOfferWords);
      if (!placement.ok) {
        Alert.alert('Cannot place words', placement.error + '\n\nTry different words — some combinations cannot form a valid crossword grid.');
        return;
      }
    }

    const seed = readExplicitSeed();
    if (seed === null) return;
    // Random mode: generate opponent's words from seed — sender_picks_for_receiver,
    // so each player solves a different board (not Blind Match which uses same_list_seed).
    const receiverTargets = useSeedMode
      ? generateTargetsFromSeed(seed, canonicalizeDictionaryId(offerDict), 5)
      : parsedOfferWords;
    const payload: ChallengeOfferPayload = {
      v: 1,
      type: 'offer',
      offerId: 'pending',
      mode: 'sender_picks_for_receiver',
      dictionaryId: offerDict,
      receiverTargets,
      createdAtMs: Date.now(),
      rules: { ...DEFAULT_RULES },
    };
    payload.offerId = stableOfferId(payload);

    const code = encodeOffer(payload);
    setOfferCode(code);
    recordOffer(code, payload);

    // Auto-copy to clipboard and show share modal
    _lastGeneratedCode = code;
    AsyncStorage.setItem('_cwLastGeneratedCode', code).catch(() => {});
    Clipboard.setStringAsync(code).catch(() => {});
    setShowShareModal(true);
  };

  // ── Enter Code: auto-detect and route ───────────────────────────────
  type CodeDecode =
    | { kind: 'offer'; offer: ChallengeOfferPayload }
    | { kind: 'return'; ret: ChallengeReturnPayload }
    | { kind: 'bundle'; bundle: ChallengeBundlePayload }
    | { kind: 'legacy'; payload: ChallengePayload }
    | { kind: 'unknown' };

  const decodeAnyCode = (raw: string): CodeDecode => {
    const trimmed = raw.trim();
    if (!trimmed) return { kind: 'unknown' };
    try {
      const bundle = decodeBundle(trimmed);
      if (bundle?.type === 'bundle') return { kind: 'bundle', bundle };
    } catch {}
    try {
      const ret = decodeReturn(trimmed);
      if (ret?.type === 'return') return { kind: 'return', ret };
    } catch {}
    try {
      const offer = decodeOffer(trimmed);
      if (offer?.type === 'offer') return { kind: 'offer', offer };
    } catch {}
    try {
      const payload = decodeChallenge(trimmed);
      if (payload?.words) return { kind: 'legacy', payload };
    } catch {}
    return { kind: 'unknown' };
  };

  /** Process a code string (called from button or clipboard import). */
  const handleEnterCodeWith = (raw: string) => {
    const decoded = decodeAnyCode(raw);

    if (decoded.kind === 'unknown') {
      Alert.alert('Unrecognized code', 'Could not decode this code. Make sure you copied the full code.');
      return;
    }

    // ── Return code: start game immediately as sender ──
    if (decoded.kind === 'return') {
      startSessionFromTargets(decoded.ret.senderTargets, 'sender', { offerId: decoded.ret.offerId });
      return;
    }

    // ── Legacy code: start game immediately ──
    if (decoded.kind === 'legacy') {
      const state = initGameFromChallenge(decoded.payload);
      const sessionId = createSessionFromPayload(decoded.payload, state);
      navigation.navigate('Board', { mode: 'solo', sessionId });
      return;
    }

    // ── Offer code: check if already accepted, otherwise show word picker ──
    if (decoded.kind === 'offer') {
      const { offer } = decoded;
      const knownRole = inferRoleForOfferId(offer.offerId);

      if (knownRole && offer.receiverTargets) {
        // Already accepted — start directly
        startSessionFromTargets(offer.receiverTargets, 'receiver', {
          offerId: offer.offerId,
          dictionaryId: offer.dictionaryId,
          dictionaryVersion: offer.dictionaryVersion,
          difficulty: offer.difficulty,
          timerLimitSeconds: offer.timerLimitSeconds,
        });
        return;
      }

      // First time — expand word picker inline
      setDetectedOffer(offer);
      Alert.alert('Challenge received!', 'Pick 5 words for your friend to guess, then tap "Accept & Start Playing".');
      return;
    }

    // ── Bundle code: route based on inferred role ──
    if (decoded.kind === 'bundle') {
      const { offer, return: ret } = decoded.bundle;
      const inferred = inferRoleForOfferId(offer.offerId);

      if (offer.mode === 'same_list_seed' && offer.seed !== undefined) {
        if (!ensureDictionarySupportsCurrentMode(offer.dictionaryId)) return;
        const targets = generateTargetsFromSeed(offer.seed, canonicalizeDictionaryId(offer.dictionaryId), 5);
        startSessionFromTargets(targets, 'seed', {
          offerId: offer.offerId,
          dictionaryId: offer.dictionaryId,
          dictionaryVersion: offer.dictionaryVersion,
          difficulty: offer.difficulty,
          timerLimitSeconds: offer.timerLimitSeconds,
        });
        return;
      }
      if (inferred === 'sender' && ret) {
        startSessionFromTargets(ret.senderTargets, 'sender', { offerId: offer.offerId });
        return;
      }
      if (inferred === 'receiver' && offer.receiverTargets) {
        startSessionFromTargets(offer.receiverTargets, 'receiver', {
          offerId: offer.offerId,
          dictionaryId: offer.dictionaryId,
          dictionaryVersion: offer.dictionaryVersion,
          difficulty: offer.difficulty,
          timerLimitSeconds: offer.timerLimitSeconds,
        });
        return;
      }
      // No inferred role — try sender first (common case: original creator pasting bundle)
      if (ret) {
        startSessionFromTargets(ret.senderTargets, 'sender', { offerId: offer.offerId });
        return;
      }
      Alert.alert('Cannot determine role', 'Could not figure out which words are yours in this bundle.');
    }
  };

  const handleEnterCode = () => handleEnterCodeWith(enterCode);

  const importWordsFromJott = (words: string[], target: 'create' | 'return' = 'return') => {
    const joined = words.join(' ');
    if (target === 'create') {
      const nextWords = [...Array(5)].map((_, idx) =>
        (words[idx] ?? '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6),
      );
      setOfferWords(nextWords);
      return;
    }
    setReturnWordsInput(joined);
  };

  const handleJottMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (jotts.length === 0) return;
    const rawIndex = event.nativeEvent.contentOffset.x / STACK_CARD_STEP;
    const snappedIndex = Math.max(0, Math.min(jotts.length - 1, Math.round(rawIndex)));
    setSelectedJottIndex(snappedIndex);
  };

  // ── Accept & Start (after offer detected, user picks words) ─────────
  const handleAcceptAndStart = () => {
    if (!detectedOffer) return;
    const offer = detectedOffer;
    if (!ensureDictionarySupportsCurrentMode(offer.dictionaryId)) return;

    if (parsedReturnWords.length !== 5) {
      Alert.alert('Needs exactly 5 words', `Parsed ${parsedReturnWords.length}.`);
      return;
    }
    const ok = guardDictionary(validateWordsList(parsedReturnWords, offer.dictionaryId as DictionaryId));
    if (!ok) return;

    const placement = buildLocalPlacement(parsedReturnWords);
    if (!placement.ok) {
      Alert.alert('Cannot place words', placement.error + '\n\nTry different words — some combinations cannot form a valid crossword grid.');
      return;
    }

    const ret: ChallengeReturnPayload = {
      v: 1,
      type: 'return',
      offerId: offer.offerId,
      senderTargets: parsedReturnWords,
      createdAtMs: Date.now(),
    };
    const code = encodeReturn(ret);
    setReturnCode(code);
    recordReturn(code, ret);

    // Bundle for convenience
    const bundle: ChallengeBundlePayload = { v: 1, type: 'bundle', offer, return: ret };
    const bundleEncoded = encodeBundle(bundle);
    recordBundle(bundleEncoded, offer.offerId);

    // Auto-copy return code
    _lastGeneratedCode = code;
    AsyncStorage.setItem('_cwLastGeneratedCode', code).catch(() => {});
    Clipboard.setStringAsync(code);

    // Start game for receiver
    if (offer.receiverTargets && offer.receiverTargets.length > 0) {
      Alert.alert(
        'Challenge Accepted!',
        'Your response code was copied to clipboard. Send it to your friend so they can play too.\n\nStarting your game now...',
        [
          {
            text: 'Start Playing',
            onPress: () => {
              startSessionFromTargets(offer.receiverTargets!, 'receiver', {
                offerId: offer.offerId,
                dictionaryId: offer.dictionaryId,
                dictionaryVersion: offer.dictionaryVersion,
                difficulty: offer.difficulty,
                timerLimitSeconds: offer.timerLimitSeconds,
              });
            },
          },
        ],
      );
    } else if (offer.mode === 'same_list_seed' && offer.seed !== undefined) {
      // Seed mode: generate targets and start
      Alert.alert(
        'Challenge Accepted!',
        'Your response code was copied to clipboard. Send it to your friend.\n\nStarting your game now...',
        [
          {
            text: 'Start Playing',
            onPress: () => {
              if (!ensureDictionarySupportsCurrentMode(offer.dictionaryId)) return;
              const targets = generateTargetsFromSeed(offer.seed!, canonicalizeDictionaryId(offer.dictionaryId), 5);
              startSessionFromTargets(targets, 'seed', {
                offerId: offer.offerId,
                dictionaryId: offer.dictionaryId,
              });
            },
          },
        ],
      );
    }
  };

  // ── Blind Match: cast the glove ─────────────────────────────────────
  const handleCastGlove = () => {
    if (!ensureDictionarySupportsCurrentMode(offerDict)) return;
    const seed = readExplicitSeed();
    if (seed === null) return;
    const payload: ChallengeOfferPayload = {
      v: 1,
      type: 'offer',
      offerId: 'pending',
      mode: 'same_list_seed',
      dictionaryId: offerDict,
      seed,
      createdAtMs: Date.now(),
      rules: { ...DEFAULT_RULES },
    };
    payload.offerId = stableOfferId(payload);
    const code = encodeOffer(payload);
    setOfferCode(code);
    recordOffer(code, payload);
    _lastGeneratedCode = code;
    AsyncStorage.setItem('_cwLastGeneratedCode', code).catch(() => {});
    Clipboard.setStringAsync(code).catch(() => {});
    // Ensure seed mode is set so modal's "Start Playing" works correctly
    setUseSeedMode(true);
    setSeedValue(String(seed));
    setShowShareModal(true);
  };

  // ── Render ──────────────────────────────────────────────────────────

  // ── Blind Match screen ──────────────────────────────────────────────
  if (blindOnly) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: screenBg }}>
        <ScrollView style={{ backgroundColor: screenBg }} contentContainerStyle={[styles.container, { backgroundColor: screenBg }]}>
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => [styles.backIconBtn, pressed && { opacity: 0.75 }]}>
                <Image source={require('../../assets/design/icons/CWMotifRed.png')} style={styles.backIcon} resizeMode="contain" />
              </Pressable>
              <Text style={[styles.heading, { color: topHeadingColor }]}>Blind Match</Text>
            </View>
          </View>

          <View style={[styles.card, darkCard]}>
            <Text style={[styles.heading, darkHeading]}>Cast the Glove</Text>
            <View style={[styles.cardRule, darkRule]} />

            <View style={styles.settingBlock}>
              <Text style={[styles.settingLabel, darkHeading]}>DICTIONARY</Text>
              <View style={[styles.dictSegment, darkModeEnabled && { borderColor: '#3a3a3a' }]}>
                {getVisibleDictionaryOptions().map((opt) => (
                  <Pressable
                    key={opt}
                    onPress={() => setOfferDict(opt)}
                    style={[
                      styles.dictSegmentItem,
                      { backgroundColor: darkModeEnabled ? '#232323' : '#f5f5f5' },
                      offerDict === opt && styles.dictSegmentItemActive,
                    ]}
                  >
                    <Text style={[
                      styles.dictSegmentText,
                      { color: darkModeEnabled ? '#f0f0f0' : '#333' },
                      offerDict === opt && styles.dictSegmentTextActive,
                    ]}>
                      {getDictionaryMeta(opt).label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Pressable style={styles.primaryBtn} onPress={handleCastGlove}>
              <Text style={styles.primaryBtnText}>Cast the Glove</Text>
            </Pressable>
          </View>
        </ScrollView>

        {/* Share modal — same one used by full challenge flow */}
        <Modal
          visible={showShareModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowShareModal(false)}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setShowShareModal(false)}>
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <Text style={styles.modalHeading}>Challenge Issued!</Text>
              <Text style={styles.modalSubtext}>Code copied to clipboard. Share it with your opponent. En Garde!</Text>
              {offerCode && (
                <>
                  <View style={styles.qrCodeWrapper}>
                    <QRCode value={linkFor('offer', offerCode)} size={160} />
                  </View>
                  <Text selectable style={styles.codeText}>{offerCode}</Text>
                  <View style={styles.buttonRow}>
                    <TouchableOpacity style={styles.modalShareBtn} onPress={() => { Clipboard.setStringAsync(offerCode); Alert.alert('Copied!', 'Code copied to clipboard'); }}>
                      <Text style={styles.modalShareBtnText}>📋 Copy</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.modalShareBtn} onPress={() => { Share.share({ message: `CrosSWords Blind Match: ${offerCode}` }).catch(() => {}); }}>
                      <Text style={styles.modalShareBtnText}>📤 Share</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={[styles.modalShareBtn, { backgroundColor: '#25D366' }]}
                      onPress={async () => {
                        const url = `whatsapp://send?text=${encodeURIComponent(`CrosSWords Blind Match: ${offerCode}`)}`;
                        const canOpen = await Linking.canOpenURL(url);
                        if (canOpen) await Linking.openURL(url);
                        else Alert.alert('WhatsApp not found', 'WhatsApp is not installed on this device.');
                      }}
                    >
                      <Text style={styles.modalShareBtnText}>💬 WhatsApp</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalShareBtn, { backgroundColor: '#5856D6' }]}
                      onPress={async () => {
                        try { await Linking.openURL(`sms:?body=${encodeURIComponent(`CrosSWords Blind Match: ${offerCode}`)}`); }
                        catch { Alert.alert('SMS not available', 'Could not open SMS on this device.'); }
                      }}
                    >
                      <Text style={styles.modalShareBtnText}>📱 SMS</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
              <TouchableOpacity
                style={styles.modalDoneBtn}
                onPress={() => {
                  setShowShareModal(false);
                  const seed = readExplicitSeed();
                  if (seed === null) return;
                  if (!ensureDictionarySupportsCurrentMode(offerDict)) return;
                  const targets = generateTargetsFromSeed(seed, canonicalizeDictionaryId(offerDict), 5);
                  startSessionFromTargets(targets, 'seed', { dictionaryId: offerDict });
                }}
              >
                <Text style={styles.modalDoneBtnText}>Start Playing</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    );
  }

  return (<>
    <ScrollView style={{ backgroundColor: screenBg }} contentContainerStyle={[styles.container, { backgroundColor: screenBg }]}>
      {/* Clipboard auto-detect banner */}
      {clipboardCode && (
        <Pressable style={styles.clipboardBanner} onPress={handleImportClipboard}>
          <Text style={styles.clipboardBannerText}>
            {clipboardCode.kind === 'offer' ? '📩 Challenge code detected on clipboard' :
             clipboardCode.kind === 'return' ? '📩 Response code detected on clipboard' :
             clipboardCode.kind === 'bundle' ? '📩 Game code detected on clipboard' :
             clipboardCode.kind === 'result' ? '📩 Result code detected on clipboard' :
             '📩 Code detected on clipboard'}
            {' — Tap to import'}
          </Text>
        </Pressable>
      )}

      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => [styles.backIconBtn, pressed && { opacity: 0.75 }]}>
            <Image
              source={require('../../assets/design/icons/CWMotifRed.png')}
              style={styles.backIcon}
              resizeMode="contain"
            />
          </Pressable>
          <Text style={[styles.heading, { color: topHeadingColor }]}>Challenge a Friend</Text>
        </View>
      </View>

      {/* ─── Section 1: Create Challenge ─────────────────────────── */}
      {!enterOnly && (
        !offerCode ? (
          <View style={[styles.card, darkCard]}>
            <Text style={[styles.heading, darkHeading]}>Create Challenge</Text>
            <View style={[styles.cardRule, darkRule]} />
            <Text style={[styles.helper, darkHelper]}>
              Pick 5 words for your friend to guess, then share the code with them.
            </Text>

            {/* Dictionary */}
            <View style={styles.settingBlock}>
              <Text style={[styles.settingLabel, darkHeading]}>DICTIONARY</Text>
              <View style={[styles.dictSegment, darkModeEnabled && { borderColor: '#3a3a3a' }]}>
                {getVisibleDictionaryOptions().map((opt) => (
                  <Pressable
                    key={opt}
                    onPress={() => setOfferDict(opt)}
                    style={[
                      styles.dictSegmentItem,
                      { backgroundColor: darkModeEnabled ? '#232323' : '#f5f5f5' },
                      offerDict === opt && styles.dictSegmentItemActive,
                    ]}
                  >
                    <Text style={[
                      styles.dictSegmentText,
                      { color: darkModeEnabled ? '#f0f0f0' : '#333' },
                      offerDict === opt && styles.dictSegmentTextActive,
                    ]}>
                      {getDictionaryMeta(opt).label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Word Mode */}
            <View style={styles.settingBlock}>
              <Text style={[styles.settingLabel, darkHeading]}>WORD MODE</Text>
              <View style={[styles.dictSegment, darkModeEnabled && { borderColor: '#3a3a3a' }]}>
                {([
                  { value: false, label: 'Manual' },
                  { value: true, label: 'Random' },
                ] as const).map(({ value, label }) => (
                  <Pressable
                    key={label}
                    onPress={() => setUseSeedMode(value)}
                    style={[
                      styles.dictSegmentItem,
                      { backgroundColor: darkModeEnabled ? '#232323' : '#f5f5f5' },
                      useSeedMode === value && styles.dictSegmentItemActive,
                    ]}
                  >
                    <Text style={[
                      styles.dictSegmentText,
                      { color: darkModeEnabled ? '#f0f0f0' : '#333' },
                      useSeedMode === value && styles.dictSegmentTextActive,
                    ]}>
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {useSeedMode ? (
              <View style={styles.cardInner}>
                <Text style={[styles.helper, darkHelper]}>Opponent's words chosen.</Text>
              </View>
            ) : (
              <>
                <View>
                  {offerWords.map((word, idx) => (
                    <TextInput
                      key={`offer-word-${idx}`}
                      value={word}
                      onChangeText={(value) => setOfferWordAt(idx, value)}
                      style={[
                        styles.wordRowInput,
                        { borderColor: darkModeEnabled ? '#3a3a3a' : '#e6e6e6' },
                        darkModeEnabled && { color: '#f2f2f2' },
                      ]}
                      placeholder={`${TARGET_LENGTHS[idx]} letter word`}
                      placeholderTextColor={darkModeEnabled ? '#8f8f8f' : '#888'}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      maxLength={TARGET_LENGTHS[idx]}
                    />
                  ))}
                </View>
                {parsedOfferWords.length > 0 && (
                  <Text style={[styles.helper, darkHelper]}>Words ({parsedOfferWords.length}/5): {parsedOfferWords.join(', ')}</Text>
                )}
              </>
            )}
              <Pressable style={styles.primaryBtn} onPress={handleCreateOffer}>
              <Text style={styles.primaryBtnText}>Create Challenge</Text>
            </Pressable>
            <View style={styles.jottsSectionDivider} />
            <View style={styles.jottsPickerSection}>
              {jotts.length > 0 ? (
                <>
                  <Text style={[styles.helper, darkHelper]}>Tap a saved jott to fill the 5 words for this challenge.</Text>
                  <Animated.FlatList
                    data={jotts}
                    keyExtractor={(item) => item.id}
                    horizontal
                    nestedScrollEnabled
                    showsHorizontalScrollIndicator={false}
                    decelerationRate="fast"
                    snapToInterval={STACK_CARD_STEP}
                    onMomentumScrollEnd={handleJottMomentumEnd}
                    style={styles.jottsList}
                    contentContainerStyle={{ paddingLeft: centeringPad, paddingRight: centeringPad, paddingBottom: 8 }}
                    onScroll={Animated.event(
                      [{ nativeEvent: { contentOffset: { x: jottStackScrollX } } }],
                      { useNativeDriver: true },
                    )}
                    scrollEventThrottle={16}
                    renderItem={({ item, index }) => {
                      const inputRange = [
                        (index - 1) * STACK_CARD_STEP,
                        index * STACK_CARD_STEP,
                        (index + 1) * STACK_CARD_STEP,
                      ];
                      const scale = jottStackScrollX.interpolate({
                        inputRange,
                        outputRange: [0.72, 1, 0.72],
                        extrapolate: 'clamp',
                      });
                      const translateY = jottStackScrollX.interpolate({
                        inputRange,
                        outputRange: [16, 0, 16],
                        extrapolate: 'clamp',
                      });
                      const opacity = jottStackScrollX.interpolate({
                        inputRange,
                        outputRange: [0.35, 1, 0.35],
                        extrapolate: 'clamp',
                      });
                      const isActive = index === selectedJottIndex;
                      return (
                        <Animated.View
                          style={[
                            styles.jottSnapItem,
                            index > 0 && { marginLeft: -STACK_CARD_OVERLAP },
                            {
                              zIndex: isActive ? jotts.length + 1 : jotts.length - index,
                              opacity,
                              transform: [{ translateY }, { scale }],
                            },
                          ]}
                        >
                          <Pressable
                            style={[
                              styles.jottCard,
                              darkModeEnabled && { backgroundColor: '#262626', borderColor: '#3a3a3a' },
                              isActive && styles.jottCardActive,
                            ]}
                            onPress={() => importWordsFromJott(item.words, 'create')}>
                            <View style={styles.jottCardHeader}>
                              <Text style={styles.jottCardTitle}>{item.title.toUpperCase()}</Text>
                            </View>
                            <View style={styles.jottCardBody}>
                              {item.words.map((word, i) => (
                                <View
                                  key={i}
                                  style={[
                                    styles.jottCardWordRow,
                                    i < item.words.length - 1 && styles.jottCardWordRowBorder,
                                    darkModeEnabled && i < item.words.length - 1 && { borderBottomColor: '#353535' },
                                  ]}
                                >
                                  <Text style={[styles.jottCardWord, darkModeEnabled && { color: '#f2f2f2' }]}>{word}</Text>
                                </View>
                              ))}
                            </View>
                          </Pressable>
                        </Animated.View>
                      );
                    }}
                  />
                  <View style={styles.jottsDotsRow}>
                    {jotts.map((_, i) => (
                      <View key={i} style={[styles.jottsDot, i === selectedJottIndex ? styles.jottsDotActive : styles.jottsDotInactive]} />
                    ))}
                  </View>
                </>
              ) : (
                <View style={[styles.jottsEmptyState, darkModeEnabled && { backgroundColor: '#202020', borderColor: '#3a3a3a' }]}>
                  <Text style={[styles.helper, darkHelper]}>No jotts saved yet. Open Jotts to save reusable word sets.</Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          <View style={[styles.card, darkCard]}>
            <Text style={[styles.heading, darkHeading]}>Share Your Challenge</Text>
            <View style={[styles.cardRule, darkRule]} />
            <Text style={[styles.helper, darkHelper]}>
              Send this code to your friend. When they send back a response code, paste it below to start playing.
            </Text>
            <QRCodeDisplay code={offerCode} type="Challenge" deepLink={linkFor('offer', offerCode)} />
            <Pressable style={[styles.actionBtn, darkModeEnabled && { backgroundColor: '#202020', borderColor: '#3a3a3a' }]} onPress={() => setOfferCode(null)}>
              <Text style={[styles.actionBtnText, darkModeEnabled && { color: '#f2f2f2' }]}>Create New Challenge</Text>
            </Pressable>
          </View>
        )
      )}

      {/* ─── Divider ─────────────────────────────────────────────── */}
      {!enterOnly && !createOnly && !offerCode && <Text style={[styles.divider, darkModeEnabled && { color: '#b8b8b8' }]}>— or —</Text>}

      {/* ─── Section 2: Enter Code ───────────────────────────────── */}
      {(!createOnly || offerCode) && <View style={[styles.card, darkCard]}>
        <Text style={[styles.heading, darkHeading]}>Enter Code</Text>
        <View style={[styles.cardRule, darkRule]} />
        <Text style={[styles.helper, darkHelper]}>
          Paste any challenge or response code from your friend.
        </Text>
        <TextInput
          multiline
          value={enterCode}
          onChangeText={(text) => {
            setEnterCode(text);
            // Clear detected offer if user changes the code
            if (detectedOffer) setDetectedOffer(null);
          }}
          placeholder="Paste code here"
          style={[styles.input, darkInput]}
          placeholderTextColor={darkModeEnabled ? '#9a9a9a' : undefined}
        />
        <Pressable style={styles.primaryBtn} onPress={handleEnterCode}>
          <Text style={styles.primaryBtnText}>Go</Text>
        </Pressable>

        {/* Offer detected: show word picker inline */}
        {detectedOffer && (
          <View style={styles.offerAcceptSection}>
            <Text style={[styles.headingSmall, darkHeading]}>Challenge from friend detected!</Text>
            <Text style={[styles.helper, darkHelper]}>
              Dictionary: {getDictionaryMeta(canonicalizeDictionaryId(detectedOffer.dictionaryId)).label}
              {detectedOffer.timerLimitSeconds ? ` | Timer: ${detectedOffer.timerLimitSeconds}s` : ''}
            </Text>
            <Text style={[styles.headingSmall, darkHeading]}>Pick 5 words for your friend to guess:</Text>
            <Text style={[styles.helper, darkHelper]}>Enter 5 words separated by spaces. Two 4-letter, two 5-letter, one 6-letter.</Text>
            <TextInput
              multiline
              value={returnWordsInput}
              onChangeText={setReturnWordsInput}
              placeholder="e.g. PLANE HOUSE DRINK LIVER CRANE"
              style={[styles.input, darkInput]}
              placeholderTextColor={darkModeEnabled ? '#9a9a9a' : undefined}
            />
            {parsedReturnWords.length > 0 && (
              <Text style={[styles.helper, darkHelper]}>Words ({parsedReturnWords.length}/5): {parsedReturnWords.join(', ')}</Text>
            )}
            {jotts.length > 0 && (
              <View style={styles.jottsPickerSection}>
                <Text style={[styles.headingSmall, darkHeading]}>Or import from Jotts:</Text>
                <Animated.FlatList
                  data={jotts}
                  keyExtractor={(item) => item.id}
                  horizontal
                  nestedScrollEnabled
                  showsHorizontalScrollIndicator={false}
                  decelerationRate="fast"
                  snapToInterval={STACK_CARD_STEP}
                  onMomentumScrollEnd={handleJottMomentumEnd}
                  style={styles.jottsList}
                  contentContainerStyle={{ paddingLeft: centeringPad, paddingRight: centeringPad, paddingBottom: 8 }}
                  onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { x: jottStackScrollX } } }],
                    { useNativeDriver: true },
                  )}
                  scrollEventThrottle={16}
                  renderItem={({ item, index }) => {
                    const inputRange = [
                      (index - 1) * STACK_CARD_STEP,
                      index * STACK_CARD_STEP,
                      (index + 1) * STACK_CARD_STEP,
                    ];
                    const scale = jottStackScrollX.interpolate({
                      inputRange,
                      outputRange: [0.72, 1, 0.72],
                      extrapolate: 'clamp',
                    });
                    const translateY = jottStackScrollX.interpolate({
                      inputRange,
                      outputRange: [16, 0, 16],
                      extrapolate: 'clamp',
                    });
                    const opacity = jottStackScrollX.interpolate({
                      inputRange,
                      outputRange: [0.35, 1, 0.35],
                      extrapolate: 'clamp',
                    });
                    const isActive = index === selectedJottIndex;
                    return (
                      <Animated.View
                        style={[
                          styles.jottSnapItem,
                          index > 0 && { marginLeft: -STACK_CARD_OVERLAP },
                          {
                            zIndex: isActive ? jotts.length + 1 : jotts.length - index,
                            opacity,
                            transform: [{ translateY }, { scale }],
                          },
                        ]}
                      >
                        <Pressable
                          style={[
                            styles.jottCard,
                            darkModeEnabled && { backgroundColor: '#262626', borderColor: '#3a3a3a' },
                            isActive && styles.jottCardActive,
                          ]}
                          onPress={() => importWordsFromJott(item.words, 'return')}>
                          <View style={styles.jottCardHeader}>
                            <Text style={styles.jottCardTitle}>{item.title.toUpperCase()}</Text>
                          </View>
                          <View style={styles.jottCardBody}>
                            {item.words.map((word, i) => (
                              <View
                                key={i}
                                style={[
                                  styles.jottCardWordRow,
                                  i < item.words.length - 1 && styles.jottCardWordRowBorder,
                                  darkModeEnabled && i < item.words.length - 1 && { borderBottomColor: '#353535' },
                                ]}
                              >
                                <Text style={[styles.jottCardWord, darkModeEnabled && { color: '#f2f2f2' }]}>{word}</Text>
                              </View>
                            ))}
                          </View>
                        </Pressable>
                      </Animated.View>
                    );
                  }}
                />
                <View style={styles.jottsDotsRow}>
                  {jotts.map((_, i) => (
                    <View key={i} style={[styles.jottsDot, i === selectedJottIndex ? styles.jottsDotActive : styles.jottsDotInactive]} />
                  ))}
                </View>
              </View>
            )}
            <Pressable style={styles.primaryBtn} onPress={handleAcceptAndStart}>
              <Text style={styles.primaryBtnText}>Accept & Start Playing</Text>
            </Pressable>
            {returnCode && (
              <View style={[styles.codeBox, darkModeEnabled && { backgroundColor: '#202020', borderColor: '#3a3a3a' }]}>
                <Text style={styles.successText}>Response created! Send this back to your friend:</Text>
                <QRCodeDisplay code={returnCode} type="Response" deepLink={linkFor('return', returnCode)} />
              </View>
            )}
          </View>
        )}
      </View>}

      <View style={styles.quickLinksRow}>
        <Pressable onPress={() => navigation.navigate('Jotts' as never)}>
          <Text style={[styles.quickLinkText, darkModeEnabled && { color: '#777' }]}>Jotts</Text>
        </Pressable>
        <Text style={[styles.quickLinkDot, darkModeEnabled && { color: '#555' }]}> · </Text>
        <Pressable onPress={() => navigation.navigate('ChallengeHistory' as never)}>
          <Text style={[styles.quickLinkText, darkModeEnabled && { color: '#777' }]}>History</Text>
        </Pressable>
        <Text style={[styles.quickLinkDot, darkModeEnabled && { color: '#555' }]}> · </Text>
        <Pressable onPress={() => navigation.navigate('Settings' as never)}>
          <Text style={[styles.quickLinkText, darkModeEnabled && { color: '#777' }]}>Settings</Text>
        </Pressable>
      </View>
    </ScrollView>

    {/* ─── Share Modal ──────────────────────────────────────────── */}
    <Modal
      visible={showShareModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowShareModal(false)}
    >
      <Pressable style={styles.modalBackdrop} onPress={() => setShowShareModal(false)}>
        <Pressable style={styles.modalCard} onPress={() => { /* prevent close on card tap */ }}>
          <Text style={styles.modalHeading}>Challenge Created!</Text>
          <Text style={styles.modalSubtext}>Code copied to clipboard. Share it with your friend.</Text>
          {offerCode && (
            <>
              <View style={styles.qrCodeWrapper}>
                <QRCode value={linkFor('offer', offerCode)} size={160} />
              </View>
              <Text selectable style={styles.codeText}>{offerCode}</Text>
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={styles.modalShareBtn}
                  onPress={() => { Clipboard.setStringAsync(offerCode); Alert.alert('Copied!', 'Code copied to clipboard'); }}
                >
                  <Text style={styles.modalShareBtnText}>📋 Copy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalShareBtn}
                  onPress={() => { Share.share({ message: `CrosSWords Challenge: ${offerCode}` }).catch(() => {}); }}
                >
                  <Text style={styles.modalShareBtnText}>📤 Share</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.modalShareBtn, { backgroundColor: '#25D366' }]}
                  onPress={async () => {
                    const url = `whatsapp://send?text=${encodeURIComponent(`CrosSWords Challenge: ${offerCode}`)}`;
                    const canOpen = await Linking.canOpenURL(url);
                    if (canOpen) await Linking.openURL(url);
                    else Alert.alert('WhatsApp not found', 'WhatsApp is not installed on this device.');
                  }}
                >
                  <Text style={styles.modalShareBtnText}>💬 WhatsApp</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalShareBtn, { backgroundColor: '#5856D6' }]}
                  onPress={async () => {
                    try { await Linking.openURL(`sms:?body=${encodeURIComponent(`CrosSWords Challenge: ${offerCode}`)}`); }
                    catch { Alert.alert('SMS not available', 'Could not open SMS on this device.'); }
                  }}
                >
                  <Text style={styles.modalShareBtnText}>📱 SMS</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
          <TouchableOpacity
            style={styles.modalDoneBtn}
            onPress={() => setShowShareModal(false)}
          >
            <Text style={styles.modalDoneBtnText}>Done</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: t.spacing.md,
    gap: t.spacing.sm,
    backgroundColor: LOBBY_SCREEN_BG,
  },
  card: {
    backgroundColor: LOBBY_SURFACE,
    padding: 16,
    borderRadius: 0,
    gap: 14,
    borderWidth: 1,
    borderColor: LOBBY_BORDER,
  },
  cardRule: {
    borderBottomWidth: 1,
    borderBottomColor: LOBBY_DIVIDER,
    marginTop: -2,
    marginBottom: 4,
  },
  cardInner: { gap: t.spacing.xs },
  heading: {
    fontFamily: t.typography.displayFamily,
    fontSize: 18,
    color: '#000',
  },
  headingSmall: {
    fontFamily: t.typography.displayFamily,
    fontSize: 15,
    color: '#000',
  },
  successText: {
    fontFamily: t.typography.bodyFamily,
    fontSize: 14,
    fontWeight: '600',
    color: t.colors.success,
  },
  helper: {
    fontFamily: t.typography.bodyFamily,
    fontSize: t.typography.captionSize,
    color: t.colors.textSecondary,
    lineHeight: 18,
  },
  input: {
    borderWidth: 1,
    borderColor: LOBBY_BORDER,
    borderRadius: 0,
    padding: 10,
    minHeight: 60,
    fontFamily: t.typography.bodyFamily,
    fontSize: t.typography.baseSize - 2,
    color: t.colors.textPrimary,
    backgroundColor: LOBBY_SURFACE,
  },
  wordRowInput: {
    fontFamily: t.typography.bodyFamily,
    fontSize: 15,
    color: t.colors.textPrimary,
    textTransform: 'uppercase',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  codeBox: {
    gap: t.spacing.xs,
    padding: 10,
    backgroundColor: '#f8f8f8',
    borderRadius: 0,
    borderWidth: 1,
    borderColor: LOBBY_DIVIDER,
  },
  codeText: { fontFamily: 'monospace', fontSize: 11, color: t.colors.textSecondary },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
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
  divider: {
    textAlign: 'center',
    color: '#777',
    fontFamily: t.typography.bodyFamily,
    fontSize: t.typography.captionSize,
    paddingVertical: t.spacing.xs,
  },
  offerAcceptSection: {
    gap: 10,
    marginTop: t.spacing.xs,
    paddingTop: t.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: LOBBY_DIVIDER,
  },
  jottsPickerSection: {
    gap: 8,
    marginTop: 4,
  },
  jottsSectionDivider: {
    borderTopWidth: 1,
    borderTopColor: LOBBY_DIVIDER,
    marginTop: 4,
    paddingTop: 10,
  },
  jottsEmptyState: {
    borderWidth: 1,
    borderColor: LOBBY_DIVIDER,
    borderRadius: 0,
    padding: t.spacing.sm,
    backgroundColor: '#f8f8f8',
  },
  jottsList: {
    overflow: 'visible',
  },
  jottSnapItem: {
    width: STACK_CARD_WIDTH,
  },
  jottCard: {
    width: '100%',
    backgroundColor: '#fff',
    elevation: 0,
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    borderWidth: 1,
    borderColor: '#e2e2e2',
    borderRadius: 0,
  },
  jottCardActive: {
    elevation: 8,
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
  },
  jottCardHeader: {
    backgroundColor: LOBBY_ACCENT,
    borderBottomWidth: 1,
    borderBottomColor: '#c81218',
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  jottCardTitle: {
    fontFamily: 'LibreBaskerville_700Bold',
    fontSize: 15,
    color: '#fff',
    textAlign: 'center',
  },
  jottCardBody: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'stretch',
  },
  jottCardWordRow: {
    paddingVertical: 4,
    alignItems: 'center',
  },
  jottCardWordRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#ededed',
  },
  jottCardWord: {
    fontFamily: 'NotoSerif_400Regular',
    fontSize: 15,
    color: t.colors.textPrimary,
    lineHeight: 22,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  jottsDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  jottsDot: {
    borderRadius: 99,
  },
  jottsDotActive: {
    width: 8,
    height: 8,
    backgroundColor: '#E7131A',
  },
  jottsDotInactive: {
    width: 6,
    height: 6,
    backgroundColor: '#ccc',
  },
  clipboardBanner: {
    backgroundColor: '#fff5f5',
    borderWidth: 1.5,
    borderColor: LOBBY_ACCENT,
    borderRadius: t.radii.md,
    padding: t.spacing.sm,
    marginBottom: 4,
  },
  clipboardBannerText: {
    color: t.colors.textPrimary,
    fontFamily: t.typography.displayFamily,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  qrContainer: {
    gap: t.spacing.sm,
    alignItems: 'center',
    paddingVertical: t.spacing.xs,
  },
  qrCodeWrapper: {
    padding: t.spacing.sm,
    backgroundColor: LOBBY_SURFACE,
    borderRadius: t.radii.md,
    borderWidth: 2,
    borderColor: LOBBY_ACCENT,
    ...t.shadows.soft,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: t.spacing.sm,
    width: '100%',
    justifyContent: 'center',
  },
  // ── Button styles ────────────────────────────────────────────
  primaryBtn: {
    backgroundColor: LOBBY_ACCENT,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 0,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontFamily: t.typography.displayFamily,
    fontSize: 15,
    fontWeight: '600',
  },
  actionBtn: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#1e1e1e',
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#000',
    fontFamily: t.typography.displayFamily,
    fontSize: 13,
    fontWeight: '600',
  },
  settingBlock: {
    gap: 6,
  },
  settingLabel: {
    fontFamily: t.typography.displayFamily,
    fontSize: 11,
    letterSpacing: 1.2,
    color: '#000',
  },
  dictSegment: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: LOBBY_BORDER,
    borderRadius: 4,
    overflow: 'hidden',
    width: '100%',
  },
  dictSegmentItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },
  dictSegmentItemActive: {
    backgroundColor: '#E7131A',
  },
  dictSegmentText: {
    fontFamily: t.typography.displayFamily,
    fontSize: 13,
  },
  dictSegmentTextActive: {
    color: '#fff',
  },
  toggleBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: LOBBY_BORDER,
    backgroundColor: LOBBY_SURFACE,
  },
  toggleBtnActive: {
    backgroundColor: LOBBY_ACCENT,
    borderColor: LOBBY_ACCENT,
  },
  toggleBtnText: {
    fontFamily: t.typography.displayFamily,
    fontSize: 13,
    color: t.colors.textSecondary,
  },
  toggleBtnTextActive: {
    color: '#fff',
  },
  quickLinksRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
  },
  quickLinkText: {
    fontSize: 16,
    color: '#888',
    fontFamily: t.typography.bodyFamily,
    paddingVertical: 4,
  },
  quickLinkDot: {
    fontSize: 16,
    color: '#bbb',
  },
  // ── Modal styles ──────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: t.spacing.md,
  },
  modalCard: {
    backgroundColor: t.colors.surfacePrimary,
    borderRadius: t.radii.md,
    padding: t.spacing.md,
    width: '100%',
    maxWidth: 380,
    gap: t.spacing.sm,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeading: {
    fontFamily: t.typography.displayFamily,
    fontSize: t.typography.headingSize - 4,
    fontWeight: '700',
    color: t.colors.textPrimary,
    textAlign: 'center',
  },
  modalSubtext: {
    fontFamily: t.typography.bodyFamily,
    fontSize: t.typography.baseSize - 1,
    color: t.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalShareBtn: {
    flex: 1,
    backgroundColor: t.colors.accent,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: t.radii.sm,
    alignItems: 'center',
  },
  modalShareBtnText: {
    color: '#fff',
    fontFamily: t.typography.displayFamily,
    fontSize: 14,
    fontWeight: '600',
  },
  modalDoneBtn: {
    backgroundColor: t.colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: t.radii.md,
    width: '100%',
    alignItems: 'center',
    marginTop: t.spacing.xs,
  },
  modalDoneBtnText: {
    color: t.colors.accentText,
    fontFamily: t.typography.displayFamily,
    fontSize: 16,
    fontWeight: '700',
  },
});
