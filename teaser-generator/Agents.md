# agents.md — CrosSwords Build Agent Playbook (RN + Expo)

**Purpose:** Keep the Codex/AI assistant ("the Agent") tightly aligned on *what to build*, *in what order*, and *how to deliver changes* without breaking working code. This file is written for a **novice programmer** owner. Every output must be beginner-friendly, highly commented, and include copy‑paste safe replacement blocks or built directly by codex (preferred).

---

## 0) Mission & Success Criteria
- Deliver **CrosSwords** as a **mobile-first** app (React Native + Expo) with:
  - Stylized board & switchable backgrounds/themes.
  - Title page → Lobby → Board flow (board only visible once game `status="active"`).
  - PvP turn system wired to the **existing Python/FastAPI** backend.
  - **PvE bots** for learning/single-player.
  - **Friends list** for challenges & social graph.
  - **Random matchmaking** (Quick Play).
  - **Leaderboards** (late addition) and **turn notifications**.
- Maintain existing FastAPI server functionality. **Never delete working code.**
- Each change set includes: (1) commented patches, (2) test steps, (3) rollback notes, (4) a short summary, and (5) a **running list of files to reupload**.

---

## 1) Operating Principles (Agent Rules)
1. **Beginner-first outputs**: explain concepts plainly; add inline comments to all code.
2. **Non-destructive editing**: use the **Replace Block** format below; avoid large diffs unless explicitly required.
3. **Ask when unclear**: if requirements are ambiguous, **pause and ask 1–3 crisp questions**.
4. **Small, runnable steps**: ship features incrementally behind obvious toggles or feature flags.
5. **Checkpoints**: after each step, provide a 5–10 line status + next tasks.
6. **Traceability**: reference files and functions by path; include “why” not just “what”.
7. **Performance & UX**: start with simple components; add animations later.

### Replace Block Format (always use this)
```
# === REPLACE: <path/to/file> : <short description> ===
# This is the code being replaced (copy a recognizable snippet or heading)
<OLD_SNIPPET or // ...>
# --- WITH:
<NEW_CODE fully commented so a novice can follow>
# === END REPLACE ===
```
> If adding a **new file**, use:
```
# === ADD: <path/to/new_file> ===
<NEW_FILE_CONTENT with thorough comments>
# === END ADD ===
```
> If removing **dead code**, use:
```
# === REMOVE: <path/to/file_or_snippet> : reason ===
<OPTIONAL: old snippet for context>
# === END REMOVE ===
```

---

## 2) Communication Protocol
- **Check-in cadence:** At the end of every feature step, output: *What changed*, *How to run*, *What to test*, *Known issues*, *Next step*.
- **Clarification triggers:** Stop and ask if any of these occur:
  1) Schema ambiguity (e.g., unknown fields in `/state`).
  2) UI behavior not covered by spec.
  3) Conflicting requirements (mobile vs. desktop packaging).
  4) Risk of breaking lobby/board flow.
- **Novice guardrails:** Prefer safer defaults (polling over websockets initially, simple View/Text tiles before Skia, etc.).

---

## 3) Access.AI / Codex Budget Safety
- **Budget Warning:** If the Agent estimates remaining access/time is **<20%**, output at the top of the next message:
  - `⚠️ Low Access.AI Budget: preparing a succinct summary + TODO checkpoint.`
- **Emergency Handoff Summary (create immediately when low):**
  - Current milestone and files changed.
  - What runs today and how to run it.
  - The next 3 implementation tasks with file paths.
  - Any open questions blocking progress.

---

## 4) Versioning & Change Hygiene
- **Branch names:** `feat/<phase>-<short-desc>` or `fix/<area>-<short-desc>`.
- **Commit messages:** Conventional style: `feat(board): add GuessBar with commented handlers`.
- **Version tags:** Mobile app: `rn-v0.x.y`; Server: `api-v0.x.y`.
- **Reupload List:** At the end of each delivery, provide a bullet list of **exact paths** to reupload.

---

## 5) Tech Stack (default choices)
- **Frontend:** React Native + Expo.
  - Navigation: `@react-navigation/native` + `native-stack`
  - State: `zustand`
  - Server data: `@tanstack/react-query`
  - UI: `nativewind` (Tailwind) *or* `react-native-paper`
  - Graphics (later): `@shopify/react-native-skia` (start with Views/Text)
  - Push: `expo-notifications`
