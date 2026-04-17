/**
 * Contract test: gameStateSchema must parse the real backend GameStateOut payload.
 * If this fails, the frontend schema is out of sync with crosswords_server/app/schemas/schemas.py.
 */
import { gameStateSchema } from '../api';

const realPayload = {
  game_id: 240,
  status: 'waiting',
  start_at: null,
  current_turn_user_id: null,
  me: { user_id: 5, words_submitted: false, ready: false },
  opponent: { user_id: 3, words_submitted: true, ready: true },
  opponent_is_bot: true,
  opponent_history: [],
  your_progress_letters: 0,
  opponent_progress_letters: 0,
  total_letters: 24,
  your_history: [],
  target_lengths: [5, 4, 5, 4, 6],
  opponent_masked: [
    { coords: [[3, 7], [4, 7], [5, 7], [6, 7], [7, 7]], orient: 'V' },
  ],
  revealed_coords: [],
  your_history_grouped: {},
  your_solved: [false, false, false, false, false],
  dictionary_slot: 'STANDARD',
  debug_bot_words: null,
  debug_solution_words: null,
};

describe('gameStateSchema contract', () => {
  it('parses real backend payload', () => {
    const result = gameStateSchema.safeParse(realPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.game_id).toBe(240);
      expect(result.data.status).toBe('waiting');
      expect(result.data.me.user_id).toBe(5);
      expect(result.data.me.words_submitted).toBe(false);
      expect(result.data.opponent?.user_id).toBe(3);
    }
  });
});
