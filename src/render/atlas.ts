import type { SpriteName } from '../view/scene';

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
