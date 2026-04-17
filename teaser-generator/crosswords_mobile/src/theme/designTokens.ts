/**
 * src/theme/designTokens.ts
 * -----------------------------------------------------------
 * Beginner-friendly map of the visual tokens described in the
 * Crossroads HTML mock. React Native cannot understand `clamp()`
 * or CSS variables, so we convert every value into plain numbers
 * or hex colors that work across iOS, Android, and web builds.
 *
 * Usage:
 *   import { DESIGN_TOKEN_SETS } from '@theme/designTokens';
 *   const tokens = DESIGN_TOKEN_SETS.crossroads; // or .classic
 *
 * Later steps wire these tokens into styled components so we can
 * flip between the original parchment look and the new Crossroads
 * frame without touching business logic.
 */

import colors from './colors';

/**
 * Describes design foundations the app can share:
 * - colors: raw hex codes for backgrounds, text, accents
 * - spacing: base gaps measured in device-independent pixels
 * - radii: rounded corner sizes
 * - typography: font families and default sizes
 * - shadows: drop-shadow recipes we can re-use
 */
export type DesignTokens = {
  id: 'classic' | 'crossroads' | 'atlantic';
  name: string;
  description: string;
  colors: {
    screenBackground: string;
    canvas: string;
    surfacePrimary: string;
    surfaceHighlight: string;
    textPrimary: string;
    textSecondary: string;
    accent: string;
    accentMuted: string;
    accentText: string;
    borderStrong: string;
    borderSubtle: string;
    success: string;
    warning: string;
    danger: string;
  };
  spacing: {
    /** Smallest gap for tight clusters such as icon + label combos. */
    xs: number;
    /** Default gap for cards, panels, and stacked sections. */
    sm: number;
    /** Larger breathing room around big blocks such as the board. */
    md: number;
    /** Generous padding for modal sheets or safe-area offsets. */
    lg: number;
  };
  radii: {
    /** Soft rounding for chips and small buttons. */
    sm: number;
    /** Medium rounding used by cards and surfaces. */
    md: number;
    /** Hero rounding for screen frames or bottom sheets. */
    lg: number;
    /** Circle helper for avatars or floating action buttons. */
    full: number;
  };
  typography: {
    /** Primary UI font family (loaded via expo-font later). */
    bodyFamily: string;
    /** Secondary/heading family for decorative text. */
    displayFamily: string;
    /** Base paragraph size in React Native points. */
    baseSize: number;
    /** Compact caption size for tiny labels. */
    captionSize: number;
    /** Heading size for screen titles. */
    headingSize: number;
  };
  shadows: {
    /** Subtle card shadow that works on both platforms. */
    soft: {
      offset: { width: number; height: number };
      radius: number;
      opacity: number;
      color: string;
    };
    /** Elevated shadow for floating elements (FAB, modals). */
    strong: {
      offset: { width: number; height: number };
      radius: number;
      opacity: number;
      color: string;
    };
  };
};

/**
 * Classic parchment tokens match the current in-app look so we
 * can switch back instantly if a new component misbehaves.
 */
const classicTokens: DesignTokens = {
  id: 'classic',
  name: 'Classic Parchment',
  description: 'Existing parchment and rope styling shipped in Step 2.',
  colors: {
    screenBackground: colors.parchment,
    canvas: '#f6f0e6',
    surfacePrimary: colors.parchment,
    surfaceHighlight: '#f6f0e6',
    textPrimary: colors.ink,
    textSecondary: colors.muted,
    accent: colors.gold,
    accentMuted: colors.rope,
    accentText: colors.ink,
    borderStrong: colors.rope,
    borderSubtle: '#d9c7ab',
    success: colors.green,
    warning: colors.yellow,
    danger: colors.red,
  },
  spacing: {
    xs: 8,
    sm: 12,
    md: 20,
    lg: 28,
  },
  radii: {
    sm: 6,
    md: 12,
    lg: 24,
    full: 999,
  },
  typography: {
    bodyFamily: 'LibreBaskerville_400Regular',
    displayFamily: 'CinzelDecorative_700Bold',
    baseSize: 16,
    captionSize: 12,
    headingSize: 28,
  },
  shadows: {
    soft: {
      offset: { width: 0, height: 2 },
      radius: 4,
      opacity: 0.18,
      color: colors.shadow,
    },
    strong: {
      offset: { width: 0, height: 6 },
      radius: 16,
      opacity: 0.22,
      color: colors.shadow,
    },
  },
};

