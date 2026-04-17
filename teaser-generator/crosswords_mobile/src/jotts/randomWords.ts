/**
 * Random word generator placeholder that respects allowed lengths and dictionary check.
 * Uses small sample pools until a real dictionary bundle is shipped.
 */
import { ALLOWED_WORD_LENGTHS } from '../config/wordRules';
import { DictionaryId, isValidWord, normalizeWord } from '../dictionary/dictionaryAdapter';

const SAMPLE_POOLS: Record<DictionaryId, string[]> = {
  common: ['APPLE', 'BREAD', 'CHAIR', 'DREAM', 'MUSIC', 'PLANT', 'WATER'],
  core: ['APPLE', 'BREAD', 'CHAIR', 'DREAM', 'MUSIC', 'PLANT', 'WATER'],
  canon: ['APPLE', 'BERRY', 'CANDY', 'STONE', 'BRICK', 'HOUSE', 'RIVER'],
  twl: ['APPLE', 'BERRY', 'CANDY', 'STONE', 'BRICK', 'HOUSE', 'RIVER'],
  modified: ['MOUSE', 'PLANT', 'LETTER', 'HONEY', 'PIZZA', 'QUAIL', 'WATER'],
  standard: ['MOUSE', 'PLANT', 'LETTER', 'HONEY', 'PIZZA', 'QUAIL', 'WATER'],
  advanced: ['CLOTH', 'GLYPH', 'THORN', 'SHARD', 'WRAITH', 'QUELL', 'RIVEN'],
  junior: ['CATS', 'TREE', 'MOON', 'FISH', 'STAR', 'BIRD', 'BOOK'],
};

function sample(pool: string[]): string {
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getRandomValidWords(count: number, dict: DictionaryId): string[] {
  const pool = SAMPLE_POOLS[dict] ?? SAMPLE_POOLS.canon;
  const words: string[] = [];
  while (words.length < count && pool.length > 0) {
    const candidate = normalizeWord(sample(pool));
    if (
      ALLOWED_WORD_LENGTHS.includes(candidate.length as (typeof ALLOWED_WORD_LENGTHS)[number]) &&
      isValidWord(candidate, dict) &&
      !words.includes(candidate)
    ) {
      words.push(candidate);
    }
  }
  return words;
}
