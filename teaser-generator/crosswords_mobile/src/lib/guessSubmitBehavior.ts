/**
 * Small submit-flow helpers so keyboard dismissal behavior is explicit and testable.
 */

export type GuessSubmitOutcome = 'submitted' | 'validation_error' | 'runtime_error';

/**
 * Keyboard should dismiss only after an actual submit dispatch.
 */
export function shouldDismissKeyboardAfterSubmit(outcome: GuessSubmitOutcome): boolean {
  return outcome === 'submitted';
}

