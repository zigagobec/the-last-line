import {
  add,
  applyAction,
  cell,
  cloneState,
  createGame,
  DIRS,
  edgeTiles,
  idx,
  inBounds,
  legalActions,
  moveTargets,
  other,
  performAction,
  playerAt,
  Rng,
} from '../game';
import type { Action, GameState, PlayerId, Pos, Rules } from '../game';

export type BotLevel = 'random' | 'greedy';

const DEATH = 1000;
const KILL = 900;

/** Tiles reachable within `depth` steps over unmarked standable land (bridges included). */
function reachable(s: GameState, from: Pos, depth: number): number {
  const seen = new Set<number>([idx(s, from)]);
  let frontier = [from];
  for (let d = 0; d < depth; d++) {
    const next: Pos[] = [];
    for (const p of frontier) {
      for (const dir of DIRS) {
        let q = add(p, dir);
        if (!inBounds(s, q)) continue;
        const c = cell(s, q);
        if (!c.land) {
          const along = dir.x !== 0 ? 'H' : 'V';
          if (c.bridge !== along) continue;
          q = add(q, dir);
          if (!inBounds(s, q)) continue;
        }
        const k = idx(s, q);
        const qc = cell(s, q);
        if (seen.has(k) || !qc.land || qc.tree || qc.marked || playerAt(s, q) !== null) continue;
        seen.add(k);
        next.push(q);
      }
    }
    frontier = next;
  }
  return seen.size - 1;
}

/** Whether player `id` could step onto an unmarked tile with one move. */
function canEscape(s: GameState, id: PlayerId): boolean {
  const t = cloneState(s);
  t.current = id;
  return moveTargets(t).some((m) => !cell(t, m.to).marked);
}

/**
 * Score the position after `me` acted this round, before erosion resolves.
 * Each player acts exactly once between marking and resolution, so a rat on a
 * marked tile after its own action is doomed.
 */
function evaluate(s: GameState, me: PlayerId, opponentStillActs: boolean): number {
  const opp = other(me);
  const onMark = (id: PlayerId) => cell(s, s.players[id]).marked;
  let score = 0;
  if (onMark(me)) score -= DEATH;
  if (onMark(opp) && (!opponentStillActs || !canEscape(s, opp))) score += KILL;
  score += reachable(s, s.players[me], 3) - reachable(s, s.players[opp], 3);
  const edges = new Set(edgeTiles(s).map((p) => idx(s, p)));
  if (edges.has(idx(s, s.players[me]))) score -= 2;
  if (edges.has(idx(s, s.players[opp]))) score += 1;
  return score;
}

export function chooseAction(s: GameState, rng: Rng, level: BotLevel = 'greedy'): Action {
  const actions = legalActions(s);
  if (level === 'random') return rng.pick(actions);
  const me = s.current;
  const opponentStillActs = s.acted === 0;
  let best = actions[0];
  let bestScore = -Infinity;
  for (const a of actions) {
    const t = cloneState(s);
    performAction(t, a);
    const score = evaluate(t, me, opponentStillActs) + rng.next() * 0.5;
    if (score > bestScore) {
      bestScore = score;
      best = a;
    }
  }
  return best;
}

export interface MatchResult {
  winner: PlayerId | 'draw' | null;
  rounds: number;
}

const ROUND_CAP = 500;

export function runMatch(rules: Rules, seed: number, bots: [BotLevel, BotLevel]): MatchResult {
  let s = createGame(rules, seed);
  const rng = new Rng(seed * 7919 + 1);
  while (!s.over && s.round <= ROUND_CAP) {
    s = applyAction(s, chooseAction(s, rng, bots[s.current])).state;
  }
  return { winner: s.winner, rounds: s.round };
}
