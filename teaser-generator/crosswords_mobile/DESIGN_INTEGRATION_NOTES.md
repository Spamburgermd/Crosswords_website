<!--
  DESIGN_INTEGRATION_NOTES.md
  ------------------------------------------------------------
  Beginner checklist for adopting the Crossroads visual refresh.
  This document will grow as we wire the tokens into components.
-->

# Crossroads Design Integration Notes

## Why this file exists

The static HTML mock from `Design Elements  Hold/index.html` introduces brand-new colors, spacing, and typography. To avoid breaking the running game, we will introduce those styles alongside the existing parchment look and flip between them when we are ready.

## Token sets (Step 1 ✅)

1. Location: `src/theme/designTokens.ts`
2. How to use right now:
   ```ts
   import { DESIGN_TOKEN_SETS } from '@theme/designTokens';

   const classic = DESIGN_TOKEN_SETS.classic;
   const crossroads = DESIGN_TOKEN_SETS.crossroads;
   ```
3. You can read values (e.g., `crossroads.colors.screenBackground`) and use them inside components today. No other wiring is required yet.

## Theme toggle plan (Step 2 🚧)

1. Toggle name: `EXPO_PUBLIC_ENABLE_CROSSROADS_STYLES` (already wired in `src/flags.ts`).
2. Expo instructions:
   - Copy `.env.example` to `.env` if you have not already.
   - Set `EXPO_PUBLIC_ENABLE_CROSSROADS_STYLES=true`.
   - Reload the app; the zustand `uiStore` exposes the matching token set under `designTokens`.
3. Update `ScreenFrame` (to be created) to pick the token set based on the flag. The frame will wrap `TitleScreen`, `LobbyScreen`, and `BoardScreen`.
4. Until the toggle ships, prefer `DESIGN_TOKEN_SETS.crossroads` only in preview/demo components so we do not surprise existing players.

### Quick test for the flag

1. Ensure Expo server is running: `cd crosswords_mobile && npx expo start`.
2. Set `EXPO_PUBLIC_ENABLE_CROSSROADS_STYLES=true` in `.env`.
3. Reload the app. In the React Native debugger console, run `useUIStore.getState().designTokens.id` and confirm it returns `"crossroads"`.

## Preview harness concept (Step 3 🧪)

1. Add `EXPO_PUBLIC_PREVIEW_SCREEN=crossroads-gallery` to `.env` while working on visuals.
2. `App.tsx` already reads this flag and renders the gallery when it is set.
3. The gallery shows primitive components (header chips, segment buttons, hint tiles) using mocked data so we can test visuals without joining a live match.

### How to test once the gallery exists

1. `cd crosswords_mobile`
2. `npx expo start` (scan the QR code with Expo Go)
3. Set `EXPO_PUBLIC_PREVIEW_SCREEN=crossroads-gallery` in `.env`
4. Clear Metro cache the first time (`npx expo start -c`) so the new flag is picked up.
5. Reload the app (shake device → Reload on iOS, press `r` in the Metro console for Android).
6. Browse the gallery cards; confirm each primitive renders and interaction states (pressed/disabled) look correct.

### Current gallery contents (Step 3 initial pass ✅)

- Screen frame preview that mirrors the dark canvas + parchment interior.
- `HeaderChip`, `SegmentButton`, and `HintTile` from `src/ui/` rendered with placeholder data.
- All colors/spacing sourced from `useUIStore.getState().designTokens`.

## TitleScreen restyle status

- Crossroads flag replaces the parchment layout with token-driven components.
- `ScreenFrame` wraps the screen, providing the dark canvas and safe-area padding.
- Inputs/buttons reuse token spacing so the future Lobby/Board work can stay consistent.
- Classic look remains available when `EXPO_PUBLIC_ENABLE_CROSSROADS_STYLES=false`.

## Next documentation steps

- Record every new primitive component with a short usage snippet.
- Capture testing checklists (Expo commands + which toggle to flip) so the owner can verify the look in seconds.
- Once the toggle is live, add rollback instructions (set the flag to `false`, reload Expo, confirm the parchment look returns).

Feel free to append questions or blockers at the bottom of this file as you wire in each visual piece.
