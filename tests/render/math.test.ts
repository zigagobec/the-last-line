import { describe, expect, it } from 'vitest';
import { mat4, vec3 } from '../../src/render/math';
import { FIT_HEIGHTS, OrbitCamera, pickTile, tileCenter } from '../../src/render/camera';

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
  it('maps the screen centre onto the middle of an 8x8 board', () => {
    // The camera aims slightly below the board centre so the HUD toolbar doesn't cover it.
    const cam = new OrbitCamera(8);
    const p = pickTile(cam, 0, 0, 16 / 9, 8);
    expect(p).not.toBeNull();
    expect(p!.x).toBeGreaterThanOrEqual(2);
    expect(p!.x).toBeLessThanOrEqual(5);
    expect(p!.y).toBeGreaterThanOrEqual(2);
    expect(p!.y).toBeLessThanOrEqual(5);
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

describe('camera fit', () => {
  const corners = (size: number) => {
    const h = size / 2;
    const out: [number, number, number][] = [];
    for (const x of [-h, h]) for (const z of [-h, h]) for (const y of FIT_HEIGHTS) out.push([x, y, z]);
    return out;
  };
  const box = { left: -0.95, right: 0.95, bottom: -0.68, top: 0.72 };
  for (const aspect of [0.46, 0.75, 1, 1.6, 2.2]) {
    it(`fits the whole board snugly inside the free screen area at aspect ${aspect}`, () => {
      const cam = new OrbitCamera(8);
      cam.fit(aspect, box);
      cam.update(10);
      const vp = cam.viewProj(aspect);
      let maxX = 0;
      let maxY = 0;
      for (const c of corners(8)) {
        const p = mat4.transform(vp, [c[0], c[1], c[2], 1]);
        const x = p[0] / p[3];
        const y = p[1] / p[3];
        expect(x).toBeGreaterThanOrEqual(box.left - 1e-3);
        expect(x).toBeLessThanOrEqual(box.right + 1e-3);
        expect(y).toBeGreaterThanOrEqual(box.bottom - 1e-3);
        expect(y).toBeLessThanOrEqual(box.top + 1e-3);
        maxX = Math.max(maxX, Math.abs(x) / box.right);
        maxY = Math.max(maxY, y > 0 ? y / box.top : y / box.bottom);
      }
      // snug: the board touches the box on at least one axis
      expect(Math.max(maxX, maxY)).toBeGreaterThan(0.9);
    });
  }
});