- **Backend:** Python + FastAPI (existing), Postgres (or Supabase Postgres)
- **Social/Realtime (optional):** Supabase (Auth + DB + Realtime)

---

## 6) Roadmap Steps (0 → 8)

### Step 0 — Prep (RN/Expo skeleton talks to FastAPI)
**Goal:** Create an Expo app that can ping the server.
- **Outputs:** `App.tsx`, basic navigation, `/src/lib/api.ts` wrapper, a Title screen with a “Ping Server” button.
- **Acceptance:** App runs in Expo Go; pressing the button hits `/health` or dummy `/state` and shows a success message.
- **Risks:** Environment URLs. Provide `env.example` and comments.
- **Rollback:** Revert to default Expo starter.

### Step 1 — Core GUI Skeleton (Title → Lobby → Board)
**Goal:** Navigate end-to-end with mocked data.
- **Outputs:**
  - `screens/TitleScreen.tsx`: username entry (stored in `stores/userStore.ts`).
  - `screens/LobbyScreen.tsx`: Join/Create tabs, countdown status view.
  - `screens/BoardScreen.tsx`: static grid, `TurnBanner`, `GuessBar` (disabled by default).
- **Acceptance:** Can navigate through screens; board gated behind `status === 'active'` (mocked).
- **Risks:** Navigation params, state lifetimes. Use React Navigation patterns with comments.

### Step 2 — Board Graphics & Background Themes
**Goal:** Game looks like a game.
- **Outputs:**
  - `components/BoardView.tsx`: grid using Views/Text first; theme-friendly colors.
  - `components/ThemePicker.tsx`: user-selectable themes (stored in `stores/uiStore.ts`).
  - Backgrounds via `expo-linear-gradient` + optional images in `/assets/backgrounds/`.
- **Acceptance:** Theme switch visibly changes board background; tiles render neatly on phone.
- **Risks:** Image scaling. Provide safe defaults and comments.

### Step 3 — Wire to FastAPI Turn System
**Goal:** Real turns, guesses, and history using existing endpoints.
- **Outputs:**
  - React Query hooks calling `/games/{id}/state` (polling 1–2s) and `POST /games/{id}/guess`.
  - Respect `current_turn_user_id`; disable GuessBar when not your turn.
  - Show your guess history grouped by word with G/Y/R squares.
- **Acceptance:** Two devices can play; board guards until `active`; guesses update history and turn owner.
- **Risks:** Schema drift. Include runtime shape checks with `zod`.

### Step 4 — PvE Bots (Single Player / Learn Mode)
**Goal:** Play against a bot.
- **Outputs:**
  - Server: minimal bot move after player guess (can be synchronous for MVP).
  - Client: “Play vs Bot” option in New Game; “🤖 Thinking…” banner while waiting.
- **Acceptance:** Single-player game completes; bot moves appear within 1–2s.
- **Risks:** Blocking handlers; recommend background job next iteration.

### Step 5 — Friends List (Social Graph)
**Goal:** Add/search friends; challenge friends.
- **Outputs:**
  - Choose Supabase *or* custom FastAPI endpoints.
  - Tables: `profiles`, `friend_requests`, `friends`.
  - Screens: `FriendsScreen.tsx` with tabs (Search, Requests, Friends) and “Challenge” CTA.
- **Acceptance:** Can send/accept requests; start a friend game.
- **Risks:** Auth flows. Provide beginner-friendly Supabase setup notes.

### Step 6 — Matchmaking (Random Opponents)
**Goal:** Quick Play pairs two strangers.
- **Outputs:**
  - Server: `/matchmaking/enqueue`, `/matchmaking/dequeue`; pair users → create game.
  - Client: “Quick Play” button; cancel; timeout UI.
- **Acceptance:** Two phones in queue get matched automatically.
- **Risks:** Race conditions. Use DB transaction or Redis lock; document clearly.

