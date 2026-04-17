// crosswords_mobile/src/screens/tutorial/types.ts

export type TutorialHighlightTarget =
  | 'submit-button'      // → emphasizeKeyboard=true on GameBoardPanel
  | 'word-tabs'          // → emphasizedRailTargetIndex=highlightTargetIndex
  | 'intersection-tile'  // → emphasizeBoard=true

export type SpotlightZone =
  | 'board'
  | 'statusRail'
  | 'wordCards'
  | 'history'
  | 'keyboard'

export type ZoneRect = { x: number; y: number; width: number; height: number }

export type TutorialPhase =
  | { kind: 'PLAYING'; nextStepIndex: number }
  | { kind: 'HINT';    stepIndex: number }
  | { kind: 'DONE' }

/**
 * Minimal game state snapshot passed to trigger / expectedAction functions.
 * Derived inside TutorialScreen from rawHistoryByTarget + activeTargetIndex.
 */
export type TutorialGameState = {
  guessCountByTarget: Record<number, number>  // guesses submitted per targetIndex
  lastGuessByTarget:  Record<number, string>  // most recent guess text per targetIndex
  activeTargetIndex: number
}

export type TutorialStep = {
  id: string
  trigger:          (state: TutorialGameState) => boolean
  hint: {
    title?:   string
    body:     string
    isAction: boolean   // true → show × only; false → show Got it! + ×
  }
  preFill?:             string   // guess text to load when this step activates
  preFillTargetIndex?:  number   // which word the preFill applies to
  lockPreFill?:         boolean  // prevent keyboard edits; only submit is allowed
  highlightTarget?:     TutorialHighlightTarget
  highlightTargetIndex?: number  // for 'word-tabs': which tab to emphasize
  emphasizeKeyboard?:   boolean  // highlight the submit key independently of highlightTarget
  spotlightZone?:       SpotlightZone  // which zone to spotlight (cutout hole)
  expectedAction?:      (state: TutorialGameState, prev: TutorialGameState) => boolean
}
