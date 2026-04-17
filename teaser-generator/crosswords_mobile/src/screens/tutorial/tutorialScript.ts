// crosswords_mobile/src/screens/tutorial/tutorialScript.ts
import type { TutorialStep } from './types';

export const TUTORIAL_STEPS: TutorialStep[] = [
  // ── 0: Welcome ────────────────────────────────────────────────────────────
  {
    id: 'welcome',
    trigger: () => true,
    hint: {
      title: 'Welcome',
      body: "The goal of this word puzzle game is solve indiviudal words through logical feedback. Your guesses reveal clues that apply across the whole board. Let's start with a small sample board.",
      isAction: false,
    },
  },

  // ── 1: Word cards ─────────────────────────────────────────────────────────
  {
    id: 'word-cards',
    trigger: () => true,
    hint: {
      title: 'Word Cards',
      body: "The numbered badges on the left correspond to words on the board. Tap one to select it. You may also tap a word in the puzzle to switch. The right side panel shows your guess history for that word.",
      isAction: false,
    },
    spotlightZone: 'wordCards',
  },

  // ── 2: Keyboard + first guess (action) ────────────────────────────────────
  {
    id: 'first-guess',
    trigger: () => true,
    hint: {
      title: 'Make Your First Guess',
      body: "We've pre-filled the first guess for you. 'LOCUS' Tap ↵ on the keyboard to submit.",
      isAction: true,
    },
    preFill: 'LOCUS',
    preFillTargetIndex: 0,
    lockPreFill: true,
    highlightTarget: 'submit-button',
    spotlightZone: 'keyboard',
    expectedAction: (s, p) =>
      (s.guessCountByTarget[0] ?? 0) > (p.guessCountByTarget[0] ?? 0),
  },

  // ── 3: Feedback colors ────────────────────────────────────────────────────
  {
    id: 'feedback-colors',
    trigger: (s) => (s.guessCountByTarget[0] ?? 0) >= 1,
    hint: {
      title: 'Understanding the Colors',
      body: "\nThe O is {{correct}} and is 100% correct!\nThe U and S are both {{wrongSpot}}, therefore they are in this word but in different positions.\nThe L is {{notInWord}} - a global clue - it appears somewhere else in the puzzle.\nThe C is {{notInPuzzle}} - it isn't used in the puzzle at all.\n\nOverall a good guess, almost like someone planned it that way.",
      isAction: false,
    },
    spotlightZone: 'board',
  },

  // ── 4: Blue ticker ────────────────────────────────────────────────────────
  {
    id: 'blue-ticker',
    trigger: () => true,
    hint: {
      title: 'Blue Ticker',
      body: "The rail above tracks the {{notInWord}} clues.\n\nLetters you've found in the puzzle but haven't placed in a word yet.\n\nIn settings you can add numbers if you need.",
      isAction: false,
    },
    spotlightZone: 'statusRail',
  },

  // ── 5: Keyboard tracking ─────────────────────────────────────────────────
  {
    id: 'keyboard-tracking',
    trigger: () => true,
    hint: {
      title: 'Keyboard Tracking',
      body: "The Keyboard tracks letters not used in the puzzle. Trialing them will grey them out.",
      isAction: false,
    },
    spotlightZone: 'keyboard',
  },

  // ── 6: Switch to BASIC via tabs + submit (action) ─────────────────────────
  {
    id: 'switch-to-basic',
    trigger: () => true,
    hint: {
      title: 'Switch Words',
      body: "Tap the Red '3' to select the 4 letter word, then submit the next pre-filled guess 'DIAL'",
      isAction: true,
    },
    preFill: 'DIAL',
    preFillTargetIndex: 2,
    lockPreFill: true,
    highlightTarget: 'word-tabs',
    highlightTargetIndex: 2,
    emphasizeKeyboard: true,
    spotlightZone: 'wordCards',
    expectedAction: (s, p) =>
      (s.guessCountByTarget[2] ?? 0) > (p.guessCountByTarget[2] ?? 0),
  },

  // ── 7: Color state of truth ───────────────────────────────────────────────
  {
    id: 'duplicate-letters',
    trigger: (s) => (s.guessCountByTarget[2] ?? 0) >= 1,
    hint: {
      title: 'Colors Show the Current Truth',
      body: "{{correct}} letters or words will always be on top. The guess tracker below the board is the best place to see your guess history. To prevent wasted guesses, old {{notInWord}} clues will silently turn {{notInPuzzle}} when you have revealed all the {{correct}} occurrences.\n\nIf you guess the same letter twice in the same word, the second letter will act like another candidate, {{notInWord}} - in other words, {{wrongSpot}} - in same word (different location), {{notInPuzzle}} - not in any other words in puzzle.",
      isAction: false,
    },
    spotlightZone: 'board',
  },

    // ── 7b: Color state of truth ───────────────────────────────────────────────
  {
    id: 'color-truth',
    trigger: (s) => (s.guessCountByTarget[2] ?? 0) >= 1,
    hint: {
      title: 'Colors Show the Current Truth',
      body: "If you guess the same letter twice in the same word, the second letter will act like another candidate.\n\n{{notInWord}} in other words.\n{{wrongSpot}} - in same word (different location).\n{{notInPuzzle}} - not in any other words in puzzle.",
      isAction: false,
    },
    spotlightZone: 'board',
  },

  // ── 8: Tap intersection → submit TILES (action) ───────────────────────────
  {
    id: 'intersection-guess',
    trigger: () => true,
    hint: {
      title: 'Crossing Words',
      body: "Remember you can switch words by tapping on the board too.\nTap the 6 letter word to switch to that word. Tapping twice on a cross letter will cycle between each word.\nType 'PATTER' and submit to continue.",
      isAction: true,
    },
    highlightTarget: 'intersection-tile',
    spotlightZone: 'board',
    expectedAction: (s, p) =>
      (s.guessCountByTarget[1] ?? 0) > (p.guessCountByTarget[1] ?? 0) &&
      s.lastGuessByTarget[1] === 'PATTER',
  },

  // ── 9a: Intersection colors -yellow ───────────────────────────────────────────────
  {
    id: 'intersection-colors',
    trigger: (s) => (s.guessCountByTarget[1] ?? 0) >= 1,
    hint: {
      title: 'Special Rules At Crosses',
      body: "Recall that {{wrongSpot}} means that letter is in the word but at another location.\n\nAt a crossing tile a {{wrongSpot}} means the letter IS in at least one of the two words that share that cell.\n\n'L' is in either the 6-letter word, the 4-letter word or both.",
      isAction: false,
    },
    spotlightZone: 'board',
  },

  // ── 9b: Intersection colors - blue ───────────────────────────────────────────────
  {
    id: 'intersection-colors-outline',
    trigger: (s) => (s.guessCountByTarget[1] ?? 0) >= 1,
    hint: {
      title: 'Special Rules At Crosses',
      body: "Recall that {{notInWord}} means the letter is not in the word but is used in another word.\n\nAt a crossing tile however, {{notInWord}} means the letter is in the puzzle but NOT in either of those words.\n\nYou know that 'A' is not in either the 6-letter word nor the 5-letter word.",
      isAction: false,
    },
    spotlightZone: 'board',
  },

   // ── 9c: Intersection colors - Red Outline ───────────────────────────────────────────────
  {
    id: 'intersection-colors-blue',
    trigger: (s) => (s.guessCountByTarget[1] ?? 0) >= 1,
    hint: {
      title: 'Special Rules At Crosses',
      body: "In the hint list, letters at crosses will receive a red outline.\n\nThe 'A' and 'E' are outlined red, so you know they lie at junctions.",
      isAction: false,
    },
    spotlightZone: 'board',
  },

  // ── 10: Guess locking ─────────────────────────────────────────────────────
  {
    id: 'guess-locking',
    trigger: () => true,
    hint: {
      title: 'Guess Locking',
      body: "The last guess is always at the bottom of your guess history.\n\nIf you want to force an older guess there, just long press to lock it. A red dot will show you it is locked.\n\nGood luck solving the rest of the puzzle and thank you for playing CrosSwordS!",
      isAction: false,
    },
    spotlightZone: 'history',
  },
];
