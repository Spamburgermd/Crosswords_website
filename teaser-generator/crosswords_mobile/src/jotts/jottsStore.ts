/**
 * src/jotts/jottsStore.ts
 * ---------------------------------------------
 * Local-only Jotts store, persisted with AsyncStorage.
 * A "Jott" is a saved 5-word set plus dictionary choice for quick reuse.
 */

import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DictionaryId } from '../dictionary/dictionaryAdapter';

export type Jott = {
  id: string;
  title: string;
  words: string[]; // exactly 5 words
  dictionaryId: DictionaryId;
  createdAtMs: number;
  updatedAtMs: number;
};

type JottsState = {
  jotts: Jott[];
  addJott: (j: Omit<Jott, 'id' | 'createdAtMs' | 'updatedAtMs'>) => Jott;
  updateJott: (id: string, updater: Partial<Jott>) => void;
  deleteJott: (id: string) => void;
  useJott: (id: string) => Jott | null;
};

const MAX_JOTTS = 10;
const genId = () => `j_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`;
const JOTTS_STORAGE_KEY = 'crosswords:jotts:v1';

/**
 * In-memory storage fallback so the app still runs if AsyncStorage native module
 * is unavailable in the current build. This avoids hard crashes and preserves
 * existing in-memory behavior until a rebuilt native binary is installed.
 */
const memoryStorage = new Map<string, string>();
const memoryStateStorage: StateStorage = {
  getItem: async (name) => memoryStorage.get(name) ?? null,
  setItem: async (name, value) => {
    memoryStorage.set(name, value);
  },
  removeItem: async (name) => {
    memoryStorage.delete(name);
  },
};

function resolveStateStorage(): StateStorage {
  if (
    AsyncStorage &&
    typeof AsyncStorage.getItem === 'function' &&
    typeof AsyncStorage.setItem === 'function' &&
    typeof AsyncStorage.removeItem === 'function'
  ) {
    return AsyncStorage;
  }
  if (__DEV__) {
    // Helpful warning for local debugging when the native module was not linked.
    console.warn('[jottsStore] AsyncStorage native module unavailable; using in-memory fallback.');
  }
  return memoryStateStorage;
}

const useJottsStore = create<JottsState>()(
  persist(
    (set, get) => ({
      jotts: [],
      addJott: (j) => {
        const next: Jott = {
          ...j,
          id: genId(),
          createdAtMs: Date.now(),
          updatedAtMs: Date.now(),
        };
        set((state) => {
          const merged = [next, ...state.jotts].slice(0, MAX_JOTTS);
          return { jotts: merged };
        });
        return next;
      },
      updateJott: (id, updater) =>
        set((state) => ({
          jotts: state.jotts.map((j) =>
            j.id === id ? { ...j, ...updater, updatedAtMs: Date.now() } : j,
          ),
        })),
      deleteJott: (id) => set((state) => ({ jotts: state.jotts.filter((j) => j.id !== id) })),
      useJott: (id) => get().jotts.find((j) => j.id === id) ?? null,
    }),
    {
      name: JOTTS_STORAGE_KEY,
      storage: createJSONStorage(resolveStateStorage),
      // Only persist the saved Jotts list; methods are recreated automatically.
      partialize: (state) => ({ jotts: state.jotts }),
    },
  ),
);

export default useJottsStore;