### Step 7 — Leaderboard (Late Addition)
**Goal:** Ranking views.
- **Outputs:**
  - Server aggregation: `leaderboard(user_id, games_won, games_played, win_rate, last_active_at)`
  - Client: `LeaderboardScreen.tsx` with tabs (Global, Friends).
- **Acceptance:** Lists render with pagination; updates on game finish.
- **Risks:** Expensive queries; prefer materialized view or cached table.

### Step 8 — Turn Notifications & Polish
**Goal:** Feels instant and delightful.
- **Outputs:**
  - Expo push notifications on turn change (store device tokens on server).
  - Sound/Toast on “Your turn!”, settings toggles.
- **Acceptance:** Device receives push within seconds; toggles work.
- **Risks:** APNs/FCM setup; include step-by-step with comments.

---

## 7) Acceptance Tests (per step)
Each step delivery must include **copy-paste test instructions** for a novice user, example:
1. Launch Expo Go; open the app.
2. On Title, enter `TestUser` → tap **Continue**.
3. Navigate to **Lobby** → tap **Create Game** → observe countdown.
4. Open the app on a second device; **Join Game** with the code.
5. When countdown ends, verify **Board** opens and shows **Your turn** to one device.
6. Enter a guess, tap **Submit** → verify G/Y/R feedback row appears and turn switches.

---

## 8) Coding Standards & Commenting
- **Every function and component** has a top comment: purpose, inputs, outputs, side effects.
- **React Native:** show prop types, simple state diagrams, and where network calls live.
- **Python (FastAPI):** docstrings with request/response models, side effects (DB writes), and error cases.
- **Inline explainers** for beginners: why we chose polling, what `useQuery` does, etc.

---

## 9) Rollback & Safety
- For each change, include a *Rollback* section: files to restore, toggles to disable, and how to confirm the app returned to the last working state.
- Keep prior versions in `archive/` or via Git commits/tags.

---

## 10) Deliverable Checklist Template (append to each output)
- **Summary:** (2–5 lines)
- **Files changed:** (paths)
- **New files:** (paths)
- **Replace Blocks:** (paste all)
- **How to run:** (commands / Expo steps)
- **How to test:** (numbered steps)
- **Rollback:** (steps)
- **Next up:** (2–3 bullets)
- **Reupload list:** (exact paths)

---

## 11) Open Questions (keep current)
- Are we standardizing on **Supabase** for auth/social/realtime? (Recommended.)
- Do we need **offline mode** early, or later?
- Any brand/style guide for board themes?

---

## 12) Quickstart (for the Agent to scaffold RN project)
Use this only when owner requests a starter repo.
=== ADD: README_ExpoQuickstart.md ===
Purpose: One-page beginner runbook to launch Expo app and connect to FastAPI.
(1) Install Node & Expo CLI
(2) npx create-expo-app crosswords-mobile
(3) cd crosswords-mobile && npm i @react-navigation/native @react-navigation/native-stack zustand @tanstack/react-query expo-linear-gradient
(4) npx expo start # scan QR on phone
(5) Edit src/lib/api.ts to point at your FastAPI server URL.
=== END ADD ===
---

### End of Playbook
*The Agent must keep this file updated when decisions change. Always include the **Reupload list** in every delivery.*

---

## 13) Definition of Done (DoD) & Quality Gates
A task/feature is **Done** only if all apply:
- Working on **two devices** (Android+iOS or phone+simulator) with clear test steps.
- **No console errors** or redboxes during normal flows.
- **Types pass** (`tsc --noEmit`) and **lint/format** pass (`eslint`, `prettier`).
- **Basic accessibility**: test via screen reader labels for interactive controls; supports large text.
- **Docs updated**: README usage, agents.md roadmap line item checked.
- **Reupload list** included.

**Quality Gates** (automated where possible): unit tests, type-check, lint, build.

---

## 14) Coding Conventions & Tooling (Beginner-safe defaults)
- **TypeScript strict**: enable `"strict": true` in `tsconfig.json`.
- **ESLint + Prettier**: common RN config; CI blocks merge on lint errors.
- **Module structure**: `screens/`, `components/`, `stores/`, `lib/`, `types/`, `assets/`.
- **Naming**: PascalCase for components, camelCase for vars, UPPER_SNAKE for constants.
- **Comments**: top-of-file overview + function JSDoc with param/returns.
- **Env handling**: `.env` via `expo-constants` or `react-native-config` (include `.env.example`).

