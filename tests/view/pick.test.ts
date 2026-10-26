import { describe, expect, it } from 'vitest';
import { pickSprite } from '../../src/view/pick';
import { sprite, type SceneView } from '../../src/view/scene';
import { mat4 } from '../../src/render/math';
import type { Atlas } from '../../src/render/atlas';

const eye: [number, number, number] = [0, 3, 10];
const viewM = mat4.lookAt(eye, [0, 0, 0], [0, 1, 0]);
const vp = mat4.multiply(mat4.perspective(0.6, 1.5, 0.5, 50), viewM);
const atlas = { frames: { tree: { u0: 0, v0: 0, u1: 1, v1: 1, aspect: 1 }, rat0: { u0: 0, v0: 0, u1: 1, v1: 1, aspect: 0.8 } } } as unknown as Atlas;
const project = (p: [number, number, number]): [number, number] => {
  const c = mat4.transform(vp, [p[0], p[1], p[2], 1]);
  return [c[0] / c[3], c[1] / c[3]];
};
const scene = (): SceneView => ({ size: 8, seed: 1, tiles: [], bridges: [], time: 0, sprites: [] });
const players: [{ x: number; y: number }, { x: number; y: number }] = [{ x: 0, y: 0 }, { x: 7, y: 7 }];

describe('pickSprite', () => {
  it('still hits a tree drawn half-transparent by the hover highlight', () => {
    const v = scene();
    const tree = sprite('tree:3,4', 'tree', [0, 0, 0], 1.3, false);
    tree.alpha = 0.5;
    v.sprites.push(tree);
    const hit = pickSprite(v, project([0, 0.6, 0]), { vp, view: viewM, eye, atlas, players });
    expect(hit).toEqual({ key: 'tree:3,4', p: { x: 3, y: 4 } });
  });

  it('ignores sprites that are fading out in an animation', () => {
    const v = scene();
    const tree = sprite('tree:3,4', 'tree', [0, 0, 0], 1.3, false);
    tree.alpha = 0.1;
    v.sprites.push(tree);
    expect(pickSprite(v, project([0, 0.6, 0]), { vp, view: viewM, eye, atlas, players })).toBeNull();
  });

  it('returns the nearest sprite and honours the skip filter', () => {
    const v = scene();
    v.sprites.push(sprite('rat0', 'rat0', [0, 0, -1], 1, false), sprite('tree:2,2', 'tree', [0, 0, 1], 1.3, false));
    const at = project([0, 0.5, 0]);
    expect(pickSprite(v, at, { vp, view: viewM, eye, atlas, players })?.key).toBe('tree:2,2');
    const skipTrees = pickSprite(v, at, { vp, view: viewM, eye, atlas, players }, (k) => k.startsWith('tree:'));
    expect(skipTrees).toEqual({ key: 'rat0', p: { x: 0, y: 0 } });
  });
});
