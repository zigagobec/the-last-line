import { allPositions, cell, type BridgeDir, type GameState, type PlayerId, type Pos } from '../game';
import { mat4, vec3, type Mat4, type Vec3, type Vec4 } from '../render/math';
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
  /** Stable identity for animations, e.g. `tree:3,4`, `sign:3,4`, `rat0`. */
  key: string;
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
  /** Game seed, for per-cell decoration. */
  seed: number;
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
  const view: SceneView = { size: n, seed: s.seed, tiles: [], bridges: [], sprites: [], time };
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
      if (c.tree) view.sprites.push(treeSprite(n, p, r));
      if (c.marked) view.sprites.push(signSprite(n, p));
    }
    if (c.bridge) view.bridges.push({ x: p.x, y: p.y, dir: c.bridge, ghost: false, tint: NO_TINT, drop: 0 });
  }
  s.players.forEach((pl, id) => {
    if (s.fallen[id]) return;
    view.sprites.push(ratSprite(n, id as PlayerId, pl));
  });
  return view;
}

export function sprite(key: string, name: SpriteName, pos: Vec3, height: number, flip: boolean): SpriteView {
  return { key, name, pos, height, alpha: 1, flip, reveal: 1, tint: NO_TINT };
}

export const posKey = (p: Pos) => `${p.x},${p.y}`;

export function treeSprite(size: number, p: Pos, seed: number): SpriteView {
  return sprite(`tree:${posKey(p)}`, 'tree', tileCenter(size, p), TREE_HEIGHT, seed < 0.5);
}

export function signSprite(size: number, p: Pos): SpriteView {
  const c = tileCenter(size, p);
  return sprite(`sign:${posKey(p)}`, 'sign', [c[0] + 0.28, 0, c[2] - 0.28], SIGN_HEIGHT, false);
}

export function ratSprite(size: number, id: PlayerId, p: Pos): SpriteView {
  return sprite(`rat${id}`, id === 0 ? 'rat0' : 'rat1', tileCenter(size, p), RAT_HEIGHT, id === 1);
}

/** Screen-space (NDC) rectangle of an upright billboard; `shrink` trims transparent margins. */
function spriteRect(sp: SpriteView, aspect: number, vp: Mat4, right: Vec3, up: Vec3, shrink = 1) {
  const w = sp.height * aspect * shrink;
  const project = (p: Vec3) => {
    const c = mat4.transform(vp, [p[0], p[1], p[2], 1]);
    return [c[0] / c[3], c[1] / c[3]];
  };
  const bl = project(vec3.add(sp.pos, vec3.scale(right, -w / 2)));
  const tr = project(vec3.add(vec3.add(sp.pos, vec3.scale(right, w / 2)), vec3.scale(up, sp.height * shrink)));
  return { x0: bl[0], y0: bl[1], x1: tr[0], y1: tr[1] };
}

/** Fade trees that stand between the camera and a rat, so a rat is never lost behind foliage. */
export function fadeOccluders(view: SceneView, vp: Mat4, viewM: Mat4, eye: Vec3, aspects: Partial<Record<SpriteName, number>>): void {
  const right: Vec3 = [viewM[0], viewM[4], viewM[8]];
  const up: Vec3 = [viewM[1], viewM[5], viewM[9]];
  const dist = (p: Vec3) => vec3.dot(vec3.sub(p, eye), vec3.sub(p, eye));
  const rats = view.sprites.filter((sp) => (sp.name === 'rat0' || sp.name === 'rat1') && sp.alpha > 0.2);
  for (const rat of rats) {
    const r = spriteRect(rat, aspects[rat.name] ?? 1, vp, right, up, 0.8);
    for (const tree of view.sprites) {
      if (tree.name !== 'tree' || dist(tree.pos) >= dist(rat.pos)) continue;
      const t = spriteRect(tree, aspects.tree ?? 1, vp, right, up, 0.75);
      const overlap = t.x0 < r.x1 && t.x1 > r.x0 && t.y0 < r.y1 && t.y1 > r.y0;
      if (overlap) tree.alpha = Math.min(tree.alpha, 0.38);
    }
  }
}
