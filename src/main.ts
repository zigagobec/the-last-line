import { createGame, defaultRules } from './game';
import { buildAtlas } from './render/atlas';
import { OrbitCamera } from './render/camera';
import { initGpu } from './render/gpu';
import { Renderer } from './render/renderer';
import { buildSceneView } from './view/scene';

async function boot() {
  const canvas = document.getElementById('gfx') as HTMLCanvasElement;
  const gpu = await initGpu(canvas);
  if (!gpu) {
    document.body.textContent = 'WebGPU ni na voljo.';
    return;
  }
  const renderer = await Renderer.create(gpu, await buildAtlas(gpu.device));
  const seed = Number(new URLSearchParams(location.search).get('seed') ?? 7);
  const state = createGame(defaultRules(), seed);
  // Debug: show bridges over the generated gaps.
  if (new URLSearchParams(location.search).has('bridges')) {
    state.cells.forEach((c, i) => {
      if (!c.land) c.bridge = i % 2 ? 'H' : 'V';
    });
  }
  const cam = new OrbitCamera(state.rules.size);
  const yaw = new URLSearchParams(location.search).get('yaw');
  if (yaw) cam.orbit(Number(yaw), 0);
  const zoom = new URLSearchParams(location.search).get('zoom');
  if (zoom) cam.zoom(Number(zoom));
  let last = performance.now();
  const frame = (now: number) => {
    cam.update((now - last) / 1000);
    last = now;
    renderer.render(buildSceneView(state, now / 1000), cam);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

boot();
