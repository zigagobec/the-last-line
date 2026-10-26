import { add, allPositions, cell, DIRS, eq, inBounds, manhattan, playerAt } from './board';
import type { Action, BridgeDir, GameState, Pos } from './types';

export interface MoveTarget {
  to: Pos;
  viaBridge: boolean;
}

/** Whether `at` is within drawing/erasing range of the current player's rat. */
export function inRange(s: GameState, at: Pos): boolean {
  if (s.rules.range === 'any') return true;
  return manhattan(s.players[s.current], at) <= s.rules.range;
}

function standable(s: GameState, p: Pos): boolean {
  if (!inBounds(s, p)) return false;
  const c = cell(s, p);
  return c.land && !c.tree && playerAt(s, p) === null;
}

export function moveTargets(s: GameState): MoveTarget[] {
  const from = s.players[s.current];
  const out: MoveTarget[] = [];
  for (const d of DIRS) {
    const next = add(from, d);
    if (!inBounds(s, next)) continue;
    const c = cell(s, next);
    if (c.land) {
      if (standable(s, next)) out.push({ to: next, viaBridge: false });
      continue;
    }
    const along: BridgeDir = d.x !== 0 ? 'H' : 'V';
    const beyond = add(next, d);
    if (c.bridge === along && standable(s, beyond)) out.push({ to: beyond, viaBridge: true });
  }
  return out;
}

export function canTree(s: GameState, at: Pos): boolean {
  return standable(s, at) && inRange(s, at);
}

function isLand(s: GameState, p: Pos): boolean {
  return inBounds(s, p) && cell(s, p).land;
}

/** Orientations in which a bridge may be drawn on gap `at`. */
export function bridgeDirs(s: GameState, at: Pos): BridgeDir[] {
  if (!inBounds(s, at) || !inRange(s, at)) return [];
  const c = cell(s, at);
  if (c.land || c.bridge) return [];
  const dirs: BridgeDir[] = [];
  if (isLand(s, add(at, { x: -1, y: 0 })) && isLand(s, add(at, { x: 1, y: 0 }))) dirs.push('H');
  if (isLand(s, add(at, { x: 0, y: -1 })) && isLand(s, add(at, { x: 0, y: 1 }))) dirs.push('V');
  return dirs;
}

export function canErase(s: GameState, at: Pos): boolean {
  if (!inBounds(s, at) || !inRange(s, at)) return false;
  const c = cell(s, at);
  return c.tree || c.bridge !== null;
}

export function isLegal(s: GameState, a: Action): boolean {
  if (s.over) return false;
  switch (a.type) {
    case 'move':
      return moveTargets(s).some((t) => eq(t.to, a.to));
    case 'tree':
      return canTree(s, a.at);
    case 'bridge':
      return bridgeDirs(s, a.at).includes(a.dir);
    case 'erase':
      return canErase(s, a.at);
    case 'skip':
      return true;
  }
}

export function legalActions(s: GameState): Action[] {
  if (s.over) return [];
  const out: Action[] = moveTargets(s).map((t) => ({ type: 'move', to: t.to }));
  for (const p of allPositions(s)) {
    if (canTree(s, p)) out.push({ type: 'tree', at: p });
    for (const dir of bridgeDirs(s, p)) out.push({ type: 'bridge', at: p, dir });
    if (canErase(s, p)) out.push({ type: 'erase', at: p });
  }
  out.push({ type: 'skip' });
  return out;
}
