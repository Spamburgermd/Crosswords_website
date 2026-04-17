/**
 * src/bots/__tests__/botEngine.test.ts
 * Unit tests for bot engine to verify Easy/Normal/Hard difficulty implementations
 */

import { generateBotMove, getBotThinkingDelay } from '../botEngine';

// Mock dictionary pool
const MOCK_4_LETTER_WORDS = [
  'LIME', 'BOAT', 'TEAM', 'POOL', 'STAR', 'MOON', 'FIRE', 'WAVE',
  'ROCK', 'SAND', 'WIND', 'RAIN', 'SNOW', 'LEAF', 'TREE', 'BIRD'
];

const MOCK_5_LETTER_WORDS = [
  'APPLE', 'BERRY', 'CRANE', 'DELTA', 'EAGLE', 'FROST', 'GRAPE', 'HAPPY',
  'INDEX', 'JOLLY', 'KNIFE', 'LEMON', 'METAL', 'NIGHT', 'OCEAN', 'PIANO'
];

describe('botEngine', () => {
  describe('generateBotMove', () => {
    it('should return a valid guess for easy difficulty', async () => {
      const result = await generateBotMove({
        targetIndex: 0,
        targetLength: 4,
        previousGuesses: [],
        previousFeedback: [],
        dictionaryId: 'modified',
        difficulty: 'easy',
        candidatePool: MOCK_4_LETTER_WORDS,
      });

      expect(result.guess).toBeDefined();
      expect(result.guess.length).toBe(4);
      expect(MOCK_4_LETTER_WORDS).toContain(result.guess);
    });

    it('should return a valid guess for normal difficulty', async () => {
      const result = await generateBotMove({
        targetIndex: 0,
        targetLength: 5,
        previousGuesses: [],
        previousFeedback: [],
        dictionaryId: 'modified',
        difficulty: 'normal',
        candidatePool: MOCK_5_LETTER_WORDS,
      });

      expect(result.guess).toBeDefined();
      expect(result.guess.length).toBe(5);
      expect(MOCK_5_LETTER_WORDS).toContain(result.guess);
    });

    it('should return a valid guess for hard difficulty', async () => {
      const result = await generateBotMove({
        targetIndex: 0,
        targetLength: 5,
        previousGuesses: [],
        previousFeedback: [],
        dictionaryId: 'modified',
        difficulty: 'hard',
        candidatePool: MOCK_5_LETTER_WORDS,
      });

      expect(result.guess).toBeDefined();
      expect(result.guess.length).toBe(5);
      expect(MOCK_5_LETTER_WORDS).toContain(result.guess);
    });

    it('should not repeat previous guesses', async () => {
      const previousGuesses = ['APPLE', 'BERRY', 'CRANE'];

      const result = await generateBotMove({
        targetIndex: 0,
        targetLength: 5,
        previousGuesses,
        previousFeedback: [],
        dictionaryId: 'modified',
        difficulty: 'normal',
        candidatePool: MOCK_5_LETTER_WORDS,
      });

      expect(result.guess).toBeDefined();
      expect(previousGuesses).not.toContain(result.guess);
    });

    it('should filter candidates based on feedback', async () => {
      // Target is "APPLE", guessed "LEMON" → feedback would be specific
      const result = await generateBotMove({
        targetIndex: 0,
        targetLength: 5,
        previousGuesses: ['LEMON'],
        previousFeedback: [
          {
            guess: 'LEMON',
            codes: ['R', 'R', 'R', 'R', 'R'], // No letters match APPLE
          },
        ],
        dictionaryId: 'modified',
        difficulty: 'normal',
        candidatePool: MOCK_5_LETTER_WORDS,
      });

      expect(result.guess).toBeDefined();
      expect(result.candidatesRemaining).toBeLessThan(MOCK_5_LETTER_WORDS.length);
    });

    it('should return confidence value between 0 and 1', async () => {
      const result = await generateBotMove({
        targetIndex: 0,
        targetLength: 4,
        previousGuesses: [],
        previousFeedback: [],
        dictionaryId: 'modified',
        difficulty: 'normal',
        candidatePool: MOCK_4_LETTER_WORDS,
      });

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should handle empty candidate pool gracefully', async () => {
      const result = await generateBotMove({
        targetIndex: 0,
        targetLength: 4,
        previousGuesses: [],
        previousFeedback: [],
        dictionaryId: 'modified',
        difficulty: 'easy',
        candidatePool: [],
      });

      expect(result.guess).toBeDefined();
      expect(result.guess).toBe('AAAA'); // Fallback
    });

    it('should work with all difficulty levels', async () => {
      const difficulties: Array<'easy' | 'normal' | 'hard'> = ['easy', 'normal', 'hard'];

      for (const difficulty of difficulties) {
        const result = await generateBotMove({
          targetIndex: 0,
          targetLength: 5,
          previousGuesses: [],
          previousFeedback: [],
          dictionaryId: 'modified',
          difficulty,
          candidatePool: MOCK_5_LETTER_WORDS,
        });

        expect(result.guess).toBeDefined();
        expect(result.guess.length).toBe(5);
      }
    });
  });

  describe('getBotThinkingDelay', () => {
    it('should return appropriate delay for easy difficulty', () => {
      const delay = getBotThinkingDelay('easy');
      expect(delay).toBeGreaterThanOrEqual(600);
      expect(delay).toBeLessThanOrEqual(1200);
    });

    it('should return appropriate delay for normal difficulty', () => {
      const delay = getBotThinkingDelay('normal');
      expect(delay).toBeGreaterThanOrEqual(1200);
      expect(delay).toBeLessThanOrEqual(2000);
    });

    it('should return appropriate delay for hard difficulty', () => {
      const delay = getBotThinkingDelay('hard');
      expect(delay).toBeGreaterThanOrEqual(1800);
      expect(delay).toBeLessThanOrEqual(3000);
    });
  });

  describe('difficulty comparison', () => {
    it('easy mode should make more random guesses', async () => {
      const guesses = new Set<string>();

      // Make multiple guesses with same state
      for (let i = 0; i < 5; i++) {
        const result = await generateBotMove({
          targetIndex: 0,
          targetLength: 5,
          previousGuesses: [],
          previousFeedback: [],
          dictionaryId: 'modified',
          difficulty: 'easy',
          candidatePool: MOCK_5_LETTER_WORDS,
        });
        guesses.add(result.guess);
      }

      // Easy mode should have high variance (different guesses)
      expect(guesses.size).toBeGreaterThan(2);
    });

    it('hard mode should use entropy optimization', async () => {
      // With large pool, hard mode should sample and optimize
      const largePool = [...MOCK_5_LETTER_WORDS, ...MOCK_5_LETTER_WORDS, ...MOCK_5_LETTER_WORDS];

      const result = await generateBotMove({
        targetIndex: 0,
        targetLength: 5,
        previousGuesses: [],
        previousFeedback: [],
        dictionaryId: 'modified',
        difficulty: 'hard',
        candidatePool: largePool,
      });

      expect(result.guess).toBeDefined();
      expect(result.candidatesRemaining).toBeLessThanOrEqual(largePool.length);
    });

    it('easy mode should have variable candidatesRemaining due to feedback retention', async () => {
      const feedback = [
        { guess: 'LEMON', codes: ['R', 'R', 'R', 'R', 'R'] },
        { guess: 'FROST', codes: ['R', 'R', 'R', 'R', 'R'] },
        { guess: 'HAPPY', codes: ['R', 'R', 'R', 'R', 'R'] },
      ];

      const results = new Set<number>();
      for (let i = 0; i < 20; i++) {
        const result = await generateBotMove({
          targetIndex: 0,
          targetLength: 5,
          previousGuesses: ['LEMON', 'FROST', 'HAPPY'],
          previousFeedback: feedback,
          dictionaryId: 'modified',
          difficulty: 'easy',
          candidatePool: MOCK_5_LETTER_WORDS,
        });
        results.add(result.candidatesRemaining);
      }

      // With 50% retention on 3 feedback rounds, we should see variation
      expect(results.size).toBeGreaterThan(1);
    });

    it('normal/hard mode should have consistent candidatesRemaining', async () => {
      const feedback = [
        { guess: 'LEMON', codes: ['R', 'R', 'R', 'R', 'R'] },
      ];

      const results = new Set<number>();
      for (let i = 0; i < 5; i++) {
        const result = await generateBotMove({
          targetIndex: 0,
          targetLength: 5,
          previousGuesses: ['LEMON'],
          previousFeedback: feedback,
          dictionaryId: 'modified',
          difficulty: 'normal',
          candidatePool: MOCK_5_LETTER_WORDS,
        });
        results.add(result.candidatesRemaining);
      }

      // Normal mode always applies feedback — candidatesRemaining should be consistent
      expect(results.size).toBe(1);
    });
  });
});
