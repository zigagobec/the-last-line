import { add, allPositions, cell, DIRS, idx, inBounds, playerAt } from './board';
import type { Rng } from './rng';
import type { GameState, PlayerId, Pos } from './types';

/**
 * Land tiles 4-adjacent to the outside. The outside is everything beyond the
 * board plus every non-land cell (gap or bridge) reachable from there through
 * non-land cells, so the board erodes from the outside in.
 */
export function edgeTiles(s: GameState): Pos[] {
  const n = s.rules.size;
  const outside = new Uint8Array(n * n);
  const stack: Pos[] = [];
  const visit = (p: Pos) => {
    if (!inBounds(s, p) || cell(s, p).land || outside[idx(s, p)]) return;
    outside[idx(s, p)] = 1;
    stack.push(p);
  };
  for (let i = 0; i < n; i++) {
    visit({ x: i, y: 0 });
    visit({ x: i, y: n - 1 });
    visit({ x: 0, y: i });
    visit({ x: n - 1, y: i });
  }
  while (stack.length) {
    const p = stack.pop()!;
    for (const d of DIRS) visit(add(p, d));
  }
  return allPositions(s).filter(
    (p) =>
      cell(s, p).land &&
      DIRS.some((d) => {
        const q = add(p, d);
        return !inBounds(s, q) || outside[idx(s, q)] === 1;
      }),
  );
}

function takeRandom(candidates: Pos[], count: number, rng: Rng): Pos[] {
  const pool = [...candidates];
  const out: Pos[] = [];
  while (out.length < count && pool.length) out.push(pool.splice(rng.int(pool.length), 1)[0]);
  return out;
}

/** Choose this round's eroding tiles: `edgeErosion` edge tiles, then `randomErosion` from any remaining land. */
export function selectMarks(s: GameState, rng: Rng): Pos[] {
  const key = (p: Pos) => idx(s, p);
  const edge = takeRandom(edgeTiles(s), s.rules.edgeErosion, rng);
  const taken = new Set(edge.map(key));
  const rest = allPositions(s).filter((p) => cell(s, p).land && !taken.has(key(p)));
  // Too few edge tiles: top the edge quota up from the remaining land so the total stays the same.
  const missing = s.rules.edgeErosion - edge.length;
  return [...edge, ...takeRandom(rest, s.rules.randomErosion + missing, rng)];
}

export interface ErosionResult {
  removed: Pos[];
  treesDestroyed: Pos[];
  bridgesCollapsed: Pos[];
  fell: PlayerId[];
}

/** Apply all marks to `s` in place (callers pass a clone). */
export function resolveErosion(s: GameState): ErosionResult {
  const r: ErosionResult = { removed: [], treesDestroyed: [], bridgesCollapsed: [], fell: [] };
  for (const p of allPositions(s)) {
    const c = cell(s, p);
    if (!c.marked) continue;
    c.marked = false;
    if (c.tree) {
      c.tree = false;
      r.treesDestroyed.push(p);
      continue;
    }
    const who = playerAt(s, p);
    c.land = false;
    r.removed.push(p);
    if (who !== null) r.fell.push(who);
  }
  for (const id of r.fell) s.fallen[id] = true;
  for (const p of allPositions(s)) {
    const c = cell(s, p);
    if (!c.bridge) continue;
    const d = c.bridge === 'H' ? { x: 1, y: 0 } : { x: 0, y: 1 };
    const a = add(p, d);
    const b = { x: p.x - d.x, y: p.y - d.y };
    if (!cell(s, a).land || !cell(s, b).land) {
      c.bridge = null;
      r.bridgesCollapsed.push(p);
    }
  }
  return r;
}
