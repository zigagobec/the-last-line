import { describe, expect, it } from 'vitest';
import { edgeTiles, resolveErosion, selectMarks } from '../../src/game/erosion';
import { cell } from '../../src/game/board';
import { Rng } from '../../src/game/rng';
import { makeState, P, sortPos } from './helpers';

const full8 = () => makeState(Array.from({ length: 8 }, (_, y) => (y === 3 ? '.1......' : y === 4 ? '......2.' : '........')));

describe('edgeTiles', () => {
  it('returns the 28 ring cells of a full 8x8 board', () => {
    const e = edgeTiles(full8());
    expect(e.length).toBe(28);
    expect(e.every((p) => p.x === 0 || p.y === 0 || p.x === 7 || p.y === 7)).toBe(true);
  });

  it('ignores neighbours of interior holes not connected to the outside', () => {
    const s = makeState(['1....', '.....', '..#..', '.....', '....2']);
    expect(edgeTiles(s).length).toBe(16);
  });

  it('treats holes connected to the outside through gaps as outside', () => {
    const s = makeState(['1.#..', '..#..', '.....', '.....', '....2']);
    const e = sortPos(edgeTiles(s));
    // ring (16) minus the gap at (2,0) = 15, plus (1,1),(3,1),(2,2) next to the inner gap
    expect(e).toContainEqual(P(1, 1));
    expect(e).toContainEqual(P(3, 1));
    expect(e).toContainEqual(P(2, 2));
    expect(e.length).toBe(18);
  });

  it('treats bridged gaps as outside too', () => {
    const s = makeState(['1.-..', '..|..', '.....', '.....', '....2']);
    expect(edgeTiles(s)).toContainEqual(P(2, 2));
  });

  it('includes tree tiles and player tiles', () => {
    const s = makeState(['1T.', '...', '..2']);
    const e = edgeTiles(s);
    expect(e).toContainEqual(P(0, 0));
    expect(e).toContainEqual(P(1, 0));
  });
});

describe('selectMarks', () => {
  it('picks 2 edge + 1 random distinct land tiles with default rules', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const s = full8();
      const marks = selectMarks(s, new Rng(seed));
      expect(marks.length).toBe(3);
      const keys = new Set(marks.map((p) => `${p.x},${p.y}`));
      expect(keys.size).toBe(3);
      const ring = marks.filter((p) => p.x === 0 || p.y === 0 || p.x === 7 || p.y === 7);
      expect(ring.length).toBeGreaterThanOrEqual(2);
      expect(marks.every((p) => cell(s, p).land)).toBe(true);
    }
  });

  it('returns what exists when there are too few candidates', () => {
    const s = makeState(['1#', '#2']);
    const marks = selectMarks(s, new Rng(3));
    expect(sortPos(marks)).toEqual([P(0, 0), P(1, 1)]);
  });

  it('respects custom counts', () => {
    const rows = Array.from({ length: 8 }, (_, y) => (y === 0 ? '1.......' : y === 7 ? '.......2' : '........'));
    expect(selectMarks(makeState(rows, { edgeErosion: 0, randomErosion: 2 }), new Rng(9)).length).toBe(2);
    expect(selectMarks(makeState(rows, { edgeErosion: 4, randomErosion: 0 }), new Rng(9)).length).toBe(4);
  });

  it('can mark trees and player tiles', () => {
    const s = makeState(['1T', 'T2']);
    expect(selectMarks(s, new Rng(1)).length).toBe(3);
  });
});

describe('resolveErosion', () => {
  it('turns marked land into a gap and clears marks', () => {
    const s = makeState(['1!.', '...', '..2']);
    const r = resolveErosion(s);
    expect(r.removed).toEqual([P(1, 0)]);
    expect(cell(s, P(1, 0)).land).toBe(false);
    expect(s.cells.some((c) => c.marked)).toBe(false);
  });

  it('destroys a marked tree but keeps the land', () => {
    const s = makeState(['1M.', '...', '..2']);
    const r = resolveErosion(s);
    expect(r.treesDestroyed).toEqual([P(1, 0)]);
    expect(r.removed).toEqual([]);
    expect(cell(s, P(1, 0))).toMatchObject({ land: true, tree: false, marked: false });
  });

  it('drops a player standing on a removed tile', () => {
    const s = makeState(['A..', '...', '..2']);
    const r = resolveErosion(s);
    expect(r.fell).toEqual([0]);
    expect(s.fallen).toEqual([true, false]);
  });

  it('collapses a bridge whose endpoint vanished', () => {
    const s = makeState(['1-!', '...', '..2']);
    const r = resolveErosion(s);
    expect(r.bridgesCollapsed).toEqual([P(1, 0)]);
    expect(cell(s, P(1, 0)).bridge).toBeNull();
  });

  it('keeps bridges whose endpoints survive', () => {
    const s = makeState(['1-.', '...', '.!2']);
    resolveErosion(s);
    expect(cell(s, P(1, 0)).bridge).toBe('H');
  });
});
