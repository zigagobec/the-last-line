import { describe, expect, it } from 'vitest';
import { mat4, vec3 } from '../../src/render/math';
import { OrbitCamera, pickTile, tileCenter } from '../../src/render/camera';

describe('mat4', () => {
  it('invert(m) * m is identity', () => {
    const m = mat4.multiply(mat4.perspective(0.7, 1.5, 0.1, 100), mat4.lookAt([3, 5, 7], [0, 0, 0], [0, 1, 0]));
    const id = mat4.multiply(mat4.invert(m)!, m);
    const expected = mat4.identity();
    for (let i = 0; i < 16; i++) expect(id[i]).toBeCloseTo(expected[i], 4);
  });

  it('perspective maps near/far to WebGPU depth 0..1', () => {
    const p = mat4.perspective(1, 1, 1, 10);
    const near = mat4.transform(p, [0, 0, -1, 1]);
    const far = mat4.transform(p, [0, 0, -10, 1]);
    expect(near[2] / near[3]).toBeCloseTo(0, 5);
    expect(far[2] / far[3]).toBeCloseTo(1, 5);
  });

  it('vec3 helpers', () => {
    expect(vec3.normalize([3, 0, 4])).toEqual([0.6, 0, 0.8]);
    expect(vec3.cross([1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1]);
  });
});

describe('camera picking', () => {
  it('maps the screen centre to a centre tile of an 8x8 board', () => {
    const cam = new OrbitCamera(8);
    const p = pickTile(cam, 0, 0, 16 / 9, 8);
    expect(p).not.toBeNull();
    expect([3, 4]).toContain(p!.x);
    expect([3, 4]).toContain(p!.y);
  });

  it('returns null when the ray misses the board', () => {
    const cam = new OrbitCamera(8);
    expect(pickTile(cam, 0, 0.999, 16 / 9, 8)).toBeNull();
  });

  it('round-trips a tile centre through projection and picking', () => {
    const cam = new OrbitCamera(8);
    for (const [x, y] of [[0, 0], [7, 0], [2, 5], [7, 7]]) {
      const c = tileCenter(8, { x, y });
      const clip = mat4.transform(cam.viewProj(1.5), [c[0], 0, c[2], 1]);
      const p = pickTile(cam, clip[0] / clip[3], clip[1] / clip[3], 1.5, 8);
      expect(p).toEqual({ x, y });
    }
  });

  it('keeps the pitch within limits', () => {
    const cam = new OrbitCamera(8);
    cam.orbit(0, 100);
    cam.update(10);
    expect(cam.pitch).toBeLessThanOrEqual(1.45);
    cam.orbit(0, -100);
    cam.update(10);
    expect(cam.pitch).toBeGreaterThanOrEqual(0.3);
  });
});
