/**
 * src/stores/sessionStore.ts
 * ---------------------------------------------
 * Tracks session-level configuration such as the API key, currently active game,
 * and the five words the player plans to submit. We keep these in Zustand so the
 * data can be shared between Title, Lobby, and Board screens without prop drilling.
 */
import { create } from 'zustand';

import { loginOrRegisterForTesting } from '../lib/api';
import { isServerFunctionsEnabled } from '../flags';
import {
  clearGuessView,
  lockGuess as lockGuessView,
  lockGuessByRowId as lockGuessByRowIdView,
  previewGuess as previewGuessView,
  previewGuessByRowId as previewGuessByRowIdView,
  toSelectedGuessIndexByWord,
  unlockGuess as unlockGuessView,
  type GuessViewStateByTarget,
} from '../lib/guessDisplayState';

const DEFAULT_WORDS = ['FREE', 'TREE', 'MOUSE', 'HOUSE', 'LETTER'];

// TESTING ONLY — remove before production. Replace with your test user; will auto-register if missing.
const TEST_USERNAME = 'testuser';
const TEST_PASSWORD = 'testpass123';

/** @deprecated Legacy alias kept so archived screens still type-check. */
export type SelectedGuessIndexByWord = Record<number, number | null>;

export type SessionState = {
  apiKey: string;
  activeGameId: number | null;
  words: string[];
  guessViewStateByTarget: GuessViewStateByTarget;
  /** @deprecated Use guessViewStateByTarget instead. */
  selectedGuessIndexByWord: SelectedGuessIndexByWord;
  isAutoLoginAttempted: boolean;
  isAutoLoginInFlight: boolean;
  autoLoginError: string | undefined;
  setApiKey: (value: string) => void;
  setActiveGameId: (value: number | null) => void;
  setWord: (index: number, value: string) => void;
  setWords: (values: string[]) => void;
  previewGuess: (targetIndex: number, guessIndex: number) => void;
  lockGuess: (targetIndex: number, guessIndex: number) => void;
  previewGuessByRowId: (targetIndex: number, rowId: string) => void;
  lockGuessByRowId: (targetIndex: number, rowId: string) => void;
  unlockGuess: (targetIndex: number) => void;
  clearGuessView: (targetIndex: number) => void;
  /** @deprecated Use previewGuess / lockGuess / unlockGuess instead. */
  setSelectedGuessIndex: (wordIndex: number, guessIndexOrNull: number | null) => void;
  resetWords: (words?: string[]) => void;
  resetSession: () => void;
  ensureApiKey: () => Promise<void>;
};

const initialApiKey = process.env.EXPO_PUBLIC_API_KEY || '';

function withLegacySelectedGuessIndex(
  guessViewStateByTarget: GuessViewStateByTarget,
): Pick<SessionState, 'guessViewStateByTarget' | 'selectedGuessIndexByWord'> {
  return {
    guessViewStateByTarget,
    selectedGuessIndexByWord: toSelectedGuessIndexByWord(guessViewStateByTarget),
  };
}

const useSessionStore = create<SessionState>((set, get) => ({
  apiKey: initialApiKey,
  activeGameId: null,
  words: DEFAULT_WORDS,
  guessViewStateByTarget: {},
  selectedGuessIndexByWord: {},
  isAutoLoginAttempted: false,
  isAutoLoginInFlight: false,
  autoLoginError: undefined,
  setApiKey: (value) => set({ apiKey: value.trim() }),
  setActiveGameId: (value) => set({ activeGameId: value }),
  setWord: (index, value) =>
    set((state) => {
      const next = [...state.words];
      if (index >= 0 && index < next.length) {
        next[index] = value.replace(/[^A-Za-z]/g, '').toUpperCase();
      }
      return { words: next };
    }),
  setWords: (values) =>
    set({ words: values.map((word) => word.replace(/[^A-Za-z]/g, '').toUpperCase()).slice(0, 5) }),
  previewGuess: (targetIndex, guessIndex) =>
    set((state) => withLegacySelectedGuessIndex(
      previewGuessView(state.guessViewStateByTarget, targetIndex, guessIndex),
    )),
  lockGuess: (targetIndex, guessIndex) =>
    set((state) => withLegacySelectedGuessIndex(
      lockGuessView(state.guessViewStateByTarget, targetIndex, guessIndex),
    )),
  previewGuessByRowId: (targetIndex, rowId) =>
    set((state) => withLegacySelectedGuessIndex(
      previewGuessByRowIdView(state.guessViewStateByTarget, targetIndex, rowId),
    )),
  lockGuessByRowId: (targetIndex, rowId) =>
    set((state) => withLegacySelectedGuessIndex(
      lockGuessByRowIdView(state.guessViewStateByTarget, targetIndex, rowId),
    )),
  unlockGuess: (targetIndex) =>
    set((state) => withLegacySelectedGuessIndex(
      unlockGuessView(state.guessViewStateByTarget, targetIndex),
    )),
  clearGuessView: (targetIndex) =>
    set((state) => withLegacySelectedGuessIndex(
      clearGuessView(state.guessViewStateByTarget, targetIndex),
    )),
  setSelectedGuessIndex: (wordIndex, guessIndexOrNull) =>
    set((state) => withLegacySelectedGuessIndex(
      guessIndexOrNull == null
        ? clearGuessView(state.guessViewStateByTarget, wordIndex)
        : lockGuessView(state.guessViewStateByTarget, wordIndex, guessIndexOrNull),
    )),
  resetWords: (words = DEFAULT_WORDS) => set({ words }),
  resetSession: () =>
    set({
      activeGameId: null,
      words: DEFAULT_WORDS,
      ...withLegacySelectedGuessIndex({}),
    }),
  ensureApiKey: async () => {
    if (!isServerFunctionsEnabled()) {
      set({ isAutoLoginAttempted: true, isAutoLoginInFlight: false, autoLoginError: undefined });
      return;
    }
    const state = get();
    if (state.apiKey?.trim()) return;
    if (state.isAutoLoginAttempted) return;
    set({ isAutoLoginInFlight: true });
    const result = await loginOrRegisterForTesting(TEST_USERNAME, TEST_PASSWORD);
    set({
      isAutoLoginAttempted: true,
      isAutoLoginInFlight: false,
      autoLoginError: result.ok ? undefined : result.error,
      ...(result.ok ? { apiKey: result.api_key } : {}),
    });
  },
}));

export default useSessionStore;

