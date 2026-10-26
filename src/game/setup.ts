import { add, cell, DIRS, eq, inBounds, mirror } from './board';
import { Rng } from './rng';
import type { Cell, GameState, Pos, Rules } from './types';

const MAX_TRIES = 500;

export function startPositions(size: number): [Pos, Pos] {
  const p1 = { x: 1, y: Math.floor((size - 1) / 2) };
  return [p1, { x: size - 1 - p1.x, y: size - 1 - p1.y }];
}

export function createGame(rules: Rules, seed: number): GameState {
  const n = rules.size;
  const cells: Cell[] = Array.from({ length: n * n }, () => ({
    land: true,
    tree: false,
    bridge: null,
    marked: false,
  }));
  const rng = new Rng(seed);
  const state: GameState = {
    rules: { ...rules },
    seed,
    rng: 0,
    cells,
    players: startPositions(n),
    fallen: [false, false],
    round: 1,
    starter: 0,
    current: 0,
    acted: 0,
    over: false,
    winner: null,
  };

  const reserved = (p: Pos) =>
    state.players.some((pl) => eq(pl, p) || DIRS.some((d) => eq(add(pl, d), p)));
  const free = (p: Pos) => inBounds(state, p) && cell(state, p).land && !cell(state, p).tree && !reserved(p);

  // Place mirrored pairs; a cell on the centre of symmetry would pair with itself, so skip those.
  const placePairs = (count: number, interiorOnly: boolean, apply: (c: Cell) => void) => {
    let placed = 0;
    for (let i = 0; i < MAX_TRIES && placed < count; i++) {
      const lo = interiorOnly ? 1 : 0;
      const span = interiorOnly ? n - 2 : n;
      const p = { x: lo + rng.int(span), y: lo + rng.int(span) };
      const m = mirror(state, p);
      if (eq(p, m) || !free(p) || !free(m)) continue;
      apply(cell(state, p));
      apply(cell(state, m));
      placed += 2;
    }
  };

  placePairs(rules.gaps, true, (c) => {
    c.land = false;
  });
  placePairs(rules.trees, false, (c) => {
    c.tree = true;
  });

  state.rng = rng.state;
  return state;
}
