import { reconcileEvidenceFeedback } from './evidenceFeedback';

function buildHistory(
  entries: Record<number, Array<{ guess: string; codes: string[] }>>,
) {
  return new Map<number, Array<{ guess: string; codes: string[] }>>(
    Object.entries(entries).map(([targetIndex, guesses]) => [Number(targetIndex), guesses]),
  );
}

describe('reconcileEvidenceFeedback', () => {
  /* ------------------------------------------------------------------ */
  /*  G and R always preserved                                           */
  /* ------------------------------------------------------------------ */

  it('preserves G and R codes unchanged', () => {
    const result = reconcileEvidenceFeedback({
      targetWords: ['APPLE', 'BRICK'],
      historyByTarget: buildHistory({
        0: [{ guess: 'APPLE', codes: ['G', 'G', 'G', 'G', 'G'] }],
        1: [{ guess: 'ZZZZZ', codes: ['R', 'R', 'R', 'R', 'R'] }],
      }),
    });

    expect(result.historyByTarget.get(0)?.[0]?.codes).toEqual(['G', 'G', 'G', 'G', 'G']);
    expect(result.historyByTarget.get(1)?.[0]?.codes).toEqual(['R', 'R', 'R', 'R', 'R']);
  });

  /* ------------------------------------------------------------------ */
  /*  Y stays Y when same-word capacity remains                          */
  /* ------------------------------------------------------------------ */

  it('preserves Y when the same word still plausibly contains another copy of the letter', () => {
    const result = reconcileEvidenceFeedback({
      targetWords: ['KAYAK', 'TAXED'],
      historyByTarget: buildHistory({
        0: [{ guess: 'KAAOO', codes: ['G', 'G', 'Y', 'R', 'R'] }],
      }),
    });

    expect(result.historyByTarget.get(0)?.[0]?.codes).toEqual(['G', 'G', 'Y', 'R', 'R']);
  });

  /* ------------------------------------------------------------------ */
  /*  Y remains Y even when later evidence exhausts same-word capacity   */
  /* ------------------------------------------------------------------ */

  it('preserves Y when same-word capacity is later exhausted and another word has the letter', () => {
    // WARDEN has 1 E (confirmed green at pos 4)
    // LEMON has 1 E (unconfirmed)
    // No blue evidence anywhere — OLD logic would give R, NEW gives B
    const result = reconcileEvidenceFeedback({
      targetWords: ['WARDEN', 'LEMON'],
      historyByTarget: buildHistory({
        0: [{ guess: 'SHEAES', codes: ['R', 'R', 'Y', 'Y', 'G', 'R'] }],
      }),
    });

    // E at pos 2 was earned as Y and must remain Y even after later evidence.
    // A at pos 3 was Y and also remains Y.
    expect(result.historyByTarget.get(0)?.[0]?.codes).toEqual(['R', 'R', 'Y', 'Y', 'G', 'R']);
  });

  /* ------------------------------------------------------------------ */
  /*  Y remains Y even when same-word AND cross-word capacity exhaust    */
  /* ------------------------------------------------------------------ */

  it('preserves Y when same-word capacity is exhausted and cross-word capacity is also exhausted', () => {
    const result = reconcileEvidenceFeedback({
      targetWords: ['WARDEN', 'TAXED'],
      historyByTarget: buildHistory({
        0: [{ guess: 'SHEAES', codes: ['R', 'R', 'Y', 'Y', 'G', 'R'] }],
        1: [{ guess: 'TAXED', codes: ['G', 'G', 'G', 'G', 'G'] }],
      }),
    });

    // E at pos 2 was earned as Y and must remain Y even after later evidence.
    expect(result.historyByTarget.get(0)?.[0]?.codes).toEqual(['R', 'R', 'Y', 'Y', 'G', 'R']);
  });

  /* ------------------------------------------------------------------ */
  /*  Y remains Y for duplicate letters after later confirmations         */
  /* ------------------------------------------------------------------ */

  it('preserves an earned Y for duplicate letters even after later confirmations', () => {
    const result = reconcileEvidenceFeedback({
      targetWords: ['SARIN', 'SAVED'],
      historyByTarget: buildHistory({
        0: [{ guess: 'SARAIN', codes: ['R', 'R', 'G', 'Y', 'R', 'G'] }],
        1: [{ guess: 'SAVED', codes: ['G', 'G', 'G', 'G', 'G'] }],
      }),
      confirmedLettersByTarget: {
        0: { 1: 'A', 2: 'R', 5: 'N' },
        1: { 0: 'S', 1: 'A', 2: 'V', 3: 'E', 4: 'D' },
      },
    });

    expect(result.historyByTarget.get(0)?.[0]?.codes).toEqual(['R', 'R', 'G', 'Y', 'R', 'G']);
  });

  /* ------------------------------------------------------------------ */
  /*  B stays B when cross-word plausible                                */
  /* ------------------------------------------------------------------ */

  it('preserves B when cross-word capacity remains', () => {
    const result = reconcileEvidenceFeedback({
      targetWords: ['APPLE', 'BRICK', 'LEMON'],
      historyByTarget: buildHistory({
        0: [{ guess: 'BXXXX', codes: ['B', 'R', 'R', 'R', 'R'] }],
      }),
    });

    // B at pos 0: letter B exists in BRICK (unconfirmed) → cross-word plausible → B stays
    expect(result.historyByTarget.get(0)?.[0]?.codes).toEqual(['B', 'R', 'R', 'R', 'R']);
  });

  /* ------------------------------------------------------------------ */
  /*  B→R when cross-word capacity exhausted                             */
  /* ------------------------------------------------------------------ */

  it('downgrades B to R when cross-word capacity is exhausted', () => {
    const result = reconcileEvidenceFeedback({
      targetWords: ['WARDEN', 'TAXED', 'BRICK'],
      historyByTarget: buildHistory({
        0: [{ guess: 'SHEAES', codes: ['R', 'R', 'Y', 'Y', 'G', 'R'] }],
        1: [{ guess: 'TAXED', codes: ['G', 'G', 'G', 'G', 'G'] }],
        2: [{ guess: 'ELLLL', codes: ['B', 'R', 'R', 'R', 'R'] }],
      }),
    });

    // For target 2, guess ELLLL: E at pos 0 was B (not in BRICK, in puzzle)
    // Cross-word plausible for E: WARDEN has 1E (1 confirmed green) = 0 remaining,
    //   TAXED has 1E (1 confirmed green) = 0 remaining → all exhausted → B→R
    expect(result.historyByTarget.get(2)?.[0]?.codes).toEqual(['R', 'R', 'R', 'R', 'R']);
  });

  /* ------------------------------------------------------------------ */
  /*  No BE codes ever produced                                          */
  /* ------------------------------------------------------------------ */

  it('never produces BE codes in reconciled output', () => {
    const result = reconcileEvidenceFeedback({
      targetWords: ['APPLE', 'BRICK', 'LEMON'],
      historyByTarget: buildHistory({
        0: [{ guess: 'BXXXX', codes: ['B', 'R', 'R', 'R', 'R'] }],
        1: [{ guess: 'BRICK', codes: ['G', 'G', 'G', 'G', 'G'] }],
      }),
    });

    const allCodes = Array.from(result.historyByTarget.values())
      .flatMap((entries) => entries.flatMap((e) => e.codes));
    expect(allCodes).not.toContain('BE');
  });

  /* ------------------------------------------------------------------ */
  /*  discoveredBlueLetters no longer in return type                      */
  /* ------------------------------------------------------------------ */

  it('does not return discoveredBlueLetters in the result', () => {
    const result = reconcileEvidenceFeedback({
      targetWords: ['WARDEN', 'BRICK'],
      historyByTarget: buildHistory({
        1: [{ guess: 'ELLLL', codes: ['B', 'R', 'R', 'R', 'R'] }],
      }),
    });

    expect(result).not.toHaveProperty('discoveredBlueLetters');
  });

  /* ------------------------------------------------------------------ */
  /*  Fallback: normalized raw history when target words unavailable      */
  /* ------------------------------------------------------------------ */

  it('falls back to normalized raw history when target words are unavailable', () => {
    const result = reconcileEvidenceFeedback({
      targetWords: null,
      historyByTarget: buildHistory({
        0: [{ guess: 'mixed', codes: ['yellow', 'blue', 'green', 'red', 'yellow'] }],
      }),
    });

    expect(result.historyByTarget.get(0)?.[0]?.guess).toBe('MIXED');
    expect(result.historyByTarget.get(0)?.[0]?.codes).toEqual(['Y', 'B', 'G', 'R', 'Y']);
  });

  /* ------------------------------------------------------------------ */
  /*  Y remains Y with multiple unsolved cross-words                     */
  /* ------------------------------------------------------------------ */

  it('preserves Y when same-word is exhausted and another unsolved cross-word still has the letter', () => {
    const result = reconcileEvidenceFeedback({
      targetWords: ['WARDEN', 'TAXED', 'LEMON'],
      historyByTarget: buildHistory({
        0: [{ guess: 'SHEAES', codes: ['R', 'R', 'Y', 'Y', 'G', 'R'] }],
        1: [{ guess: 'TAXED', codes: ['G', 'G', 'G', 'G', 'G'] }],
      }),
    });

    // E at pos 2 was earned as Y and remains Y.
    expect(result.historyByTarget.get(0)?.[0]?.codes).toEqual(['R', 'R', 'Y', 'Y', 'G', 'R']);
  });
  it('preserves the original yellow for CIGAR against NANCY after crossing letters become confirmed', () => {
    const result = reconcileEvidenceFeedback({
      targetWords: ['NANCY', 'TALBOT', 'CIGAR'],
      historyByTarget: buildHistory({
        0: [{ guess: 'CIGAR', codes: ['Y', 'R', 'R', 'Y', 'R'] }],
      }),
      confirmedLettersByTarget: {
        0: { 1: 'A', 3: 'C' },
      },
    });

    expect(result.historyByTarget.get(0)?.[0]?.codes).toEqual(['Y', 'R', 'R', 'Y', 'R']);
  });
});
