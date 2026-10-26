import { allPositions, cell, type BridgeDir, type GameState } from '../game';
import type { Vec3, Vec4 } from '../render/math';
import { tileCenter } from '../render/camera';

export const TILE_MARKED = 1;
export const TILE_HIGHLIGHT = 2;
export const TILE_HOVER = 4;
export const TILE_DENIED = 8;

export interface TileView {
  x: number;
  y: number;
  /** Vertical offset (negative = falling). */
  drop: number;
  flags: number;
  tint: Vec4;
  /** Index of the top-face doodle decal, or -1. */
  decal: number;
  seed: number;
}

export interface BridgeView {
  x: number;
  y: number;
  dir: BridgeDir;
  ghost: boolean;
  tint: Vec4;
  drop: number;
}

export type SpriteName = 'tree' | 'sign' | 'rat0' | 'rat1' | 'poof';

export interface SpriteView {
  name: SpriteName;
  /** Bottom-centre anchor in world space. */
  pos: Vec3;
  /** World-space height; width follows the frame's aspect ratio. */
  height: number;
  alpha: number;
  flip: boolean;
  /** 0..1 sketch-in progress (1 = fully drawn). */
  reveal: number;
  tint: Vec4;
}

export interface SceneView {
  size: number;
  tiles: TileView[];
  bridges: BridgeView[];
  sprites: SpriteView[];
  time: number;
}

export const TREE_HEIGHT = 1.3;
export const RAT_HEIGHT = 1.05;
export const SIGN_HEIGHT = 0.62;
export const NO_TINT: Vec4 = [0, 0, 0, 0];

/** Stable pseudo-random per cell, used for decals and jitter. */
export function cellSeed(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Static picture of a game state; the animator layers motion on top. */
export function buildSceneView(s: GameState, time = 0): SceneView {
  const n = s.rules.size;
  const view: SceneView = { size: n, tiles: [], bridges: [], sprites: [], time };
  for (const p of allPositions(s)) {
    const c = cell(s, p);
    const r = cellSeed(p.x, p.y, s.seed);
    if (c.land) {
      view.tiles.push({
        x: p.x,
        y: p.y,
        drop: 0,
        flags: c.marked ? TILE_MARKED : 0,
        tint: NO_TINT,
        decal: r < 0.55 ? Math.floor(r * 7.27) % 4 : -1,
        seed: r,
      });
      const top = tileCenter(n, p);
      if (c.tree) view.sprites.push(sprite('tree', top, TREE_HEIGHT, r < 0.5));
      if (c.marked) view.sprites.push(sprite('sign', [top[0] + 0.28, 0, top[2] - 0.28], SIGN_HEIGHT, false));
    }
    if (c.bridge) view.bridges.push({ x: p.x, y: p.y, dir: c.bridge, ghost: false, tint: NO_TINT, drop: 0 });
  }
  s.players.forEach((pl, id) => {
    if (s.fallen[id]) return;
    view.sprites.push(sprite(id === 0 ? 'rat0' : 'rat1', tileCenter(n, pl), RAT_HEIGHT, id === 1));
  });
  return view;
}

export function sprite(name: SpriteName, pos: Vec3, height: number, flip: boolean): SpriteView {
  return { name, pos, height, alpha: 1, flip, reveal: 1, tint: NO_TINT };
}
