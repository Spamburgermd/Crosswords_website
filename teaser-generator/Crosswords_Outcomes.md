# CrosSWords — Build Status & Outcomes

**Last updated:** 2026-02-18
**Branch:** feature/local-modes-completion

---

## Fully Working (Core)

### Game Engine
- Guess submission, feedback computation (green/yellow/red/blue), win detection
- Serialization: challenge/offer/return/bundle/result payload encoding/decoding
- Stable ID generation from challenge hashes
- Pure functions, no side effects — well tested

### Game Modes
- **PvP (server-driven)** — create/join games, submit words, mark ready, guess loop
- **Solo (seeded local)** — deterministic word generation from seed, local scoring
- **Bot (AI opponent)** — 3 difficulty levels:
  - Easy: random valid guesses
  - Normal: positional + English letter frequency weighting
  - Hard: entropy minimization with sampling for large candidate pools

### Screens (15 total)
| Screen | Status | Notes |
|--------|--------|-------|
| TitleScreen | Done | Onboarding, API key input, auto-login |
| LobbyScreen | Done | Multi-mode hub: solo, bot, friend, PvP |
| PreGameScreen | Done | 5-word entry with validation (2×4, 2×5, 1×6) |
| BoardScreen | Done | Atlantic-themed, supports PvP/solo/bot modes |
| BotSetupScreen | Done | Difficulty, word input, dictionary selection |
| ChallengeScreen | Done | 2-section layout: Create Challenge / Enter Code |
| FriendWizardScreen | Done | Routes to ChallengeScreen with showOnly param |
| ResultScreen | Done | Result import, PvP async comparison, sharing |
| FriendsScreen | Done | Friend list, requests, management |
| JottsScreen | Done | Word list saving/sharing |
| ChallengeHistoryScreen | Done | Past challenge viewing (basic) |
| SettingsScreen | Done | Username, API key, toggles, app info |
| LocalChallengePlayScreen | Done | Minimal serverless testing surface |
| PreviewApp + 5 previews | Done | Design validation screens |

### Challenge Sharing System
- QR code generation (react-native-qrcode-svg)
- Share modal with Copy / Share / WhatsApp / SMS buttons
- Deep linking: `myapp://offer/CODE`, `myapp://return/CODE`
- Clipboard auto-detect on screen focus
- Code type auto-detection (offer/return/bundle/legacy/result)
- Base64url encoding with `sanitizeCode()` for messaging app corruption

### Atlantic Design System
- Design tokens: colors, typography, spacing, shadows, radii
- Fonts loaded: NotoSerif, LibreBaskerville (regular + bold), Cinzel (regular), CinzelDecorative (bold)
- `displayFamily` = CinzelDecorative_700Bold, `bodyFamily` = LibreBaskerville_400Regular

### Dictionary System
- TWL (Tournament Word List) — `wordlist_twl_4_6.json`
- Modified — `wordlist_modified_4_6.json`
- Validation via `dictionaryAdapter.ts`

### Offline Capabilities
- Local session persistence (AsyncStorage)
- Serverless guess scoring option
- `OFFLINE_LOCAL_ONLY` feature flag

### Components
- BoardView — tile layout, word slots, interactive cells, history panel
- AlphabetSidePanel — swipeable letter filtering
- GuessBar — text input for guesses
- TurnBanner — current turn indicator
- ThemePicker — runtime theme switching
- BotProgressPanel — AI turn progress display

---

## Fixed This Session (2026-02-18)

- **SMS sharing** — removed broken `canOpenURL` check, use try/catch `openURL` directly
- **Challenge screen UX** — refactored from confusing 3-tab system to clean 2-section layout
- **Share modal** — rich overlay with QR + Copy/Share/WhatsApp/SMS instead of native Alert
- **Create/Enter separation** — `showOnly` route param ('create' | 'enter') for distinct paths
- **Seed mode Done button** — now navigates to board (was just closing modal)
- **Cinzel fonts** — replaced corrupted HTML files with real TTF binaries, added to `useFonts`
- **app.json** — removed invalid `autoLink` field

---

## Partially Done / Needs Work

| Item | Status | Details |
|------|--------|---------|
| Bot session persistence | **Done** | Persisted to disk via v2 schema with migration from v1 |
| Dark mode | Toggle exists | Settings shows "coming soon", theme infrastructure exists but not wired |
| Notifications | Toggle exists | Non-functional, no integration |
| Sound effects | Toggle exists | Non-functional |
| Challenge history | Basic | Could be fleshed out with richer detail views |

---

## Known Technical Debt

| Issue | Priority | Location |
|-------|----------|----------|
| Hardcoded API URL `10.0.0.104:8000` | High | `lib/api.ts` |
| Test credentials in code | High | `lib/api.ts` (TEST_USERNAME/TEST_PASSWORD) |
| Missing `@types/jest` | Low | TS errors in `__tests__/` files only |
| `any` casts in navigation | Low | ChallengeScreen, LobbyScreen navigation calls |
| `any` casts in bot sessions | Low | Bot session handling |

---

## Test Coverage

15 test files covering:
- Game engine: serialize round-trips, feedback parity, smoke tests
- Local challenges: persistence, role logic, seeded targets, local play
- Bot engine: move generation
- Utilities: word parsing, guess scoring, target providers, linking
- Contract tests: game state schema validation
- Jotts: validation

---

## Architecture

- **State management:** Zustand (sessionStore, userStore, uiStore, gameStore)
- **Navigation:** React Navigation (native stack)
- **Styling:** Atlantic design tokens, StyleSheet
- **Feature flags:** `flags.ts` (crossroads styles, atlantic skin, serverless scoring, offline mode)
- **API:** REST to Express backend at hardcoded LAN IP

---

## Overall Completion: ~85-90%

Core gameplay loop is solid across all modes. Main gaps are polish items (dark mode, sounds, notifications) and production-readiness (env config, credential cleanup).
