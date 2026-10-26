import type { Pos } from '../game';
import { frameAlpha, type Atlas } from '../render/atlas';
import { mat4, vec3, type Mat4, type Vec3 } from '../render/math';
import type { SceneView } from './scene';

export interface PickContext {
  vp: Mat4;
  view: Mat4;
  eye: Vec3;
  atlas: Atlas;
  players: [Pos, Pos];
}

/** Sprites fainter than this are leaving the board in an animation and can't be clicked. */
const MIN_ALPHA = 0.2;

/**
 * The board object drawn under an NDC point: trees, signs and rats stand up from their
 * tiles and hide what is behind them, so a click on one means its own tile.
 * `skip` lets the caller look through sprites that can't be the intended target.
 */
export function pickSprite(
  view: SceneView,
  ndc: [number, number],
  ctx: PickContext,
  skip: (key: string) => boolean = () => false,
): { key: string; p: Pos } | null {
  const right: Vec3 = [ctx.view[0], ctx.view[4], ctx.view[8]];
  const up: Vec3 = [ctx.view[1], ctx.view[5], ctx.view[9]];
  const project = (p: Vec3) => {
    const c = mat4.transform(ctx.vp, [p[0], p[1], p[2], 1]);
    return [c[0] / c[3], c[1] / c[3]];
  };
  const dist = (p: Vec3) => vec3.dot(vec3.sub(p, ctx.eye), vec3.sub(p, ctx.eye));
  const candidates = view.sprites
    .filter((sp) => /^(tree|sign):|^rat[01]$/.test(sp.key) && sp.alpha > MIN_ALPHA && !skip(sp.key))
    .sort((a, b) => dist(a.pos) - dist(b.pos));
  for (const sp of candidates) {
    const frame = ctx.atlas.frames[sp.name];
    if (!frame) continue;
    const w = sp.height * frame.aspect;
    const bl = project(vec3.add(sp.pos, vec3.scale(right, -w / 2)));
    const tr = project(vec3.add(vec3.add(sp.pos, vec3.scale(right, w / 2)), vec3.scale(up, sp.height)));
    if (ndc[0] < bl[0] || ndc[0] > tr[0] || ndc[1] < bl[1] || ndc[1] > tr[1]) continue;
    let u = (ndc[0] - bl[0]) / (tr[0] - bl[0]);
    if (sp.flip) u = 1 - u;
    const v = (tr[1] - ndc[1]) / (tr[1] - bl[1]);
    if (frameAlpha(ctx.atlas, frame, u, v) < 0.3) continue;
    const m = /^(?:tree|sign):(\d+),(\d+)$/.exec(sp.key);
    const p = m ? { x: Number(m[1]), y: Number(m[2]) } : ctx.players[sp.key === 'rat0' ? 0 : 1];
    return { key: sp.key, p };
  }
  return null;
}