/**
 * Crossroads tokens translate the new HTML mock values.
 * We pick single numbers that feel closest to the clamp()
 * mid-points so the app looks balanced on phones and tablets.
 */
const crossroadsTokens: DesignTokens = {
  id: 'crossroads',
  name: 'Crossroads Noir',
  description: 'Dark canvas with parchment highlights from the design mock.',
  colors: {
    screenBackground: '#1b1b1b',
    canvas: '#050505',
    surfacePrimary: '#2d2b28',
    surfaceHighlight: '#f1eadf',
    textPrimary: '#f4f1ec',
    textSecondary: '#c6c2ba',
    accent: '#ede4d6',
    accentMuted: '#7a6e5f',
    accentText: '#1c1b18',
    borderStrong: '#3d392f',
    borderSubtle: 'rgba(244, 241, 236, 0.12)',
    success: '#6aaa64',
    warning: '#c9b458',
    danger: '#f94144',
  },
  spacing: {
    xs: 6,
    sm: 14,
    md: 22,
    lg: 32,
  },
  radii: {
    sm: 10,
    md: 18,
    lg: 32,
    full: 999,
  },
  typography: {
    bodyFamily: 'Inter_500Medium',
    displayFamily: 'Inter_600SemiBold',
    baseSize: 15,
    captionSize: 12,
    headingSize: 24,
  },
  shadows: {
    soft: {
      offset: { width: 0, height: 4 },
      radius: 8,
      opacity: 0.28,
      color: 'rgba(5, 5, 5, 0.6)',
    },
    strong: {
      offset: { width: 0, height: 10 },
      radius: 24,
      opacity: 0.35,
      color: 'rgba(0, 0, 0, 0.75)',
    },
  },
};

/**
 * Atlantic Design System: Noto Serif (body/button), Libre Baskerville (headings).
 */
const atlanticTokens: DesignTokens = {
  id: 'atlantic',
  name: 'Atlantic',
  description: 'Design system: Noto Serif body, Libre Baskerville headings.',
  colors: {
    screenBackground: '#fdfdfd',
    canvas: '#f6f0e6',
    surfacePrimary: '#fdfdfd',
    surfaceHighlight: '#f4f4f4',
    textPrimary: '#1c1b18',
    textSecondary: '#444',
    accent: '#1e1e1e',
    accentMuted: '#666',
    accentText: '#fff',
    borderStrong: '#1e1e1e',
    borderSubtle: '#e2e2e2',
    success: '#6aaa64',
    warning: '#c9b458',
    danger: '#f94144',
  },
  spacing: {
    xs: 6,
    sm: 14,
    md: 22,
    lg: 32,
  },
  radii: {
    sm: 6,
    md: 12,
    lg: 24,
    full: 999,
  },
  typography: {
    bodyFamily: 'NotoSerif_400Regular',
    displayFamily: 'LibreBaskerville_400Regular',
    baseSize: 16,
    captionSize: 12,
    headingSize: 26,
  },
  shadows: {
    soft: {
      offset: { width: 0, height: 2 },
      radius: 4,
      opacity: 0.18,
      color: 'rgba(0,0,0,0.12)',
    },
    strong: {
      offset: { width: 0, height: 6 },
      radius: 16,
      opacity: 0.22,
      color: 'rgba(0,0,0,0.2)',
    },
  },
};

/**
 * Helper object so callers can grab the tokens by id. We keep the
 * type narrowed for editor autocompletion and safer usage.
 */
export const DESIGN_TOKEN_SETS: Record<DesignTokens['id'], DesignTokens> = {
  classic: classicTokens,
  crossroads: crossroadsTokens,
  atlantic: atlanticTokens,
};

/**
 * Returns both token sets as a tuple. Handy for dropdowns where the
 * UI lists available themes. We keep it isolated to avoid accidental
 * mutation of the source objects.
 */
export const AVAILABLE_TOKEN_SETS = Object.values(DESIGN_TOKEN_SETS).map(
  (tokens) => ({ ...tokens }),
);
