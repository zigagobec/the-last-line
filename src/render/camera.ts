import type { Pos } from '../game';
import { mat4, vec3, type Mat4, type Vec3 } from './math';

const PITCH_MIN = 0.3;
const PITCH_MAX = 1.45;
const FOV = (32 * Math.PI) / 180;

/** World position of a tile's top-face centre: tiles are 1×1, tops at y = 0, board centred on the origin. */
export function tileCenter(size: number, p: Pos): Vec3 {
  const c = (size - 1) / 2;
  return [p.x - c, 0, p.y - c];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Orbit camera around the board centre. Setters move a goal; `update` eases toward it. */
export class OrbitCamera {
  yaw = Math.PI / 4;
  pitch = 0.66;
  /** Zoom multiplier on top of the aspect-fitted base distance. */
  zoomLevel = 1;
  private base: number;
  target: Vec3 = [0, -0.9, 0.2];
  readonly fov = FOV;
  private goal: { yaw: number; pitch: number; zoom: number };

  constructor(private size: number) {
    this.base = size * 2.6;
    this.goal = { yaw: this.yaw, pitch: this.pitch, zoom: 1 };
  }

  /** Default view for a board of `size`, keeping the current yaw so a rematch doesn't spin the board. */
  resetFor(size: number): void {
    this.size = size;
    this.goal.pitch = 0.66;
    this.goal.zoom = 1;
  }

  get distance(): number {
    return this.base * this.zoomLevel;
  }

  /** Fit the whole board on screen for the given aspect ratio (portrait screens need more distance). */
  fit(aspect: number): void {
    this.base = this.size * Math.max(2.3, 2.5 / aspect);
  }

  orbit(dYaw: number, dPitch: number): void {
    this.goal.yaw += dYaw;
    this.goal.pitch = clamp(this.goal.pitch + dPitch, PITCH_MIN, PITCH_MAX);
  }

  zoom(factor: number): void {
    this.goal.zoom = clamp(this.goal.zoom * factor, 0.45, 1.6);
  }

  /** Rotate by a quarter turn, snapping to the diagonal views. */
  snap(dir: 1 | -1): void {
    const quarter = Math.PI / 2;
    const base = Math.round((this.goal.yaw - Math.PI / 4) / quarter) * quarter + Math.PI / 4;
    this.goal.yaw = base + dir * quarter;
  }

  update(dt: number): void {
    const k = 1 - Math.exp(-dt * 12);
    this.yaw += (this.goal.yaw - this.yaw) * k;
    this.pitch += (this.goal.pitch - this.pitch) * k;
    this.zoomLevel += (this.goal.zoom - this.zoomLevel) * k;
  }

  eye(): Vec3 {
    const cp = Math.cos(this.pitch);
    return vec3.add(this.target, [
      this.distance * cp * Math.sin(this.yaw),
      this.distance * Math.sin(this.pitch),
      this.distance * cp * Math.cos(this.yaw),
    ]);
  }

  view(): Mat4 {
    return mat4.lookAt(this.eye(), this.target, [0, 1, 0]);
  }

  projection(aspect: number): Mat4 {
    return mat4.perspective(this.fov, aspect, 0.5, this.distance * 3);
  }

  viewProj(aspect: number): Mat4 {
    return mat4.multiply(this.projection(aspect), this.view());
  }

  /** World-space ray through normalised device coordinates. */
  ray(ndcX: number, ndcY: number, aspect: number): { o: Vec3; d: Vec3 } {
    const inv = mat4.invert(this.viewProj(aspect))!;
    const unproject = (z: number): Vec3 => {
      const v = mat4.transform(inv, [ndcX, ndcY, z, 1]);
      return [v[0] / v[3], v[1] / v[3], v[2] / v[3]];
    };
    const a = unproject(0);
    const b = unproject(1);
    return { o: a, d: vec3.normalize(vec3.sub(b, a)) };
  }
}

/** Tile under the given NDC point, intersecting the tile-top plane y = 0. */
export function pickTile(cam: OrbitCamera, ndcX: number, ndcY: number, aspect: number, size: number): Pos | null {
  const { o, d } = cam.ray(ndcX, ndcY, aspect);
  if (d[1] >= -1e-6) return null;
  const t = -o[1] / d[1];
  const hx = o[0] + d[0] * t + size / 2;
  const hz = o[2] + d[2] * t + size / 2;
  const x = Math.floor(hx);
  const y = Math.floor(hz);
  if (x < 0 || y < 0 || x >= size || y >= size) return null;
  return { x, y };
}
