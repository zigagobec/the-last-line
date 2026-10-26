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

function eyeFrom(target: Vec3, yaw: number, pitch: number, dist: number): Vec3 {
  const cp = Math.cos(pitch);
  return vec3.add(target, [dist * cp * Math.sin(yaw), dist * Math.sin(pitch), dist * cp * Math.cos(yaw)]);
}

function lookFrom(target: Vec3, yaw: number, pitch: number, dist: number): Mat4 {
  return mat4.lookAt(eyeFrom(target, yaw, pitch, dist), target, [0, 1, 0]);
}

/** Free screen area (NDC) the board should fill: the HUD covers the top and bottom strips. */
export interface FitBox {
  left: number;
  right: number;
  bottom: number;
  top: number;
}
export const DEFAULT_FIT: FitBox = { left: -0.95, right: 0.95, bottom: -0.68, top: 0.72 };
/** Heights fitted on screen: tile bottoms and headroom for sprites standing on far tiles. */
export const FIT_HEIGHTS = [0.75, -0.45];
const DEFAULT_PITCH = 0.66;

const portrait = (aspect: number) => aspect < 0.9;

/** Landscape screens get the classic diagonal view; tall phones look along the board so tiles are bigger. */
export function defaultYaw(aspect: number): number {
  return portrait(aspect) ? 0.12 : Math.PI / 4;
}

/** Tall phones have spare height, so they look down more steeply. */
export function defaultPitch(aspect: number): number {
  return portrait(aspect) ? 0.92 : DEFAULT_PITCH;
}

/** Orbit camera around the board centre. Setters move a goal; `update` eases toward it. */
export class OrbitCamera {
  yaw = Math.PI / 4;
  pitch = DEFAULT_PITCH;
  /** Zoom multiplier on top of the fitted base distance. */
  zoomLevel = 1;
  private base: number;
  private goalBase: number;
  /** NDC offset applied after projection, centring the board in the free screen area. */
  private shift: [number, number] = [0, 0];
  private goalShift: [number, number] = [0, 0];
  private fitted = false;
  private fitKey = '';
  private userRotated = false;
  target: Vec3 = [0, -0.225, 0];
  readonly fov = FOV;
  private goal: { yaw: number; pitch: number; zoom: number };

  constructor(private size: number) {
    this.base = size * 2.6;
    this.goalBase = this.base;
    this.goal = { yaw: this.yaw, pitch: this.pitch, zoom: 1 };
  }

  get distance(): number {
    return this.base * this.zoomLevel;
  }

  /** Default view for a board of `size`; the next `fit` picks the yaw for the screen shape. */
  resetFor(size: number): void {
    this.size = size;
    this.goal.zoom = 1;
    this.userRotated = false;
    this.fitKey = '';
    this.fitted = false;
  }

  /**
   * Choose the distance and lens shift that make the whole board fill `box` for this aspect ratio.
   * Computed for the default yaw, so turning the board never changes the zoom.
   */
  fit(aspect: number, box: FitBox = DEFAULT_FIT): void {
    const q = (v: number) => v.toFixed(3);
    const key = `${aspect.toFixed(4)}:${this.size}:${q(box.left)},${q(box.right)},${q(box.bottom)},${q(box.top)}`;
    if (key === this.fitKey) return;
    this.fitKey = key;
    const yaw = defaultYaw(aspect);
    const pitch = defaultPitch(aspect);
    if (!this.userRotated) {
      this.goal.yaw = yaw;
      this.goal.pitch = pitch;
    }
    const h = this.size / 2;
    const corners: Vec3[] = [];
    for (const x of [-h, h]) for (const z of [-h, h]) for (const y of FIT_HEIGHTS) corners.push([x, y, z]);
    const extent = (dist: number) => {
      const view = lookFrom(this.target, yaw, pitch, dist);
      const vp = mat4.multiply(mat4.perspective(this.fov, aspect, 0.5, dist * 3), view);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const c of corners) {
        const p = mat4.transform(vp, [c[0], c[1], c[2], 1]);
        x0 = Math.min(x0, p[0] / p[3]);
        x1 = Math.max(x1, p[0] / p[3]);
        y0 = Math.min(y0, p[1] / p[3]);
        y1 = Math.max(y1, p[1] / p[3]);
      }
      return { x0, x1, y0, y1 };
    };
    let lo = this.size * 0.5;
    let hi = this.size * 12;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      const e = extent(mid);
      const fits = e.x1 - e.x0 <= box.right - box.left && e.y1 - e.y0 <= box.top - box.bottom;
      if (fits) hi = mid;
      else lo = mid;
    }
    const e = extent(hi);
    this.goalBase = hi;
    this.goalShift = [(box.left + box.right) / 2 - (e.x0 + e.x1) / 2, (box.bottom + box.top) / 2 - (e.y0 + e.y1) / 2];
    if (!this.fitted) {
      // First fit for this board: jump straight there; later refits (HUD or window changes) glide.
      this.base = this.goalBase;
      this.shift = [...this.goalShift];
      this.fitted = true;
    }
  }

  orbit(dYaw: number, dPitch: number): void {
    this.userRotated = true;
    this.goal.yaw += dYaw;
    this.goal.pitch = clamp(this.goal.pitch + dPitch, PITCH_MIN, PITCH_MAX);
  }

  zoom(factor: number): void {
    this.goal.zoom = clamp(this.goal.zoom * factor, 0.45, 1.6);
  }

  /** Rotate by a quarter turn, snapping to the diagonal views. */
  snap(dir: 1 | -1): void {
    this.userRotated = true;
    const quarter = Math.PI / 2;
    const base = Math.round((this.goal.yaw - Math.PI / 4) / quarter) * quarter + Math.PI / 4;
    this.goal.yaw = base + dir * quarter;
  }

  update(dt: number): void {
    const k = 1 - Math.exp(-dt * 12);
    this.yaw += (this.goal.yaw - this.yaw) * k;
    this.pitch += (this.goal.pitch - this.pitch) * k;
    this.zoomLevel += (this.goal.zoom - this.zoomLevel) * k;
    this.base += (this.goalBase - this.base) * k;
    this.shift = [this.shift[0] + (this.goalShift[0] - this.shift[0]) * k, this.shift[1] + (this.goalShift[1] - this.shift[1]) * k];
  }

  eye(): Vec3 {
    return eyeFrom(this.target, this.yaw, this.pitch, this.distance);
  }

  view(): Mat4 {
    return mat4.lookAt(this.eye(), this.target, [0, 1, 0]);
  }

  projection(aspect: number): Mat4 {
    const shift = mat4.identity();
    shift[12] = this.shift[0];
    shift[13] = this.shift[1];
    return mat4.multiply(shift, mat4.perspective(this.fov, aspect, 0.5, this.distance * 3));
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
