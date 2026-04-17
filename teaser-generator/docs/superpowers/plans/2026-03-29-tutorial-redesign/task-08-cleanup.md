# Task 8: Delete legacy files, wire AppNavigator, final typecheck

**Context:** The old tutorial lived at `crosswords_mobile/src/screens/TutorialScreen.tsx` (a single file). AppNavigator still imports from that old path. Tasks 1–7 created the new `tutorial/` directory structure. This task wires AppNavigator to the new path, deletes the old file, and verifies everything typechecks.

**Files to delete:**
- `crosswords_mobile/src/screens/TutorialScreen.tsx` (old single-file tutorial)
- `crosswords_mobile/src/screens/tutorial/chapters/` (if it exists)
- Any other files in `src/screens/tutorial/` NOT created in Tasks 1–7

**Files to modify:**
- `crosswords_mobile/src/navigation/AppNavigator.tsx` — update import

---

- [ ] **Step 1: List current files**

```bash
ls crosswords_mobile/src/screens/
ls crosswords_mobile/src/screens/tutorial/
```

- [ ] **Step 2: Update AppNavigator import**

Read `crosswords_mobile/src/navigation/AppNavigator.tsx`. Find the line:
```typescript
import TutorialScreen from '@screens/TutorialScreen';
```
Change it to:
```typescript
import TutorialScreen from '@screens/tutorial/TutorialScreen';
```

- [ ] **Step 3: Delete old TutorialScreen and any legacy tutorial files**

```bash
rm crosswords_mobile/src/screens/TutorialScreen.tsx
rm -rf crosswords_mobile/src/screens/tutorial/chapters
# Delete any other legacy .ts/.tsx files in tutorial/ that are NOT:
# types.ts, tutorialPuzzle.ts, useTutorialGameState.ts, useTutorialGameState.test.ts,
# useTutorialStepMachine.ts, useTutorialStepMachine.test.ts,
# tutorialScript.ts, tutorialScript.test.ts, TutorialOverlay.tsx, TutorialScreen.tsx
```

- [ ] **Step 4: Run full typecheck**

```bash
cd crosswords_mobile && npm run typecheck:all
```

Expected: no errors. Fix any import path issues found.

- [ ] **Step 5: Run all tutorial tests**

```bash
cd crosswords_mobile && npm run test -- --testPathPattern=tutorial
```

Expected: all tests PASS

- [ ] **Step 6: Self-review checklist**

Verify each item manually:

- [ ] `AppNavigator.tsx` now imports from `@screens/tutorial/TutorialScreen`
- [ ] `TutorialScreen` is typed as `NativeStackScreenProps<RootStackParamList, 'Tutorial'>`
- [ ] `firstLaunch` param accepted but ignored — intentional (it is in the route type but `TutorialScreen` does not use it)
- [ ] `computeFallbackCodes` iterates `target.length` times, not `guess.length`
- [ ] `TutorialOverlay` has `pointerEvents="box-none"` on the backdrop
- [ ] `prevGameStateRef` in `useTutorialStepMachine` is updated BEFORE calling `advance()`

- [ ] **Step 7: Commit**

```bash
git add crosswords_mobile/src/navigation/AppNavigator.tsx
git add -A crosswords_mobile/src/screens/tutorial/
git rm crosswords_mobile/src/screens/TutorialScreen.tsx
git commit -m "chore(tutorial): wire AppNavigator to new tutorial dir, remove legacy file"
```

- [ ] **Step 7: Mark task complete in index**

Edit `docs/superpowers/plans/2026-03-29-tutorial-redesign/index.md`:

Change:
```
- [ ] [Task 8: Delete legacy files + final typecheck](task-08-cleanup.md)
```
To:
```
- [x] [Task 8: Delete legacy files + final typecheck](task-08-cleanup.md)
```
