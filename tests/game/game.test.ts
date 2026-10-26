import { describe, expect, it } from 'vitest';
import { applyAction } from '../../src/game/game';
import { cell } from '../../src/game/board';
import { moveTargets } from '../../src/game/rules';
import { createGame } from '../../src/game/setup';
import { defaultRules, type GameEvent } from '../../src/game/types';
import { makeState, P } from './helpers';

const types = (ev: GameEvent[]) => ev.map((e) => e.type);

describe('createGame marks', () => {
  it('marks round-1 tiles at game start', () => {
    const s = createGame(defaultRules(), 5);
    expect(s.cells.filter((c) => c.marked).length).toBe(3);
  });
});

describe('applyAction round flow', () => {
  it('passes the turn after the first action without erosion', () => {
    const s = makeState(['1....', '.....', '..!..', '.....', '....2']);
    const { state, events } = applyAction(s, { type: 'skip' });
    expect(state.current).toBe(1);
    expect(state.acted).toBe(1);
    expect(types(events)).toEqual(['skip']);
    expect(cell(state, P(2, 2)).land).toBe(true);
  });

  it('resolves erosion after the second action and starts the next round with the other starter', () => {
    const s = makeState(['1....', '.....', '..!..', '.....', '....2']);
    const a = applyAction(s, { type: 'move', to: P(1, 0) });
    const b = applyAction(a.state, { type: 'tree', at: P(3, 3) });
    expect(types(b.events)).toEqual(['tree', 'erosion', 'roundStart']);
    expect(cell(b.state, P(2, 2)).land).toBe(false);
    expect(b.state.round).toBe(2);
    expect(b.state.starter).toBe(1);
    expect(b.state.current).toBe(1);
    expect(b.state.acted).toBe(0);
    const start = b.events.find((e) => e.type === 'roundStart');
    expect(start && start.type === 'roundStart' && start.marked.length).toBe(3);
    expect(b.state.cells.filter((c) => c.marked).length).toBe(3);
  });

  it('alternates the starter back to player 0 in round 3', () => {
    // Players sit away from the ring and only edge tiles erode, so nobody can fall here.
    let s = makeState(['......', '......', '..1...', '...2..', '......', '......'], { randomErosion: 0 });
    for (let i = 0; i < 4; i++) s = applyAction(s, { type: 'skip' }).state;
    expect(s.over).toBe(false);
    expect(s.round).toBe(3);
    expect(s.starter).toBe(0);
    expect(s.current).toBe(0);
  });

  it('emits move events with bridge info', () => {
    const s = makeState(['1-...', '.....', '.....', '.....', '....2']);
    const { events } = applyAction(s, { type: 'move', to: P(2, 0) });
    expect(events[0]).toEqual({ type: 'move', player: 0, from: P(0, 0), to: P(2, 0), viaBridge: true });
  });

  it('applies tree, bridge and erase actions', () => {
    const s = makeState(['1#...', '.....', '..T..', '.....', '....2']);
    const t = applyAction(s, { type: 'bridge', at: P(1, 0), dir: 'H' });
    expect(cell(t.state, P(1, 0)).bridge).toBe('H');
    const e = applyAction(t.state, { type: 'erase', at: P(2, 2) });
    expect(e.events[0]).toEqual({ type: 'erase', player: 1, at: P(2, 2), what: 'tree' });
    expect(cell(e.state, P(2, 2)).tree).toBe(false);
  });

  it('throws on illegal actions', () => {
    const s = makeState(['1T', '.2']);
    expect(() => applyAction(s, { type: 'move', to: P(1, 0) })).toThrow('Illegal action');
  });

  it('does not mutate the input state', () => {
    const s = makeState(['1....', '.....', '..!..', '.....', '....2']);
    const snapshot = JSON.stringify(s);
    const a = applyAction(s, { type: 'tree', at: P(2, 2) });
    applyAction(a.state, { type: 'skip' });
    expect(JSON.stringify(s)).toBe(snapshot);
  });
});

describe('game end', () => {
  it('declares the other player the winner when one falls', () => {
    const s = makeState(['A....', '.....', '.....', '.....', '....2']);
    const a = applyAction(s, { type: 'skip' });
    const b = applyAction(a.state, { type: 'skip' });
    expect(b.state.over).toBe(true);
    expect(b.state.winner).toBe(1);
    expect(b.events.at(-1)).toEqual({ type: 'gameOver', winner: 1 });
    expect(types(b.events)).not.toContain('roundStart');
  });

  it('declares a draw when both fall in the same resolution', () => {
    const s = makeState(['A....', '.....', '.....', '.....', '....B']);
    const b = applyAction(applyAction(s, { type: 'skip' }).state, { type: 'skip' });
    expect(b.state.winner).toBe('draw');
    expect(b.state.fallen).toEqual([true, true]);
  });

  it('lets a player escape a marked tile by moving off it', () => {
    const s = makeState(['A....', '.....', '.....', '.....', '....2']);
    const a = applyAction(s, { type: 'move', to: P(1, 0) });
    const b = applyAction(a.state, { type: 'skip' });
    expect(b.state.over).toBe(false);
  });

  it('saves a marked tile with a tree', () => {
    const s = makeState(['1!...', '.....', '.....', '.....', '....2']);
    const a = applyAction(s, { type: 'tree', at: P(1, 0) });
    const b = applyAction(a.state, { type: 'skip' });
    expect(cell(b.state, P(1, 0)).land).toBe(true);
    expect(cell(b.state, P(1, 0)).tree).toBe(false);
  });

  it('keeps a boxed-in player on a marked tile alive until resolution (review focus 2)', () => {
    const s = makeState(['.T...', 'TAT..', '.T...', '.....', '....2'], { current: 1 });
    const a = applyAction({ ...s, starter: 1 }, { type: 'skip' });
    expect(a.state.over).toBe(false);
    expect(a.state.current).toBe(0);
    expect(moveTargets(a.state)).toEqual([]);
    const b = applyAction(a.state, { type: 'skip' });
    expect(b.state.winner).toBe(1);
  });

  it('removes a bridge crossing once its endpoint erodes (review focus 1)', () => {
    const s = makeState(['1-!..', '.....', '.....', '.....', '....2']);
    const b = applyAction(applyAction(s, { type: 'skip' }).state, { type: 'skip' });
    // round 2: player 1 starts; skip to give player 0 the turn
    const c = applyAction(b.state, { type: 'skip' });
    expect(c.state.current).toBe(0);
    expect(moveTargets(c.state).some((t) => t.viaBridge)).toBe(false);
  });
});
