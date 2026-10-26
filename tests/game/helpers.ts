import type { Cell, GameState, PlayerId, Pos, Rules } from '../../src/game/types';
import { defaultRules } from '../../src/game/types';

/**
 * Build a square state from ASCII rows (row index = y):
 * `.` land, `#` gap, `T` tree, `-`/`|` bridge H/V, `!` marked land,
 * `1`/`2` players, `A`/`B` players standing on marked land, `M` marked tree.
 */
export function makeState(rows: string[], opts: Partial<Rules> & { current?: PlayerId } = {}): GameState {
  const size = rows.length;
  const rules: Rules = { ...defaultRules(size), ...opts };
  const cells: Cell[] = [];
  const players: Pos[] = [
    { x: -1, y: -1 },
    { x: -1, y: -1 },
  ];
  rows.forEach((row, y) => {
    if (row.length !== size) throw new Error(`row ${y} has length ${row.length}, expected ${size}`);
    [...row].forEach((ch, x) => {
      const c: Cell = { land: true, tree: false, bridge: null, marked: false };
      switch (ch) {
        case '#': c.land = false; break;
        case 'T': c.tree = true; break;
        case 'M': c.tree = true; c.marked = true; break;
        case '-': c.land = false; c.bridge = 'H'; break;
        case '|': c.land = false; c.bridge = 'V'; break;
        case '!': c.marked = true; break;
        case '1': players[0] = { x, y }; break;
        case '2': players[1] = { x, y }; break;
        case 'A': players[0] = { x, y }; c.marked = true; break;
        case 'B': players[1] = { x, y }; c.marked = true; break;
        case '.': break;
        default: throw new Error(`unknown cell '${ch}'`);
      }
      cells.push(c);
    });
  });
  const current = opts.current ?? 0;
  return {
    rules,
    seed: 1,
    rng: 12345,
    cells,
    players: [players[0], players[1]],
    fallen: [false, false],
    round: 1,
    starter: 0,
    current,
    acted: 0,
    over: false,
    winner: null,
  };
}

export const P = (x: number, y: number): Pos => ({ x, y });

export const sortPos = (ps: Pos[]) => [...ps].sort((a, b) => a.y - b.y || a.x - b.x);
