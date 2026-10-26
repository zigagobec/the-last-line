import { App } from './app';
import { Rng, type Action, type Pos } from './game';
import { chooseAction } from './sim/bot';
import { buildAtlas } from './render/atlas';
import { initGpu } from './render/gpu';
import { Renderer } from './render/renderer';
import { loadRules, Menu } from './ui/menu';
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
    document.getElementById('loading')?.remove();
    fatal(T.noWebGPU);
    return;
  }
  gpu.device.lost.then((info) => {
    if (info.reason !== 'destroyed') fatal(T.gpuLost);
  });
  const renderer = await Renderer.create(gpu, await buildAtlas(gpu.device));
  const params = new URLSearchParams(location.search);
  const randomSeed = () => Math.floor(Math.random() * 1e6);
  const urlSeed = params.get('seed');
  let firstSeed: number | undefined = urlSeed !== null && Number.isFinite(Number(urlSeed)) ? Number(urlSeed) : undefined;
  let menu: Menu;
  const app = new App(renderer, canvas, {
    onGameOver: (s) => {
      app.pause(true);
      menu.showEnd(s);
    },
    onHelp: () => {
      app.pause(true);
      menu.showHelpInGame();
    },
    onMenu: () => {
      app.pause(true);
      menu.showPause();
    },
  });
  menu = new Menu({
    onStart: (rules, seed) => {
      app.start(rules, seed ?? firstSeed ?? randomSeed());
      firstSeed = undefined;
    },
    onResume: () => app.pause(false),
    onShowMenu: () => {
      app.start(loadRules(), randomSeed());
      app.pause(true, true);
    },
  });
  // Title screen over a slowly turning demo board.
  app.start(loadRules(), firstSeed ?? randomSeed());
  app.pause(true, true);
  menu.showStart();
  document.getElementById('loading')?.remove();
  const botRng = new Rng(Date.now() & 0xffff);
  const seedOf = () => firstSeed ?? randomSeed();
  window.__game = {
    state: () => app.state,
    dispatch: (a) => app.dispatch(a),
    busy: () => app.session?.animator.busy() ?? false,
    start: (seed) => {
      menu.close();
      app.start(loadRules(), seed ?? seedOf());
    },
    screenOf: (p) => app.screenOf(p),
    clickPointFor: (p) => app.clickPointFor(p),
    snap: (dir) => app.cam.snap(dir),
    botAction: (level = 'greedy') => (app.state ? chooseAction(app.state, botRng, level) : null),
  };
}

boot();
