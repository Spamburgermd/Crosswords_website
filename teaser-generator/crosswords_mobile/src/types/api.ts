/**
 * src/types/api.ts
 * ---------------------------------------------
 * Zod schemas and TypeScript types for the FastAPI responses we consume.
 * Using runtime validation protects the app from schema drift coming from the server.
 */
import { z } from 'zod';

export const playerStateSummarySchema = z.object({
  user_id: z.number(),
  words_submitted: z.boolean(),
  ready: z.boolean(),
});

export const guessEntrySchema = z.object({
  target_index: z.number(),
  guess: z.string(),
  codes: z.array(z.string()),
  created_at: z.string(),
});

/** Masked word segment: coords (number[][]) and orient (backend sends str). */
export const maskedSegmentSchema = z.object({
  coords: z.array(z.array(z.number())),
  orient: z.string(),
});

export type MaskedWord = z.infer<typeof maskedSegmentSchema>;
export const targetMetaSchema = z.object({
  target_index: z.number(),
  length: z.number(),
  start: z.tuple([z.number(), z.number()]),
  dir: z.string(),
  coords: z.array(z.tuple([z.number(), z.number()])),
});

// NOTE: Schema must remain compatible with backend GameStateOut;
// do not tighten without updating server contract.

export const gameStateSchema = z.object({
  game_id: z.number(),
  status: z.string(),
  start_at: z.string().nullable().optional(),
  current_turn_user_id: z.number().nullable().optional(),
  me: playerStateSummarySchema,
  opponent: playerStateSummarySchema.nullable().optional(),
  opponent_is_bot: z.boolean().optional().default(false),
  opponent_history: z.array(guessEntrySchema).optional().default([]),
  your_progress_letters: z.number(),
  opponent_progress_letters: z.number(),
  total_letters: z.number(),
  your_history: z.array(guessEntrySchema).optional().default([]),
  target_lengths: z.array(z.number()).optional().default([]),
  opponent_masked: z.array(maskedSegmentSchema).optional().default([]),
  revealed_coords: z.array(z.array(z.number())).optional().default([]),
  your_history_grouped: z.record(z.array(guessEntrySchema)).optional().default({}),
  your_solved: z.array(z.boolean()).optional().default([]),
  dictionary_slot: z.string().optional().default('STANDARD'),
  debug_bot_words: z.array(z.string()).nullable().optional(),
  debug_solution_words: z.array(z.string()).nullable().optional(),
  targets_meta: z.array(targetMetaSchema).optional().default([]),
});

export const createGameResponseSchema = z.object({
  game_id: z.number(),
});

export const okResponseSchema = z.object({
  ok: z.literal(true),
});

export const guessResponseSchema = okResponseSchema.extend({
  codes: z.array(z.string()).optional(),
});

// -------- Friends / Profiles --------
export const profileSchema = z.object({
  user_id: z.number(),
  display_name: z.string(),
  avatar_url: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  last_active_at: z.string(),
  created_at: z.string(),
});

export const friendRequestSchema = z.object({
  id: z.number(),
  from_user_id: z.number(),
  to_user_id: z.number(),
  status: z.string(),
  created_at: z.string(),
  responded_at: z.string().nullable().optional(),
  from_display_name: z.string().nullable().optional(),
  to_display_name: z.string().nullable().optional(),
});

export const friendSchema = z.object({
  user_id: z.number(),
  display_name: z.string().nullable().optional(),
  since: z.string(),
});

export type Profile = z.infer<typeof profileSchema>;
export type FriendRequest = z.infer<typeof friendRequestSchema>;
export type Friend = z.infer<typeof friendSchema>;

// Matchmaking
export const matchmakingStatusSchema = z.object({
  game_id: z.number(),
});

export type MatchmakingStatus = z.infer<typeof matchmakingStatusSchema>;

export type PlayerStateSummary = z.infer<typeof playerStateSummarySchema>;
export type GuessEntry = z.infer<typeof guessEntrySchema>;
export type MaskedSegment = z.infer<typeof maskedSegmentSchema>;
export type GameState = z.infer<typeof gameStateSchema>;
export type CreateGameResponse = z.infer<typeof createGameResponseSchema>;
export type TargetMeta = z.infer<typeof targetMetaSchema>;
