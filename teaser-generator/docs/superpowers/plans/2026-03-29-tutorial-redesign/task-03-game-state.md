# Task 3: Game pipeline hook

**Files:**
- Modify: `crosswords_mobile/src/screens/tutorial/useTutorialGameState.ts`
- Keep: `crosswords_mobile/src/screens/tutorial/useTutorialGameState.test.ts` (existing tests must still pass)

The existing `useTutorialGameState.ts` has a working pipeline with correct function call signatures (`buildTutorialPipeline`, `injectScriptedGuess`, etc.). **Port it rather than reimplementing it.** The only change needed is to add `rawHistoryByTarget` to the return value so the step machine can count guesses per word.

> **CRITICAL:** Do NOT attempt to rewrite the pipeline calls from scratch. The function signatures for `reconcileEvidenceFeedback`, `applyIntersectionMerge`, and `computeBlueTickerEntries` take object arguments — the existing code already calls them correctly. Copy it.

---

- [ ] **Step 1: Read existing `useTutorialGameState.ts` in full**

Read: `crosswords_mobile/src/screens/tutorial/useTutorialGameState.ts`

Note the existing exported type (e.g. `TutorialGameOutput` or `TutorialPipelineResult`), the `buildTutorialPipeline` pure function, and the `injectScriptedGuess` callback.

- [ ] **Step 2: Read the existing `useTutorialGameState.test.ts`**

Read: `crosswords_mobile/src/screens/tutorial/useTutorialGameState.test.ts`

Note which exports are imported. The test file imports `buildTutorialPipeline` — this export **must be preserved** in the new file.

- [ ] **Step 3: Write the new `useTutorialGameState.ts`**

Copy the existing file verbatim, then apply these three changes only:

**Change A** — Add `rawHistoryByTarget` to the return type. Find the existing output type (e.g. `TutorialGameOutput`) and add:
```typescript
rawHistoryByTarget: Map<number, FeedbackGuessEntry[]>
```

**Change B** — Return `rawHistoryByTarget` from the hook. Find the return statement and add:
```typescript
rawHistoryByTarget,
```

**Change C** — Ensure `buildTutorialPipeline` is still exported (it must be — the test file imports it). Do not remove it.

Do not change any pipeline function calls, import paths, or logic. Only add the new field.

- [ ] **Step 4: Run the existing tests — verify they still pass**

```bash
cd crosswords_mobile && npm run test -- --testPathPattern=useTutorialGameState
```

Expected: all existing tests PASS (nothing was removed or changed in logic)

- [ ] **Step 5: Commit**

```bash
git add crosswords_mobile/src/screens/tutorial/useTutorialGameState.ts
git commit -m "feat(tutorial): expose rawHistoryByTarget from useTutorialGameState"
```

- [ ] **Step 6: Mark task complete in index**

Edit `docs/superpowers/plans/2026-03-29-tutorial-redesign/index.md`:

Change:
```
- [ ] [Task 3: Game pipeline hook](task-03-game-state.md)
```
To:
```
- [x] [Task 3: Game pipeline hook](task-03-game-state.md)
```
