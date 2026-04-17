import { shouldDismissKeyboardAfterSubmit } from './guessSubmitBehavior';

describe('guess submit keyboard behavior', () => {
  it('dismisses keyboard only when a submit is dispatched', () => {
    expect(shouldDismissKeyboardAfterSubmit('submitted')).toBe(true);
    expect(shouldDismissKeyboardAfterSubmit('validation_error')).toBe(false);
    expect(shouldDismissKeyboardAfterSubmit('runtime_error')).toBe(false);
  });
});

