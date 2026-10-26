import type { Cell, GameState, PlayerId, Pos } from './types';

type Sized = { rules: { size: number } };

export const DIRS: readonly Pos[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

export function idx(s: Sized, p: Pos): number {
  return p.y * s.rules.size + p.x;
}

export function inBounds(s: Sized, p: Pos): boolean {
  const n = s.rules.size;
  return p.x >= 0 && p.y >= 0 && p.x < n && p.y < n;
}

export function cell(s: Sized & { cells: Cell[] }, p: Pos): Cell {
  return s.cells[idx(s, p)];
}

export function add(a: Pos, b: Pos): Pos {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function eq(a: Pos, b: Pos): boolean {
  return a.x === b.x && a.y === b.y;
}

export function manhattan(a: Pos, b: Pos): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function other(p: PlayerId): PlayerId {
  return p === 0 ? 1 : 0;
}

/** Point reflection through the board centre. */
export function mirror(s: Sized, p: Pos): Pos {
  const n = s.rules.size;
  return { x: n - 1 - p.x, y: n - 1 - p.y };
}

export function allPositions(s: Sized): Pos[] {
  const out: Pos[] = [];
  for (let y = 0; y < s.rules.size; y++) for (let x = 0; x < s.rules.size; x++) out.push({ x, y });
  return out;
}

/** Player standing on p, or null. Fallen players stand nowhere. */
export function playerAt(s: GameState, p: Pos): PlayerId | null {
  for (const id of [0, 1] as const) {
    if (!s.fallen[id] && eq(s.players[id], p)) return id;
  }
  return null;
}

export function cloneState(s: GameState): GameState {
  return {
    ...s,
    rules: { ...s.rules },
    cells: s.cells.map((c) => ({ ...c })),
    players: [{ ...s.players[0] }, { ...s.players[1] }],
    fallen: [s.fallen[0], s.fallen[1]],
  };
}
