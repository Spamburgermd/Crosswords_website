# Crossword Daily Puzzle Seed Pipeline

Analysis of how the daily puzzle is generated — from date input to word list and grid positions.

---

## Date → Seed → Words → Grid Pipeline

### 1. Date-to-Seed (pure math, no platform deps)

File: `crosswords_mobile/src/localChallenge/localChallengeStore.ts` ~lines 124–139

```typescript
// Format: 'YYYY-MM-DD' → integer YYYYMMDD
const raw = parseInt(dateStr.replace(/-/g, ''), 10); // 20260415
const DAILY_SEED_SALT = 0x4a3f2b1c;
seed = ((raw * 1664525 + DAILY_SEED_SALT) >>> 0) % 1_000_000;
```

Straight LCG hash. No RNG, no device state, fully deterministic from the date string.

---

### 2. Word Selection (pure PRNG, no platform deps)

File: `crosswords_mobile/src/localChallenge/seededTargets.ts` ~lines 140–196

- Target word lengths are fixed: `[4, 4, 5, 5, 6]`
- PRNG is **Mulberry32** — seeded from the daily seed
- Loads one of several static JSON dictionaries (`wordlist_common_4_6.json`, `wordlist_modified_4_6.json`, `wordlist_twl_4_6.json`)
- Filters basic plurals (word ends in S + root exists in dict)
- Retries up to 50× with derived seeds (`${seed}:${dict}:${attempt}`) if grid placement fails

---

### 3. Grid Construction (crossword placement with intersections)

File: `crosswords_mobile/src/lib/localAutoPlaceAllWords.ts` ~lines 17–200

This is a real crossword placer, not a simple list:
- 10×10 grid
- Words placed H or V with **matching letters at intersections**
- Constraints: no side-adjacent letters, clear end-caps, at most one cross per word pair
- Deterministic: sorts by length, places longest first at center, fits the rest around matching letters
- Output includes `start: [row, col]`, `dir: 'across'|'down'`, and full `coords` for each word

---

### 4. Platform Dependencies — No Blockers

| Component | Deps | Node-safe? |
|---|---|---|
| Seed math | Pure math | ✅ |
| PRNG + word select | None | ✅ |
| Grid placer | None | ✅ |
| Dictionary files | Static JSON | ✅ |
| `react-native` AppState | Optional, `try/catch` wrapped | ✅ gracefully absent |
| `expo-file-system` | Optional, falls back to in-memory | ✅ gracefully absent |

No `AsyncStorage`, no device APIs in the critical path.

---

## Feasibility: Very High

The core pipeline is ~600 lines of pure TypeScript across ~4 files. To extract into a standalone Node script you need:

1. `crosswords_mobile/src/localChallenge/localChallengeStore.ts` — `getDailyPuzzleSeed` function
2. `crosswords_mobile/src/localChallenge/seededTargets.ts` — `generateTargetsFromSeed`
3. `crosswords_mobile/src/lib/localAutoPlaceAllWords.ts` — `buildLocalPlacement`
4. `crosswords_mobile/src/lib/localValidateWordset.ts` — word validation
5. Dictionary JSON files from `crosswords_mobile/src/dictionary/`

### Node Script Skeleton

```typescript
import { getDailyPuzzleSeed } from './localChallengeStore';
import { generateTargetsFromSeed } from './seededTargets';
import { buildLocalPlacement } from './localPlacement';

function generatePuzzleForDate(dateStr: string) {
  const seed = getDailyPuzzleSeed(dateStr);
  const words = generateTargetsFromSeed(seed, 'modified', 5);
  const placement = buildLocalPlacement(words);

  return {
    date: dateStr,
    seed,
    words: placement.ok ? placement.words : [],
    grid: placement.ok ? placement.targets_meta : [],
  };
}

// Usage
const puzzle = generatePuzzleForDate('2026-04-15');
console.log(puzzle);
```

---

## Open Question Before Building

**Which `dictionaryId` does production use for the daily puzzle?**

The dictionary is passed from the lobby into `getOrCreateDailySession`. Check
`crosswords_mobile/src/screens/LobbyScreen.tsx` around line 1007 to see which
dict string (`'common'`, `'modified'`, `'twl'`, etc.) is passed for the daily
puzzle flow.

---

## Key Constants Reference

| Constant | Value | Location |
|---|---|---|
| `DAILY_SEED_SALT` | `0x4a3f2b1c` | `localChallengeStore.ts:136` |
| `RANDOM_SEED_MOD` | `1_000_000` | `localChallengeStore.ts:137` |
| `MAX_ATTEMPTS` | `50` | `seededTargets.ts` |
| `TARGET_LENGTHS` | `[4, 4, 5, 5, 6]` | `seededTargets.ts` |
| Grid size | `10×10` | `localAutoPlaceAllWords.ts` |
