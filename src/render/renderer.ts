import { DECALS, type Atlas } from './atlas';
import type { OrbitCamera } from './camera';
import { tileCenter } from './camera';
import type { Gpu } from './gpu';
import { boxMesh } from './meshes';
import commonSrc from './shaders/common.wgsl?raw';
import compositeSrc from './shaders/composite.wgsl?raw';
import sceneSrc from './shaders/scene.wgsl?raw';
import spriteSrc from './shaders/sprite.wgsl?raw';
import type { SceneView } from '../view/scene';

export const TILE_HEIGHT = 0.45;
const BRIDGE_LEN = 1.8;
const BRIDGE_WIDTH = 0.44;
const BRIDGE_THICK = 0.07;
const GLOBALS_SIZE = 128;
const TILE_FLOATS = 16;
const SPRITE_FLOATS = 20;
const NID_FORMAT: GPUTextureFormat = 'rgba16float';
const ALBEDO_FORMAT: GPUTextureFormat = 'rgba8unorm';
const DEPTH_FORMAT: GPUTextureFormat = 'depth24plus';
export const F_GHOST = 16;

interface Targets {
  width: number;
  height: number;
  albedo: GPUTexture;
  nid: GPUTexture;
  depth: GPUTexture;
  compositeBind: GPUBindGroup;
}

