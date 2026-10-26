import { cell, cloneState, other } from './board';
import { resolveErosion, selectMarks } from './erosion';
import { Rng } from './rng';
import { isLegal, moveTargets } from './rules';
import type { Action, GameEvent, GameState, Pos } from './types';

/** Select marks for the current round on `s` in place, advancing its RNG. */
export function markRound(s: GameState): Pos[] {
  const rng = new Rng(s.rng);
  const marks = selectMarks(s, rng);
  for (const p of marks) cell(s, p).marked = true;
  s.rng = rng.state;
  return marks;
}

/** Apply the acting player's action effect to `s` in place, without turn flow or erosion. */
export function performAction(s: GameState, a: Action): GameEvent {
  const player = s.current;
  switch (a.type) {
    case 'move': {
      const from = s.players[player];
      const viaBridge = moveTargets(s).find((t) => t.to.x === a.to.x && t.to.y === a.to.y)!.viaBridge;
      s.players[player] = { ...a.to };
      return { type: 'move', player, from, to: { ...a.to }, viaBridge };
    }
    case 'tree':
      cell(s, a.at).tree = true;
      return { type: 'tree', player, at: { ...a.at } };
    case 'bridge':
      cell(s, a.at).bridge = a.dir;
      return { type: 'bridge', player, at: { ...a.at }, dir: a.dir };
    case 'erase': {
      const c = cell(s, a.at);
      const what = c.tree ? 'tree' : 'bridge';
      if (c.tree) c.tree = false;
      else c.bridge = null;
      return { type: 'erase', player, at: { ...a.at }, what };
    }
    case 'skip':
      return { type: 'skip', player };
  }
}

export function applyAction(prev: GameState, a: Action): { state: GameState; events: GameEvent[] } {
  if (!isLegal(prev, a)) throw new Error('Illegal action');
  const s = cloneState(prev);
  const player = s.current;
  const events: GameEvent[] = [performAction(s, a)];

  s.acted += 1;
  if (s.acted < 2) {
    s.current = other(player);
    return { state: s, events };
  }

  const r = resolveErosion(s);
  events.push({ type: 'erosion', ...r });
  if (r.fell.length) {
    s.over = true;
    s.winner = r.fell.length === 2 ? 'draw' : other(r.fell[0]);
    events.push({ type: 'gameOver', winner: s.winner });
    return { state: s, events };
  }

  s.round += 1;
  s.starter = other(s.starter);
  s.current = s.starter;
  s.acted = 0;
  const marked = markRound(s);
  events.push({ type: 'roundStart', round: s.round, starter: s.starter, marked });
  return { state: s, events };
}
