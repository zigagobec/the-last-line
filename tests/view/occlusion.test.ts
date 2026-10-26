import { describe, expect, it } from 'vitest';
import { fadeOccluders, sprite, type SceneView } from '../../src/view/scene';
import { mat4 } from '../../src/render/math';

const view = (): SceneView => ({ size: 8, seed: 1, tiles: [], bridges: [], time: 0, sprites: [] });
const eye: [number, number, number] = [0, 3, 10];
const vp = mat4.multiply(mat4.perspective(0.6, 1.5, 0.5, 50), mat4.lookAt(eye, [0, 0, 0], [0, 1, 0]));
const viewM = mat4.lookAt(eye, [0, 0, 0], [0, 1, 0]);
const aspects = { tree: 1, rat0: 0.8, rat1: 0.8, sign: 0.8, poof: 1 };

describe('fadeOccluders', () => {
  it('fades a tree standing between the camera and a rat', () => {
    const v = view();
    v.sprites.push(sprite('rat0', 'rat0', [0, 0, 0], 1, false), sprite('tree:0,1', 'tree', [0, 0, 1], 1.3, false));
    fadeOccluders(v, vp, viewM, eye, aspects);
    expect(v.sprites[1].alpha).toBeLessThan(0.6);
    expect(v.sprites[0].alpha).toBe(1);
  });

  it('leaves trees beside or behind the rat alone', () => {
    const v = view();
    v.sprites.push(
      sprite('rat0', 'rat0', [0, 0, 0], 1, false),
      sprite('tree:5,0', 'tree', [5, 0, 0], 1.3, false),
      sprite('tree:0,-2', 'tree', [0, 0, -2], 1.3, false),
    );
    fadeOccluders(v, vp, viewM, eye, aspects);
    expect(v.sprites[1].alpha).toBe(1);
    expect(v.sprites[2].alpha).toBe(1);
  });
});
