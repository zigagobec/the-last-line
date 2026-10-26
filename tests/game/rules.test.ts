import { describe, expect, it } from 'vitest';
import { bridgeDirs, canErase, canTree, inRange, isLegal, legalActions, moveTargets } from '../../src/game/rules';
import { makeState, P, sortPos } from './helpers';

const targets = (s: ReturnType<typeof makeState>) => sortPos(moveTargets(s).map((t) => t.to));

describe('moveTargets', () => {
  it('offers the four free neighbours', () => {
    const s = makeState(['...', '.1.', '...', ], { current: 0 });
    expect(targets(s)).toEqual(sortPos([P(1, 0), P(0, 1), P(2, 1), P(1, 2)]));
  });

  it('excludes trees, gaps and the other player but allows marked land', () => {
    const s = makeState(['.T.', '#12', '.!.']);
    expect(targets(s)).toEqual(sortPos([P(1, 2)]));
  });

  it('crosses a bridge oriented along the move direction', () => {
    const s = makeState(['1-.', '...', '...']);
    const t = moveTargets(s);
    expect(t).toContainEqual({ to: P(2, 0), viaBridge: true });
  });

  it('does not cross a bridge in the wrong orientation', () => {
    const s = makeState(['1|.', '...', '...']);
    expect(moveTargets(s).some((t) => t.viaBridge)).toBe(false);
  });

  it('does not cross when the far side is blocked', () => {
    expect(moveTargets(makeState(['1-T', '...', '...'])).some((t) => t.viaBridge)).toBe(false);
    expect(moveTargets(makeState(['1-2', '...', '...'])).some((t) => t.viaBridge)).toBe(false);
  });

  it('crosses vertical bridges', () => {
    const s = makeState(['1..', '|..', '...']);
    expect(moveTargets(s)).toContainEqual({ to: P(0, 2), viaBridge: true });
  });
});

describe('canTree', () => {
  const s = makeState(['1T.', '#!.', '..2']);
  it('allows empty land, including marked land', () => {
    expect(canTree(s, P(2, 0))).toBe(true);
    expect(canTree(s, P(1, 1))).toBe(true);
  });
  it('rejects trees, gaps and player tiles', () => {
    expect(canTree(s, P(1, 0))).toBe(false);
    expect(canTree(s, P(0, 1))).toBe(false);
    expect(canTree(s, P(0, 0))).toBe(false);
    expect(canTree(s, P(2, 2))).toBe(false);
  });
});

describe('bridgeDirs', () => {
  it('finds the horizontal span', () => {
    expect(bridgeDirs(makeState(['1..', '.#.', '#.2']), P(1, 1))).toEqual(['H', 'V']);
    expect(bridgeDirs(makeState(['1#.', '.#.', '..2']), P(1, 1))).toEqual(['H']);
  });
  it('rejects gaps on the board edge without land on both sides', () => {
    expect(bridgeDirs(makeState(['#1.', '...', '..2']), P(0, 0))).toEqual([]);
  });
  it('rejects land and already-bridged gaps', () => {
    expect(bridgeDirs(makeState(['1..', '...', '..2']), P(1, 1))).toEqual([]);
    expect(bridgeDirs(makeState(['1#.', '.-.', '..2']), P(1, 1))).toEqual([]);
  });
  it('allows a tree on an endpoint', () => {
    expect(bridgeDirs(makeState(['1#.', 'T#.', '.#2']), P(1, 1))).toEqual(['H']);
  });
});

describe('canErase', () => {
  const s = makeState(['1T.', '.-.', '..2']);
  it('erases trees and bridges only', () => {
    expect(canErase(s, P(1, 0))).toBe(true);
    expect(canErase(s, P(1, 1))).toBe(true);
    expect(canErase(s, P(2, 0))).toBe(false);
  });
});

describe('range', () => {
  const rows = ['1....', '.....', '..T..', '.....', '....2'];
  it("'any' allows everything", () => {
    expect(inRange(makeState(rows, { range: 'any' }), P(4, 3))).toBe(true);
  });
  it('limits draw/erase targets by Manhattan distance', () => {
    const s2 = makeState(rows, { range: 2 });
    expect(canTree(s2, P(1, 1))).toBe(true);
    expect(canTree(s2, P(2, 1))).toBe(false);
    expect(canErase(s2, P(2, 2))).toBe(false);
    const s1 = makeState(rows, { range: 1 });
    expect(canTree(s1, P(1, 0))).toBe(true);
    expect(canTree(s1, P(1, 1))).toBe(false);
  });
  it('does not limit moves', () => {
    const s = makeState(['1-.', '...', '..2'], { range: 1 });
    expect(moveTargets(s)).toContainEqual({ to: P(2, 0), viaBridge: true });
  });
  it('measures range from the current player', () => {
    const s = makeState(rows, { range: 1, current: 1 });
    expect(canTree(s, P(4, 3))).toBe(true);
    expect(canTree(s, P(1, 0))).toBe(false);
  });
});

describe('legalActions / isLegal', () => {
  it('always includes skip', () => {
    const s = makeState(['1T', 'T2']);
    expect(legalActions(s)).toContainEqual({ type: 'skip' });
  });
  it('validates each action type', () => {
    const s = makeState(['1.#.', '..#.', '....', '...2']);
    expect(isLegal(s, { type: 'move', to: P(1, 0) })).toBe(true);
    expect(isLegal(s, { type: 'move', to: P(2, 0) })).toBe(false);
    expect(isLegal(s, { type: 'tree', at: P(3, 3) })).toBe(false);
    expect(isLegal(s, { type: 'tree', at: P(1, 1) })).toBe(true);
    expect(isLegal(s, { type: 'bridge', at: P(2, 0), dir: 'H' })).toBe(true);
    expect(isLegal(s, { type: 'bridge', at: P(2, 0), dir: 'V' })).toBe(false);
    expect(isLegal(s, { type: 'erase', at: P(1, 1) })).toBe(false);
    expect(isLegal(s, { type: 'skip' })).toBe(true);
  });
  it('rejects out-of-bounds targets', () => {
    const s = makeState(['1.', '.2']);
    expect(isLegal(s, { type: 'tree', at: P(5, 5) })).toBe(false);
    expect(isLegal(s, { type: 'move', to: P(-1, 0) })).toBe(false);
  });
  it('rejects everything once the game is over', () => {
    const s = { ...makeState(['1.', '.2']), over: true };
    expect(isLegal(s, { type: 'skip' })).toBe(false);
    expect(legalActions(s)).toEqual([]);
  });
  it('lists every legal action', () => {
    const s = makeState(['1#.', '...', '..2']);
    const acts = legalActions(s);
    expect(acts.filter((a) => a.type === 'move').length).toBe(1);
    expect(acts.filter((a) => a.type === 'bridge').length).toBe(1);
    // 9 cells - 1 gap - 2 players
    expect(acts.filter((a) => a.type === 'tree').length).toBe(6);
  });
});
