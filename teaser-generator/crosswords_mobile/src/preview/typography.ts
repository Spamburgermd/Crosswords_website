/**
 * typography.ts
 * Atlantic Design System typography: Noto Serif (body/buttons), Libre Baskerville (headings).
 * Use these styles in preview screens for consistent fonts without rewriting every file.
 */
import { StyleSheet } from 'react-native';

export const BODY_FONT = 'NotoSerif_400Regular';
export const DISPLAY_FONT = 'LibreBaskerville_400Regular';
export const DISPLAY_BOLD = 'LibreBaskerville_700Bold';

export const typography = StyleSheet.create({
  bodyText: {
    fontFamily: BODY_FONT,
    fontSize: 16,
  },
  buttonText: {
    fontFamily: BODY_FONT,
    fontSize: 16,
  },
  heading1: {
    fontFamily: DISPLAY_BOLD,
    fontSize: 26,
  },
  heading2: {
    fontFamily: DISPLAY_BOLD,
    fontSize: 22,
  },
  heading3: {
    fontFamily: DISPLAY_BOLD,
    fontSize: 18,
  },
  heading4: {
    fontFamily: DISPLAY_BOLD,
    fontSize: 16,
  },
  heading5: {
    fontFamily: DISPLAY_BOLD,
    fontSize: 14,
  },
  heading6: {
    fontFamily: DISPLAY_BOLD,
    fontSize: 12,
  },
});
