import { App } from './app';
import { defaultRules, Rng, type Action, type Pos } from './game';
import { chooseAction } from './sim/bot';
import { buildAtlas } from './render/atlas';
import { initGpu } from './render/gpu';
import { Renderer } from './render/renderer';
import { T } from './ui/strings';

declare global {
  interface Window {
    __game?: {
      state: () => unknown;
      dispatch: (a: Action) => boolean;
      busy: () => boolean;
      start: (seed?: number) => void;
      screenOf: (p: Pos) => { x: number; y: number };
      clickPointFor: (p: Pos) => { x: number; y: number } | null;
      snap: (dir: 1 | -1) => void;
      botAction: (level?: 'random' | 'greedy') => Action | null;
    };
  }
}

function fatal(text: string): void {
  const box = document.createElement('div');
  box.className = 'fatal paper';
  box.textContent = text;
  document.body.appendChild(box);
}

async function boot() {
  const canvas = document.getElementById('gfx') as HTMLCanvasElement;
  const gpu = await initGpu(canvas);
  if (!gpu) {
    fatal(T.noWebGPU);
    return;
  }
  gpu.device.lost.then((info) => {
    if (info.reason !== 'destroyed') fatal(T.gpuLost);
  });
  const renderer = await Renderer.create(gpu, await buildAtlas(gpu.device));
  const params = new URLSearchParams(location.search);
  const app = new App(renderer, canvas, {
    onGameOver: () => {},
    onHelp: () => {},
    onMenu: () => {},
  });
  const botRng = new Rng(Date.now() & 0xffff);
  const seedOf = () => Number(params.get('seed') ?? Math.floor(Math.random() * 1e6));
  app.start(defaultRules(), seedOf());
  window.__game = {
    state: () => app.state,
    dispatch: (a) => app.dispatch(a),
    busy: () => app.session?.animator.busy() ?? false,
    start: (seed) => app.start(defaultRules(), seed ?? seedOf()),
    screenOf: (p) => app.screenOf(p),
    clickPointFor: (p) => app.clickPointFor(p),
    snap: (dir) => app.cam.snap(dir),
    botAction: (level = 'greedy') => (app.state ? chooseAction(app.state, botRng, level) : null),
  };
}

boot();