---

## 15) API Contracts & Mocking
- **Source of truth**: OpenAPI schema exported from FastAPI (e.g., `/openapi.json`).
- **Runtime validation**: `zod` schemas in `/types` to parse server responses.
- **Mock server**: use **MSW (Mock Service Worker)** for local dev; include sample fixtures for `/state`, `/guess`, `/leaderboard`.
- **Contract tests**: simple script that fetches `/openapi.json` and alerts on breaking changes.

---

## 16) Security & Privacy Checklist
- Never log secrets or full tokens; redact PII in logs.
- Validate all inputs on server; rate-limit guess submissions.
- Store push tokens securely; provide an opt-out.
- GDPR-lite: export/delete account endpoints when we add auth.
- Use HTTPS only; document CORS rules.

---

## 17) Accessibility (A11y) & Internationalization (i18n)
- All tappable items have `accessibilityLabel` and hit-slop ≥ 32px.
- Color contrast ≥ 4.5:1; provide **colorblind-safe** feedback shapes (not color-only).
- Large text / Dynamic Type friendly layouts.
- i18n-ready strings via a tiny wrapper (e.g., `t('lobby.title')`). English only at start; keep keys centralized.

---

## 18) Performance, Telemetry & Error Reporting
- **Performance budget**: initial app bundle < 3 MB gzipped; board render < 16ms per frame on mid-range device.
- **Telemetry**: minimal analytics events with a typed schema (screen_open, game_created, guess_submitted, turn_changed).
- **Error reporting**: Sentry (optional) or simple endpoint to log client errors with device info.

---

## 19) Testing Matrix & CI
- **Unit tests**: pure functions (stores, helpers) with Vitest/Jest.
- **Component tests**: React Testing Library for BoardView/GuessBar.
- **Manual smoke**: two devices, happy path + offline + rotate + background/foreground.
- **CI**: GitHub Actions workflow running `npm ci`, lint, typecheck, tests. Artifacts: build output & coverage summary.

---

## 20) Feature Flags & Rollout
- Simple boolean flags file `src/flags.ts` (e.g., `ENABLE_SKIA`, `ENABLE_REALTIME`).
- Ship features behind flags; default to **off** until validated.
- Document each flag and removal criteria.

---

## 21) Offline & Error States UX
- Show cached last state when offline with a banner.
- Retry strategy: exponential backoff (0.5s → 4s), manual **Retry** button.
- Friendly empty/error UI for Friends, Matchmaking, Leaderboard.

---

## 22) Glossary (for the Owner)
- **Board**: the grid where words live.
- **Turn**: one guess from a player; server flips `current_turn_user_id`.
- **Feedback (G/Y/R)**: Green/Yellow/Red match codes per letter.
- **PvE Bot**: server-controlled opponent for single-player.
- **Realtime**: push-style updates (websocket/Supabase) vs. polling.

---

## 23) Agent Prompts & Budget Templates
**When unclear, ask:**
- “Do we use Supabase for auth/social now or later?”
- “Confirm `/games/{id}/state` includes `your_history` grouped or flat?”
- “OK to ship Board with View/Text tiles first and add Skia later?”

**Low Budget Banner (must appear automatically):**
⚠️ Low Access.AI Budget (≤20%). Preparing handoff:

What shipped:

How to run:

Next 3 tasks (paths):

Open questions:


---

## 24) Incident & Rollback Playbook
- If a change breaks navigation or guessing:
  1) Toggle off new feature via `flags.ts`.
  2) Revert last commit/tag (document exact tag).
  3) Post a brief incident note in `docs/incidents.md` (what broke, why, fix).

---

## 25) Changelog Template
Maintain `CHANGELOG.md` with Keep-a-Changelog style.
[rn-v0.x.y] - 2025-09-30
Added
ThemePicker with 3 starter themes.

Changed
BoardView refactor to support future Skia.

Fixed
GuessBar disabled when not your turn.

---

*Appendices added to strengthen reliability, accessibility, testing, and handoff readiness for a novice-led project. The Agent must follow these by default.*
# === END ADD ===





