import { describe, expect, it } from 'vitest';
import { createGame } from '../../src/game/setup';
import { defaultRules } from '../../src/game/types';
import { cell, DIRS, add, eq, inBounds, mirror } from '../../src/game/board';

function allPos(size: number) {
  const out = [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) out.push({ x, y });
  return out;
}

describe('createGame', () => {
  it('places players at the default start tiles on 8x8', () => {
    const s = createGame(defaultRules(), 42);
    expect(s.players).toEqual([{ x: 1, y: 3 }, { x: 6, y: 4 }]);
    expect(s.round).toBe(1);
    expect(s.starter).toBe(0);
    expect(s.current).toBe(0);
    expect(s.over).toBe(false);
  });

  it('creates 4 trees and 2 gaps on 8x8', () => {
    const s = createGame(defaultRules(), 42);
    expect(s.cells.filter((c) => c.tree).length).toBe(4);
    expect(s.cells.filter((c) => !c.land).length).toBe(2);
  });

  it('is point-symmetric', () => {
    for (const seed of [1, 2, 3, 42, 999]) {
      const s = createGame(defaultRules(), seed);
      for (const p of allPos(8)) {
        const a = cell(s, p);
        const b = cell(s, mirror(s, p));
        expect([a.land, a.tree]).toEqual([b.land, b.tree]);
      }
    }
  });

  it('keeps start tiles and their neighbours clear, and no gaps on the outer ring', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = createGame(defaultRules(), seed);
      for (const pl of s.players) {
        for (const p of [pl, ...DIRS.map((d) => add(pl, d))]) {
          if (!inBounds(s, p)) continue;
          expect(cell(s, p).land).toBe(true);
          expect(cell(s, p).tree).toBe(false);
        }
      }
      for (const p of allPos(8)) {
        const ring = p.x === 0 || p.y === 0 || p.x === 7 || p.y === 7;
        if (ring) expect(cell(s, p).land).toBe(true);
      }
    }
  });

  it('is deterministic per seed and varies across seeds', () => {
    expect(createGame(defaultRules(), 7)).toEqual(createGame(defaultRules(), 7));
    const layouts = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const s = createGame(defaultRules(), seed);
      layouts.add(s.cells.map((c) => (c.land ? (c.tree ? 'T' : '.') : '#')).join(''));
    }
    expect(layouts.size).toBeGreaterThan(1);
  });

  it('places start tiles correctly on 6x6 and 10x10', () => {
    expect(createGame(defaultRules(6), 1).players).toEqual([{ x: 1, y: 2 }, { x: 4, y: 3 }]);
    expect(createGame(defaultRules(10), 1).players).toEqual([{ x: 1, y: 4 }, { x: 8, y: 5 }]);
  });

  it('mirror maps a cell to its point reflection', () => {
    const s = createGame(defaultRules(), 1);
    expect(eq(mirror(s, { x: 1, y: 3 }), { x: 6, y: 4 })).toBe(true);
  });
});
