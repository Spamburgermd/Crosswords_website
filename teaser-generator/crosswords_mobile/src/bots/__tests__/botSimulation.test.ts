/**
 * src/bots/__tests__/botSimulation.test.ts
 * ---------------------------------------------------------------------------
 * Bot difficulty benchmark: measures average guess counts per dictionary × difficulty.
 *
 * Hard mode entropy is O(200 × poolSize) per bot guess — too slow on pools > 2500.
 * We skip those combos and focus on where the data is actionable.
 *
 * Run:  npm test -- botSimulation
 */

import { generateBotMove, type BotDifficulty } from '../botEngine';
import { computeFeedback } from '../../gameEngine/feedback';
import { DEFAULT_RULES } from '../../gameEngine/types';
import { getWordsForDictionary } from '../../dictionary/dictionaryAdapter';

const MAX_GUESSES = 15;

// ─── Combos ─────────────────────────────────────────────────────────────────

type Combo = { dictId: string; label: string; diff: BotDifficulty; len: number; n: number };

function buildCombos(): Combo[] {
  const dicts = [
    { id: 'core',     label: 'Casual' },
    { id: 'standard', label: 'Medium' },
    { id: 'advanced', label: 'Sharp' },
    { id: 'canon',    label: 'Canon' },
  ];
  const out: Combo[] = [];
  // Pool size estimates (from first run):
  // core:     4L=1223, 5L=1373, 6L=2243
  // standard: 4L=1909, 5L=2487, 6L=3491
  // advanced: 4L=1909, 5L=2487, 6L=3491
  // canon:    4L=4910, 5L=11015, 6L=19353
  const pools: Record<string, Record<number, number>> = {
    core:     { 4: 1223, 5: 1373, 6: 2243 },
    standard: { 4: 1909, 5: 2487, 6: 3491 },
    advanced: { 4: 1909, 5: 2487, 6: 3491 },
    canon:    { 4: 4910, 5: 11015, 6: 19353 },
  };

  for (const d of dicts) {
    for (const diff of ['easy', 'normal', 'hard'] as BotDifficulty[]) {
      for (const len of [4, 5, 6]) {
        const p = pools[d.id][len];

        // Skip hard where pool > 5000 — entropy too slow
        if (diff === 'hard' && p > 5000) continue;
        // Normal uses frequency-only now (no entropy), safe at any pool size
        // but still skip very large pools to keep test time manageable
        if (diff === 'normal' && p > 20000) continue;

        let n: number;
        if (diff === 'easy') n = 25; // higher variance needs more samples
        else if (diff === 'hard') n = 8;
        else n = p > 4000 ? 10 : 15;

        out.push({ dictId: d.id, label: d.label, diff, len, n });
      }
    }
  }
  return out;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

async function simulateWord(
  target: string,
  difficulty: BotDifficulty,
  pool: string[],
  dictId: string,
): Promise<{ guesses: number; solved: boolean }> {
  const t = target.toUpperCase();
  const prevG: string[] = [];
  const prevF: Array<{ guess: string; codes: string[] }> = [];

  for (let i = 1; i <= MAX_GUESSES; i++) {
    const r = await generateBotMove({
      targetIndex: 0, targetLength: t.length,
      previousGuesses: prevG, previousFeedback: prevF,
      dictionaryId: dictId, difficulty, candidatePool: pool,
    });
    const g = r.guess.toUpperCase();
    prevG.push(g);
    if (g === t) return { guesses: i, solved: true };
    const fb = computeFeedback(t, g, DEFAULT_RULES);
    prevF.push({ guess: g, codes: fb.codes });
  }
  return { guesses: MAX_GUESSES, solved: false };
}

// ─── Result type ────────────────────────────────────────────────────────────

type R = {
  dictId: string; label: string; diff: BotDifficulty; len: number;
  pool: number; n: number; avg: number; med: number; min: number; max: number;
  solve: number; dist: Record<number, number>;
};

async function run(c: Combo): Promise<R> {
  const words = getWordsForDictionary(c.dictId);
  const pool = words.filter((w) => w.length === c.len).map((w) => w.toUpperCase());
  const targets = seededShuffle(pool, c.len * 1000 + 42).slice(0, Math.min(c.n, pool.length));

  const gs: number[] = [];
  let solved = 0;
  for (let i = 0; i < targets.length; i++) {
    const r = await simulateWord(targets[i], c.diff, pool, c.dictId);
    gs.push(r.guesses);
    if (r.solved) solved++;
    // Progress tick (stderr isn't buffered by Jest)
    process.stderr.write(`  ${c.label}/${c.diff}/${c.len}L: ${i + 1}/${targets.length}\r`);
  }
  process.stderr.write('\n');

  const sorted = [...gs].sort((a, b) => a - b);
  const dist: Record<number, number> = {};
  for (const g of gs) dist[g] = (dist[g] || 0) + 1;

  return {
    dictId: c.dictId, label: c.label, diff: c.diff, len: c.len,
    pool: pool.length, n: targets.length,
    avg: gs.reduce((a, b) => a + b, 0) / gs.length,
    med: sorted[Math.floor(sorted.length / 2)],
    min: sorted[0], max: sorted[sorted.length - 1],
    solve: solved / targets.length, dist,
  };
}

// ─── Test ───────────────────────────────────────────────────────────────────

jest.setTimeout(600_000);

describe('Bot Difficulty Simulation', () => {
  const results: R[] = [];
  const combos = buildCombos();

  afterAll(() => {
    const diffs: BotDifficulty[] = ['easy', 'normal', 'hard'];
    const dictIds = ['core', 'standard', 'advanced', 'canon'];
    const labels: Record<string, string> = { core: 'CASUAL', standard: 'MEDIUM', advanced: 'SHARP', canon: 'CANON' };

    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('  BOT DIFFICULTY BENCHMARK RESULTS');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    for (const did of dictIds) {
      const dr = results.filter((r) => r.dictId === did);
      if (dr.length === 0) continue;

      const ps = dr.reduce((m, r) => { m[r.len] = r.pool; return m; }, {} as Record<number, number>);
      console.log(`  ┌─ ${labels[did]} [${did}]`);
      console.log(`  │  Pools: 4L=${ps[4] ?? '?'}, 5L=${ps[5] ?? '?'}, 6L=${ps[6] ?? '?'}\n  │`);

      for (const diff of diffs) {
        const diffR = dr.filter((r) => r.diff === diff);
        if (diffR.length === 0) {
          console.log(`  │  ${diff.toUpperCase().padEnd(8)} │ (skipped — pool too large for entropy calc)`);
          console.log('  │');
          continue;
        }

        const w: Record<number, number> = { 4: 2, 5: 2, 6: 1 };
        let ws = 0, wt = 0, ss = 0, st = 0;
        for (const r of diffR) {
          const ww = w[r.len] || 1;
          ws += r.avg * ww; wt += ww;
          ss += r.solve * r.n; st += r.n;
        }

        const puzzleTotal = (ws / wt) * 5; // projected 5-word puzzle (4+4+5+5+6)
        console.log(`  │  ${diff.toUpperCase().padEnd(8)} │ Wtd avg: ${(ws / wt).toFixed(2)} guesses │ Puzzle ~${puzzleTotal.toFixed(0)} │ Solve: ${((ss / st) * 100).toFixed(0)}%`);
        for (const r of diffR) {
          const d = Object.entries(r.dist)
            .sort(([a], [b]) => +a - +b)
            .map(([k, v]) => `${k}g:${v}`).join(' ');
          console.log(`  │    ${r.len}L (n=${r.n}, pool=${r.pool}): avg=${r.avg.toFixed(2)} med=${r.med} [${r.min}-${r.max}] ${(r.solve * 100).toFixed(0)}% | ${d}`);
        }
        console.log('  │');
      }
      console.log('  └───────────────────────────────────────────────────────────────\n');
    }
  });

  it('runs all combos', async () => {
    for (const c of combos) {
      results.push(await run(c));
    }
    expect(results.length).toBe(combos.length);
  });
});