const DIRS4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export class Renderer {
  private targets: Targets | null = null;
  private tileBuf: GPUBuffer;
  private tileCap = 0;
  private spriteBuf: GPUBuffer;
  private spriteCap = 0;
  private readonly globals: GPUBuffer;
  private readonly sceneBind: GPUBindGroup;
  private readonly spriteBind: GPUBindGroup;
  private readonly vbuf: GPUBuffer;
  private readonly ibuf: GPUBuffer;
  private readonly indexCount: number;
  dpr = 1;

  private constructor(
    private readonly gpu: Gpu,
    readonly atlas: Atlas,
    private readonly scenePipe: GPURenderPipeline,
    private readonly compositePipe: GPURenderPipeline,
    private readonly spritePipe: GPURenderPipeline,
  ) {
    const { device } = gpu;
    const mesh = boxMesh();
    this.vbuf = device.createBuffer({ size: mesh.vertices.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(this.vbuf, 0, mesh.vertices);
    this.ibuf = device.createBuffer({ size: mesh.indices.byteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(this.ibuf, 0, mesh.indices);
    this.indexCount = mesh.indices.length;

    this.globals = device.createBuffer({ size: GLOBALS_SIZE, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const decalBuf = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const rects = new Float32Array(16);
    DECALS.forEach((name, i) => {
      const f = atlas.frames[name];
      if (f) rects.set([f.u0, f.v0, f.u1, f.v1], i * 4);
    });
    device.queue.writeBuffer(decalBuf, 0, rects);

    const sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear' });
    const atlasView = atlas.texture.createView();
    this.sceneBind = device.createBindGroup({
      layout: scenePipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.globals } },
        { binding: 1, resource: atlasView },
        { binding: 2, resource: sampler },
        { binding: 3, resource: { buffer: decalBuf } },
      ],
    });
    this.spriteBind = device.createBindGroup({
      layout: spritePipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.globals } },
        { binding: 1, resource: atlasView },
        { binding: 2, resource: sampler },
      ],
    });
    this.tileBuf = this.ensureBuffer(null, 0, 256, TILE_FLOATS).buf;
    this.tileCap = 256;
    this.spriteBuf = this.ensureBuffer(null, 0, 128, SPRITE_FLOATS).buf;
    this.spriteCap = 128;
  }

  static async create(gpu: Gpu, atlas: Atlas): Promise<Renderer> {
    const { device, format } = gpu;
    const module = (code: string, label: string) => {
      const m = device.createShaderModule({ code: commonSrc + '\n' + code, label });
      m.getCompilationInfo().then((info) => {
        for (const msg of info.messages) if (msg.type === 'error') console.error(`WGSL ${label}:${msg.lineNum}:${msg.linePos} ${msg.message}`);
      });
      return m;
    };
    const sceneMod = module(sceneSrc, 'scene');
    const compMod = module(compositeSrc, 'composite');
    const spriteMod = module(spriteSrc, 'sprite');

    const f4 = (loc: number, offset: number): GPUVertexAttribute => ({ shaderLocation: loc, offset, format: 'float32x4' });
    const scenePipe = await device.createRenderPipelineAsync({
      label: 'scene',
      layout: 'auto',
      vertex: {
        module: sceneMod,
        entryPoint: 'vs',
        buffers: [
          {
            arrayStride: 24,
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x3' },
              { shaderLocation: 1, offset: 12, format: 'float32x3' },
            ],
          },
          { arrayStride: TILE_FLOATS * 4, stepMode: 'instance', attributes: [f4(2, 0), f4(3, 16), f4(4, 32), f4(5, 48)] },
        ],
      },
      fragment: { module: sceneMod, entryPoint: 'fs', targets: [{ format: ALBEDO_FORMAT }, { format: NID_FORMAT }] },
      primitive: { topology: 'triangle-list', cullMode: 'back', frontFace: 'ccw' },
      depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: true, depthCompare: 'less' },
    });
    const compositePipe = await device.createRenderPipelineAsync({
      label: 'composite',
      layout: 'auto',
      vertex: { module: compMod, entryPoint: 'vs' },
      fragment: { module: compMod, entryPoint: 'fs', targets: [{ format }] },
      primitive: { topology: 'triangle-list' },
    });
    const spritePipe = await device.createRenderPipelineAsync({
      label: 'sprite',
      layout: 'auto',
      vertex: {
        module: spriteMod,
        entryPoint: 'vs',
        buffers: [
          {
            arrayStride: SPRITE_FLOATS * 4,
            stepMode: 'instance',
            attributes: [f4(0, 0), f4(1, 16), f4(2, 32), f4(3, 48), f4(4, 64)],
          },
        ],
      },
      fragment: {
        module: spriteMod,
        entryPoint: 'fs',
        targets: [
          {
            format,
            blend: {
              color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
              alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            },
          },
        ],
      },
      primitive: { topology: 'triangle-strip' },
      depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: false, depthCompare: 'less' },
    });
    return new Renderer(gpu, atlas, scenePipe, compositePipe, spritePipe);
  }

  private ensureBuffer(buf: GPUBuffer | null, cap: number, needed: number, floats: number): { buf: GPUBuffer; cap: number } {
    if (buf && needed <= cap) return { buf, cap };
    buf?.destroy();
    const newCap = Math.max(needed, cap * 2, 16);
    return {
      buf: this.gpu.device.createBuffer({ size: newCap * floats * 4, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST }),
      cap: newCap,
    };
  }

  /** Match the drawing buffer to the canvas' CSS size; recreates targets when it changed. */
  resize(): void {
    const { canvas, device } = this.gpu;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const max = device.limits.maxTextureDimension2D;
    const w = Math.min(max, Math.max(1, Math.round(canvas.clientWidth * this.dpr)));
    const h = Math.min(max, Math.max(1, Math.round(canvas.clientHeight * this.dpr)));
    if (this.targets && this.targets.width === w && this.targets.height === h) return;
    canvas.width = w;
    canvas.height = h;
    this.targets?.albedo.destroy();
    this.targets?.nid.destroy();
    this.targets?.depth.destroy();
    const usage = GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING;
    const albedo = device.createTexture({ size: [w, h], format: ALBEDO_FORMAT, usage });
    const nid = device.createTexture({ size: [w, h], format: NID_FORMAT, usage });
    const depth = device.createTexture({ size: [w, h], format: DEPTH_FORMAT, usage });
    const compositeBind = device.createBindGroup({
      layout: this.compositePipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.globals } },
        { binding: 1, resource: albedo.createView() },
        { binding: 2, resource: nid.createView() },
        { binding: 3, resource: depth.createView() },
      ],
    });
    this.targets = { width: w, height: h, albedo, nid, depth, compositeBind };
  }

  get aspect(): number {
    return this.targets ? this.targets.width / this.targets.height : 1;
  }

  private writeGlobals(cam: OrbitCamera, time: number): void {
    const t = this.targets!;
    const view = cam.view();
    const data = new Float32Array(GLOBALS_SIZE / 4);
    data.set(cam.viewProj(this.aspect), 0);
    data.set([...cam.eye(), time], 16);
    data.set([view[0], view[4], view[8], Math.floor(time * 8) % 97], 20);
    data.set([view[1], view[5], view[9], this.dpr], 24);
    data.set([t.width, t.height, 0.5, cam.distance * 3], 28);
    this.gpu.device.queue.writeBuffer(this.globals, 0, data);
  }

  private writeTiles(view: SceneView): number {
    const n = view.size;
    const land = new Set(view.tiles.filter((t) => t.drop === 0).map((t) => t.y * n + t.x));
    const count = view.tiles.length + view.bridges.length;
    const r = this.ensureBuffer(this.tileBuf, this.tileCap, count, TILE_FLOATS);
    this.tileBuf = r.buf;
    this.tileCap = r.cap;
    const data = new Float32Array(Math.max(count, 1) * TILE_FLOATS);
    let o = 0;
    let id = 1;
    for (const t of view.tiles) {
      const c = tileCenter(n, t);
      let flags = t.flags;
      DIRS4.forEach(([dx, dy], bit) => {
        const x = t.x + dx;
        const y = t.y + dy;
        if (x >= 0 && y >= 0 && x < n && y < n && land.has(y * n + x)) flags |= 1 << (5 + bit);
      });
      const lift = (t.seed - 0.5) * 0.05;
      data.set([c[0], t.drop + lift, c[2], 0], o);
      data.set([1, TILE_HEIGHT, 1, id++], o + 4);
      data.set(t.tint, o + 8);
      data.set([flags, t.decal, 0, t.seed], o + 12);
      o += TILE_FLOATS;
    }
    for (const b of view.bridges) {
      const c = tileCenter(n, b);
      data.set([c[0], 0.045 + b.drop, c[2], 1], o);
      data.set([BRIDGE_LEN, BRIDGE_THICK, BRIDGE_WIDTH, id++], o + 4);
      data.set(b.tint, o + 8);
      data.set([b.ghost ? F_GHOST : 0, -1, b.dir === 'V' ? 1 : 0, (b.x * 7 + b.y * 13) % 10 / 10], o + 12);
      o += TILE_FLOATS;
    }
    this.gpu.device.queue.writeBuffer(this.tileBuf, 0, data);
    return count;
  }

  private writeSprites(view: SceneView, cam: OrbitCamera): number {
    const eye = cam.eye();
    const visible = view.sprites.filter((s) => s.alpha > 0.001 && this.atlas.frames[s.name]);
    const dist = (p: number[]) => (p[0] - eye[0]) ** 2 + (p[1] - eye[1]) ** 2 + (p[2] - eye[2]) ** 2;
    visible.sort((a, b) => dist(b.pos) - dist(a.pos));
    const r = this.ensureBuffer(this.spriteBuf, this.spriteCap, visible.length, SPRITE_FLOATS);
    this.spriteBuf = r.buf;
    this.spriteCap = r.cap;
    const data = new Float32Array(Math.max(visible.length, 1) * SPRITE_FLOATS);
    visible.forEach((s, i) => {
      const f = this.atlas.frames[s.name]!;
      const o = i * SPRITE_FLOATS;
      data.set([...s.pos, s.reveal], o);
      data.set([s.height * f.aspect, s.height, s.flip ? 1 : 0, (i * 0.37) % 1], o + 4);
      data.set([f.u0, f.v0, f.u1, f.v1], o + 8);
      data.set(s.tint, o + 12);
      data.set([s.alpha, 0, 0, 0], o + 16);
    });
    this.gpu.device.queue.writeBuffer(this.spriteBuf, 0, data);
    return visible.length;
  }

  render(view: SceneView, cam: OrbitCamera): void {
    this.resize();
    const t = this.targets!;
    const { device, context } = this.gpu;
    this.writeGlobals(cam, view.time);
    const tiles = this.writeTiles(view);
    const sprites = this.writeSprites(view, cam);

    const enc = device.createCommandEncoder();
    const scene = enc.beginRenderPass({
      colorAttachments: [
        { view: t.albedo.createView(), loadOp: 'clear', storeOp: 'store', clearValue: [1, 1, 1, 1] },
        { view: t.nid.createView(), loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 0] },
      ],
      depthStencilAttachment: { view: t.depth.createView(), depthLoadOp: 'clear', depthStoreOp: 'store', depthClearValue: 1 },
    });
    if (tiles > 0) {
      scene.setPipeline(this.scenePipe);
      scene.setBindGroup(0, this.sceneBind);
      scene.setVertexBuffer(0, this.vbuf);
      scene.setVertexBuffer(1, this.tileBuf);
      scene.setIndexBuffer(this.ibuf, 'uint16');
      scene.drawIndexed(this.indexCount, tiles);
    }
    scene.end();

    const screen = context.getCurrentTexture().createView();
    const comp = enc.beginRenderPass({
      colorAttachments: [{ view: screen, loadOp: 'clear', storeOp: 'store', clearValue: [1, 1, 1, 1] }],
    });
    comp.setPipeline(this.compositePipe);
    comp.setBindGroup(0, t.compositeBind);
    comp.draw(3);
    comp.end();

    if (sprites > 0) {
      const sp = enc.beginRenderPass({
        colorAttachments: [{ view: screen, loadOp: 'load', storeOp: 'store' }],
        depthStencilAttachment: { view: t.depth.createView(), depthReadOnly: true },
      });
      sp.setPipeline(this.spritePipe);
      sp.setBindGroup(0, this.spriteBind);
      sp.setVertexBuffer(0, this.spriteBuf);
      sp.draw(4, sprites);
      sp.end();
    }
    device.queue.submit([enc.finish()]);
  }
}
