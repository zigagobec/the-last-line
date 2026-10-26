import { describe, expect, it } from 'vitest';
import { chooseAction, runMatch } from '../../src/sim/bot';
import { isLegal, Rng } from '../../src/game';
import { defaultRules } from '../../src/game/types';
import { createGame } from '../../src/game/setup';
import { makeState, P } from '../game/helpers';

describe('chooseAction', () => {
  it('always returns a legal action', () => {
    const s = createGame(defaultRules(), 3);
    const rng = new Rng(1);
    for (let i = 0; i < 50; i++) {
      expect(isLegal(s, chooseAction(s, rng, 'random'))).toBe(true);
      expect(isLegal(s, chooseAction(s, rng, 'greedy'))).toBe(true);
    }
  });

  it('greedy steps off a marked tile when it can', () => {
    const s = makeState(['.....', '.A...', '.....', '.....', '....2']);
    const a = chooseAction(s, new Rng(1), 'greedy');
    expect(a.type).toBe('move');
  });

  it('greedy traps an opponent standing on a marked tile with one exit', () => {
    // Player 2 at (3,3) is marked; trees block all exits but (3,2). Player 1 acts first.
    const s = makeState(['1....', '.....', '.....', '..TBT', '...T.']);
    const a = chooseAction(s, new Rng(1), 'greedy');
    expect(a).toEqual({ type: 'tree', at: P(3, 2) });
  });
});

describe('runMatch', () => {
  it('random-vs-random games terminate within size² rounds', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const r = runMatch(defaultRules(), seed, ['random', 'random']);
      expect(r.winner).not.toBeNull();
      expect(r.rounds).toBeLessThanOrEqual(64);
    }
  });

  it('greedy beats random in more than 70% of games', () => {
    let wins = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const r = runMatch(defaultRules(), seed, seed % 2 ? ['greedy', 'random'] : ['random', 'greedy']);
      const greedyId = seed % 2 ? 0 : 1;
      if (r.winner === greedyId) wins++;
    }
    expect(wins / 200).toBeGreaterThan(0.7);
  });
});
