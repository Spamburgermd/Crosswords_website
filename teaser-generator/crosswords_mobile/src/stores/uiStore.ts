/**
 * src/stores/uiStore.ts
 * ---------------------------------------------
 * Simplified UI store with a single locked theme. Theme switching is removed to
 * reduce moving parts during gameplay.
 *
 * User preferences are persisted to AsyncStorage via zustand/middleware so they
 * survive app restarts (dark mode, dictionary, tutorial completion, etc.).
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ImageSourcePropType } from 'react-native';

import colors from '../theme/colors';
import { ENABLE_CROSSROADS_STYLES } from '../flags';
import { DESIGN_TOKEN_SETS, type DesignTokens } from '../theme/designTokens';
import type { ColorblindMode } from '../theme/feedbackColors';

export type BoardPalette = {
  frameBackground: string;
  frameBorder: string;
  openFill: string;
  blockedFill: string;
  numbering: string;
  highlightFill: string;
  highlightBorder: string;
};

export type ThemeDefinition = {
  id: string;
  name: string;
  description: string;
  backgroundGradient: [string, string, string];
  backgroundImage: ImageSourcePropType;
  surfacePrimary: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  accentMuted: string;
  accentText: string;
  secondaryButtonBackground: string;
  secondaryButtonBorder: string;
  tileBackground: string;
  tileBorder: string;
  tileLetter: string;
  bannerActive: string;
  bannerWaiting: string;
  inputBackground: string;
  inputBorder: string;
  boardPalette: BoardPalette;
};

const DEFAULT_BOARD_PALETTE: BoardPalette = {
  frameBackground: '#000000ff',
  frameBorder: '#b49a9aff',
  openFill: '#f5d7ab',
  blockedFill: '#0f1d27',
  numbering: '#4f3a2d',
  highlightFill: '#d5a966',
  highlightBorder: '#926630',
};

const baseTheme: ThemeDefinition = {
  id: 'default',
  name: 'Default',
  description: 'Locked default theme',
  backgroundGradient: [colors.parchment, colors.parchment, colors.parchment],
  backgroundImage: require('../../assets/backgrounds/twilight-orchid.png'),
  surfacePrimary: colors.parchment,
  textPrimary: colors.ink,
  textSecondary: colors.muted,
  accent: colors.gold,
  accentMuted: colors.rope,
  accentText: colors.ink,
  secondaryButtonBackground: '#E9D9C4',
  secondaryButtonBorder: colors.rope,
  tileBackground: colors.parchment,
  tileBorder: colors.rope,
  tileLetter: colors.ink,
  bannerActive: colors.gold,
  bannerWaiting: colors.rope,
  inputBackground: '#F6EEDF',
  inputBorder: colors.rope,
  boardPalette: { ...DEFAULT_BOARD_PALETTE },
};

const BUILT_IN_THEMES: ThemeDefinition[] = [baseTheme];

export type DictionaryPreference = 'core' | 'standard' | 'advanced' | 'canon' | 'junior' | 'twl';

type UIThemeState = {
  themes: ThemeDefinition[];
  activeThemeId: string;
  activeTheme: ThemeDefinition;
  designTokens: DesignTokens;
  lockGreenLetters: boolean;
  botBanterEnabled: boolean;
  darkModeEnabled: boolean;
  dictionary: DictionaryPreference;
  hasCompletedTutorial: boolean;
  /** When true, blue letter tiles in the alphabet panel show remaining count badges. */
  alphabetShowBlueCounts: boolean;
  /** Swap feedback colors to a colorblind-accessible palette. */
  colorblindMode: ColorblindMode;
  /** Swap ⌫ and ? key positions so ? is on row 2 right and ⌫ is on row 3 left. */
  swapBackspaceHelp: boolean;
  /** Show the blue letter tracker rail (pencil-mark helper). When off, rely on tile fading alone. */
  showBlueTicker: boolean;
  /** Active board tile color scheme (matches a key in TILE_PALETTES). */
  colorScheme: string;
  /** True once AsyncStorage hydration finishes. Gate first-launch checks on this. */
  _hydrated: boolean;
  setActiveTheme: (id: string) => void;
  setLockGreenLetters: (value: boolean) => void;
  setBotBanterEnabled: (value: boolean) => void;
  setDarkModeEnabled: (value: boolean) => void;
  setDictionary: (value: DictionaryPreference) => void;
  setHasCompletedTutorial: (value: boolean) => void;
  setAlphabetShowBlueCounts: (value: boolean) => void;
  setColorblindMode: (value: ColorblindMode) => void;
  setSwapBackspaceHelp: (value: boolean) => void;
  setShowBlueTicker: (value: boolean) => void;
  setColorScheme: (value: string) => void;
};

