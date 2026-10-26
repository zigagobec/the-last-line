import type { SpriteName } from '../view/scene';
import { PLAYER_CSS } from '../view/colors';
import { drawDecal, drawPoof, drawRat } from './draw/sprites';

export interface Frame {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  /** width / height of the drawing. */
  aspect: number;
}

export type DecalName = 'decal0' | 'decal1' | 'decal2' | 'decal3';
export type FrameName = SpriteName | DecalName;
export const DECALS: DecalName[] = ['decal0', 'decal1', 'decal2', 'decal3'];

export interface Atlas {
  texture: GPUTexture;
  frames: Partial<Record<FrameName, Frame>>;
}

export function emptyAtlas(device: GPUDevice): Atlas {
  const texture = device.createTexture({
    size: [1, 1],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
  device.queue.writeTexture({ texture }, new Uint8Array([0, 0, 0, 0]), {}, [1, 1]);
  return { texture, frames: {} };
}

/** Sprites shipped as PNG drawings in public/sprites/; add a name here to override a generated sprite. */
const PNG_SPRITES: FrameName[] = ['tree', 'sign'];
const ATLAS_W = 2048;
const ATLAS_H = 1024;
const PAD = 8;

async function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = url;
  await img.decode();
  return img;
}

/** Crop a canvas to its non-transparent bounds (plus a small margin), keeping the bottom edge as the anchor. */
function trimCanvas(c: HTMLCanvasElement, pad = 3): HTMLCanvasElement {
  const { data, width, height } = c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
    }
  }
  if (x1 < 0) return c;
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(width - 1, x1 + pad);
  y1 = Math.min(height - 1, y1 + pad);
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1;
  out.height = y1 - y0 + 1;
  out.getContext('2d')!.drawImage(c, -x0, -y0);
  return out;
}

function generated(): Map<FrameName, CanvasImageSource & { width: number; height: number }> {
  const m = new Map<FrameName, HTMLCanvasElement>();
  m.set('rat0', trimCanvas(drawRat(PLAYER_CSS[0], 11)));
  m.set('rat1', trimCanvas(drawRat(PLAYER_CSS[1], 23)));
  m.set('poof', trimCanvas(drawPoof(5)));
  DECALS.forEach((name, i) => m.set(name, drawDecal(i, 40 + i)));
  return m;
}

/** Pack every sprite into one mipmapped texture (premultiplied alpha). */
export async function buildAtlas(device: GPUDevice, base = './sprites/'): Promise<Atlas> {
  const sources = generated() as Map<FrameName, CanvasImageSource & { width: number; height: number }>;
  await Promise.all(
    PNG_SPRITES.map(async (name) => {
      try {
        sources.set(name, await loadImage(`${base}${name}.png`));
      } catch {
        console.warn(`sprite ${name}.png missing`);
      }
    }),
  );

  const sheet = document.createElement('canvas');
  sheet.width = ATLAS_W;
  sheet.height = ATLAS_H;
  const ctx = sheet.getContext('2d')!;
  const frames: Atlas['frames'] = {};
  let x = PAD;
  let y = PAD;
  let row = 0;
  const entries = [...sources.entries()].sort((a, b) => b[1].height - a[1].height);
  for (const [name, img] of entries) {
    if (x + img.width + PAD > ATLAS_W) {
      x = PAD;
      y += row + PAD;
      row = 0;
    }
    ctx.drawImage(img, x, y);
    frames[name] = {
      u0: x / ATLAS_W,
      v0: y / ATLAS_H,
      u1: (x + img.width) / ATLAS_W,
      v1: (y + img.height) / ATLAS_H,
      aspect: img.width / img.height,
    };
    x += img.width + PAD;
    row = Math.max(row, img.height);
  }

  const levels = Math.floor(Math.log2(Math.max(ATLAS_W, ATLAS_H))) + 1;
  const texture = device.createTexture({
    size: [ATLAS_W, ATLAS_H],
    format: 'rgba8unorm',
    mipLevelCount: levels,
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  });
  let level: HTMLCanvasElement = sheet;
  for (let l = 0; l < levels; l++) {
    if (l > 0) {
      const next = document.createElement('canvas');
      next.width = Math.max(1, level.width >> 1);
      next.height = Math.max(1, level.height >> 1);
      const nctx = next.getContext('2d')!;
      nctx.imageSmoothingQuality = 'high';
      nctx.drawImage(level, 0, 0, next.width, next.height);
      level = next;
    }
    device.queue.copyExternalImageToTexture(
      { source: level },
      { texture, mipLevel: l, premultipliedAlpha: true },
      [level.width, level.height],
    );
  }
  return { texture, frames };
}
