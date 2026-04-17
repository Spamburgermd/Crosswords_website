# CrosSWords Mobile (Expo)

React Native + Expo client for CrosSWords.

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Copy env file:
```bash
cp .env.example .env
```

3. Start Expo:
```bash
npm run start
```

## Server Modes

All server-backed behavior is controlled by one switch:

`EXPO_PUBLIC_ENABLE_SERVER_FUNCTIONS`

- `true`: online mode (auth, lobby/game state polling, guesses, friends).
- `false`: local-only mode (all API calls are blocked in `src/lib/api.ts`).

### Recommended `.env` Values

Online:
```env
EXPO_PUBLIC_ENABLE_SERVER_FUNCTIONS=true
EXPO_PUBLIC_OFFLINE_LOCAL_ONLY=false
EXPO_PUBLIC_API_BASE_URL=http://<your-lan-ip>:8000
```

Local-only:
```env
EXPO_PUBLIC_ENABLE_SERVER_FUNCTIONS=false
EXPO_PUBLIC_OFFLINE_LOCAL_ONLY=false
```

## Quality Checks

Run from `crosswords_mobile/`:

```bash
npm run typecheck
npm run lint
```

## Notes

- `EXPO_PUBLIC_API_BASE_URL` is read by `src/lib/api.ts`.
- Restart Expo after changing `.env` values.