const useUIStore = create<UIThemeState>()(
  persist(
    (set, get) => ({
      themes: BUILT_IN_THEMES,
      activeThemeId: BUILT_IN_THEMES[0].id,
      activeTheme: BUILT_IN_THEMES[0],
      designTokens: ENABLE_CROSSROADS_STYLES ? DESIGN_TOKEN_SETS.crossroads : DESIGN_TOKEN_SETS.classic,
      lockGreenLetters: true,
      botBanterEnabled: true,
      darkModeEnabled: false,
      dictionary: 'core' as DictionaryPreference,
      hasCompletedTutorial: false,
      alphabetShowBlueCounts: false,
      colorblindMode: 'none' as ColorblindMode,
      swapBackspaceHelp: false,
      showBlueTicker: true,
      colorScheme: 'classic',
      _hydrated: false,
      setActiveTheme: (id: string) => {
        const theme = get().themes.find((t) => t.id === id);
        if (theme) {
          set({ activeThemeId: id, activeTheme: theme });
        }
      },
      setLockGreenLetters: (value: boolean) => set({ lockGreenLetters: value }),
      setBotBanterEnabled: (value: boolean) => set({ botBanterEnabled: value }),
      setDarkModeEnabled: (value: boolean) => set({ darkModeEnabled: value }),
      setDictionary: (value: DictionaryPreference) => set({ dictionary: value }),
      setHasCompletedTutorial: (value: boolean) => set({ hasCompletedTutorial: value }),
      setAlphabetShowBlueCounts: (value: boolean) => set({ alphabetShowBlueCounts: value }),
      setColorblindMode: (value: ColorblindMode) => set({ colorblindMode: value }),
      setSwapBackspaceHelp: (value: boolean) => set({ swapBackspaceHelp: value }),
      setShowBlueTicker: (value: boolean) => set({ showBlueTicker: value }),
      setColorScheme: (value: string) => set({ colorScheme: value }),
    }),
    {
      name: 'crosswords-ui-prefs',
      version: 4,
      storage: createJSONStorage(() => AsyncStorage),
      migrate: (persistedState, version) => {
        if (!persistedState || typeof persistedState !== 'object') return persistedState as UIThemeState;
        const state = persistedState as UIThemeState & { dictionary?: string };
        if (version < 3) {
          const raw = (state.dictionary || '').toLowerCase();
          if (raw === 'common') state.dictionary = 'core';
          else if (raw === 'modified') state.dictionary = 'standard';
          else if (raw === 'twl') state.dictionary = 'canon';
          else if (raw !== 'core' && raw !== 'standard' && raw !== 'advanced' && raw !== 'canon' && raw !== 'junior') {
            state.dictionary = 'core';
          }
        }
        if (version < 4) {
          if (!state.colorScheme) state.colorScheme = 'classic';
        }
        return state;
      },
      partialize: (state) => ({
        lockGreenLetters: state.lockGreenLetters,
        botBanterEnabled: state.botBanterEnabled,
        darkModeEnabled: state.darkModeEnabled,
        dictionary: state.dictionary,
        hasCompletedTutorial: state.hasCompletedTutorial,
        alphabetShowBlueCounts: state.alphabetShowBlueCounts,
        colorblindMode: state.colorblindMode,
        swapBackspaceHelp: state.swapBackspaceHelp,
        showBlueTicker: state.showBlueTicker,
        colorScheme: state.colorScheme,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          useUIStore.setState({ _hydrated: true });
        }
      },
    },
  ),
);

export default useUIStore;
