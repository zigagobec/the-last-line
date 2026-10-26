import {
  bridgeDirs,
  canErase,
  canTree,
  cell,
  createGame,
  eq,
  inBounds,
  moveTargets,
  type Action,
  type BridgeDir,
  type GameState,
  type Pos,
  type Rules,
} from './game';
import { OrbitCamera, pickTile } from './render/camera';
import { frameAlpha } from './render/atlas';
import { mat4, vec3, type Vec3 } from './render/math';
import type { Renderer } from './render/renderer';
import { Hud } from './ui/hud';
import { PointerInput } from './ui/input';
import { T, type Tool } from './ui/strings';
import { PLAYER_TINT } from './view/colors';
import {
  buildSceneView,
  fadeOccluders,
  posKey,
  TILE_DENIED,
  TILE_HIGHLIGHT,
  TILE_HOVER,
  treeSprite,
  type SceneView,
  type SpriteName,
} from './view/scene';
import { Session } from './view/session';

const TOOL_KEYS: Record<string, Tool> = { '1': 'move', '2': 'tree', '3': 'bridge', '4': 'erase', '5': 'skip' };

export interface AppCallbacks {
  onGameOver(state: GameState): void;
  onHelp(): void;
  onMenu(): void;
}

export class App {
  session: Session | null = null;
  readonly cam: OrbitCamera;
  private tool: Tool = 'move';
  private aspectCache: Partial<Record<SpriteName, number>> | null = null;
  private bridgeDir: BridgeDir = 'H';
  private pointer: [number, number] | null = null;
  private hud: Hud;
  private shownTurn = '';
  private overShown = false;
  private last = performance.now();
  private paused = false;
  private attract = false;
  private lastView: SceneView | null = null;

  constructor(
    private readonly renderer: Renderer,
    private readonly canvas: HTMLCanvasElement,
    private readonly cb: AppCallbacks,
  ) {
    this.cam = new OrbitCamera(8);
    this.hud = new Hud(document.body, {
      onTool: (t) => this.selectTool(t),
      onRotateBridge: () => this.rotateBridge(),
      onCamera: (d) => this.cam.snap(d),
      onHelp: () => cb.onHelp(),
      onMenu: () => cb.onMenu(),
    });
    new PointerInput(canvas, this.cam, {
      onHover: (ndc) => (this.pointer = ndc),
      onClick: (ndc) => this.click(ndc),
    });
    window.addEventListener('keydown', (e) => this.key(e));
    requestAnimationFrame(this.frame);
  }

  get state(): GameState | null {
    return this.session?.state ?? null;
  }

  start(rules: Rules, seed: number): void {
    this.load(createGame(rules, seed));
  }

  /** Play from an arbitrary state (new games and scripted test scenarios). */
  load(state: GameState): void {
    this.session = new Session(state);
    this.cam.resetFor(state.rules.size);
    this.shownTurn = '';
    this.overShown = false;
    this.tool = 'move';
    this.hud.show(true);
    this.paused = false;
    this.attract = false;
  }

  private aspects(): Partial<Record<SpriteName, number>> {
    if (!this.aspectCache) {
      this.aspectCache = {};
      for (const [name, f] of Object.entries(this.renderer.atlas.frames)) this.aspectCache[name as SpriteName] = f.aspect;
    }
    return this.aspectCache;
  }

  /** Hide the HUD and freeze input while a menu is open; `attract` slowly spins the board behind the title screen. */
  pause(paused: boolean, attract = false): void {
    this.paused = paused;
    this.attract = paused && attract;
    if (this.session) this.hud.show(!paused && !this.session.state.over);
  }

  /** A CSS-pixel point that targets tile `p` (sprites in front can hide its centre), for automated tests. */
  clickPointFor(p: Pos): { x: number; y: number } | null {
    const size = this.state?.rules.size ?? 8;
    const c = (size - 1) / 2;
    const r = this.canvas.getBoundingClientRect();
    const vp = this.cam.viewProj(this.renderer.aspect);
    for (const [ox, oz] of [[0, 0], [0.25, 0.25], [-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.38, 0], [-0.38, 0], [0, 0.38], [0, -0.38]]) {
      const clip = mat4.transform(vp, [p.x - c + ox, 0, p.y - c + oz, 1]);
      const ndc: [number, number] = [clip[0] / clip[3], clip[1] / clip[3]];
      const t = this.targetAt(ndc);
      if (t && t.p.x === p.x && t.p.y === p.y) {
        return { x: r.left + ((ndc[0] + 1) / 2) * r.width, y: r.top + ((1 - ndc[1]) / 2) * r.height };
      }
    }
    return null;
  }

  /** CSS-pixel position of a tile's top centre (for automated tests). */
  screenOf(p: Pos): { x: number; y: number } {
    const size = this.state?.rules.size ?? 8;
    const c = (size - 1) / 2;
    const clip = mat4.transform(this.cam.viewProj(this.renderer.aspect), [p.x - c, 0, p.y - c, 1]);
    const r = this.canvas.getBoundingClientRect();
    return { x: r.left + ((clip[0] / clip[3] + 1) / 2) * r.width, y: r.top + ((1 - clip[1] / clip[3]) / 2) * r.height };
  }

  dispatch(a: Action): boolean {
    if (!this.session || this.paused) return false;
    const ok = this.session.dispatch(a);
    if (ok) {
      this.hud.setBusy(true);
      this.tool = 'move';
    }
    return ok;
  }

  private selectTool(t: Tool): void {
    if (!this.session || this.session.animator.busy() || this.paused) return;
    if (t === 'skip' && this.tool === 'skip') {
      this.dispatch({ type: 'skip' });
      return;
    }
    this.tool = t;
    this.hud.setTool(t, false);
  }

  private rotateBridge(): void {
    this.bridgeDir = this.bridgeDir === 'H' ? 'V' : 'H';
  }

  private key(e: KeyboardEvent): void {
    if (this.paused || !this.session || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (TOOL_KEYS[k]) this.selectTool(TOOL_KEYS[k]);
    else if (k === 'r') this.rotateBridge();
    else if (k === 'q') this.cam.snap(-1);
    else if (k === 'e') this.cam.snap(1);
    else if (k === 'escape') this.selectTool('move');
  }

  private hoverTile(): Pos | null {
    if (!this.pointer) return null;
    return this.targetAt(this.pointer)?.p ?? null;
  }

  /**
   * The board object drawn under an NDC point: trees, signs and rats stand up from their
   * tiles and hide what is behind them, so a click on one means its own tile.
   */
  private spriteAt(ndc: [number, number]): { key: string; p: Pos } | null {
    const view = this.lastView;
    const s = this.state;
    if (!view || !s) return null;
    const aspect = this.renderer.aspect;
    const vp = this.cam.viewProj(aspect);
    const v = this.cam.view();
    const right: Vec3 = [v[0], v[4], v[8]];
    const up: Vec3 = [v[1], v[5], v[9]];
    const eye = this.cam.eye();
    const project = (p: Vec3) => {
      const c = mat4.transform(vp, [p[0], p[1], p[2], 1]);
      return [c[0] / c[3], c[1] / c[3]];
    };
    const candidates = view.sprites
      .filter((sp) => /^(tree|sign):|^rat[01]$/.test(sp.key) && sp.alpha > 0.5)
      .sort((a, b) => vec3.dot(vec3.sub(a.pos, eye), vec3.sub(a.pos, eye)) - vec3.dot(vec3.sub(b.pos, eye), vec3.sub(b.pos, eye)));
    for (const sp of candidates) {
      const frame = this.renderer.atlas.frames[sp.name];
      if (!frame) continue;
      const w = sp.height * frame.aspect;
      const bl = project(vec3.add(sp.pos, vec3.scale(right, -w / 2)));
      const tr = project(vec3.add(vec3.add(sp.pos, vec3.scale(right, w / 2)), vec3.scale(up, sp.height)));
      if (ndc[0] < bl[0] || ndc[0] > tr[0] || ndc[1] < bl[1] || ndc[1] > tr[1]) continue;
      let u = (ndc[0] - bl[0]) / (tr[0] - bl[0]);
      if (sp.flip) u = 1 - u;
      const vv = (tr[1] - ndc[1]) / (tr[1] - bl[1]);
      if (frameAlpha(this.renderer.atlas, frame, u, vv) < 0.3) continue;
      const m = /^(?:tree|sign):(\d+),(\d+)$/.exec(sp.key);
      const p = m ? { x: Number(m[1]), y: Number(m[2]) } : s.players[sp.key === 'rat0' ? 0 : 1];
      return { key: sp.key, p };
    }
    return null;
  }

  /** Tile targeted by an NDC point, looking at standing sprites first, then the ground. */
  private targetAt(ndc: [number, number]): { p: Pos; key: string | null } | null {
    const hit = this.spriteAt(ndc);
    if (hit) return hit;
    const s = this.state;
    if (!s) return null;
    const p = pickTile(this.cam, ndc[0], ndc[1], this.renderer.aspect, s.rules.size);
    return p ? { p, key: null } : null;
  }

  private anyTwoWayBridge(s: GameState): boolean {
    for (let y = 0; y < s.rules.size; y++) for (let x = 0; x < s.rules.size; x++) if (bridgeDirs(s, { x, y }).length === 2) return true;
    return false;
  }

  private bridgeFor(s: GameState, p: Pos): BridgeDir | null {
    const dirs = bridgeDirs(s, p);
    if (!dirs.length) return null;
    return dirs.includes(this.bridgeDir) ? this.bridgeDir : dirs[0];
  }

  private actionAt(s: GameState, p: Pos): Action | null {
    switch (this.tool) {
      case 'move':
        return moveTargets(s).some((t) => eq(t.to, p)) ? { type: 'move', to: p } : null;
      case 'tree':
        return canTree(s, p) ? { type: 'tree', at: p } : null;
      case 'bridge': {
        const dir = this.bridgeFor(s, p);
        return dir ? { type: 'bridge', at: p, dir } : null;
      }
      case 'erase':
        return canErase(s, p) ? { type: 'erase', at: p } : null;
      case 'skip':
        return null;
    }
  }

  private click(ndc: [number, number]): void {
    const s = this.state;
    if (!s || this.paused || s.over || this.session!.animator.busy()) return;
    const target = this.targetAt(ndc);
    if (!target) return;
    const a = this.actionAt(s, target.p);
    if (a) this.dispatch(a);
    else if (target.key === `rat${s.current}`) this.selectTool('move');
    else this.hud.flashHint(T.denied);
  }

  /** Highlights and ghost previews for the current tool. */
  private decorate(view: SceneView, s: GameState): void {
    const tint = PLAYER_TINT[s.current];
    const hover = this.hoverTile();
    const tileAt = (p: Pos) => view.tiles.find((t) => t.x === p.x && t.y === p.y);
    const mark = (p: Pos, flags: number) => {
      const t = tileAt(p);
      if (t) {
        t.flags |= flags;
        t.tint = tint;
      }
    };
    switch (this.tool) {
      case 'move':
        for (const t of moveTargets(s)) mark(t.to, TILE_HIGHLIGHT | (hover && eq(hover, t.to) ? TILE_HOVER : 0));
        break;
      case 'tree':
        if (s.rules.range !== 'any') {
          for (const t of view.tiles) if (canTree(s, t)) mark(t, TILE_HIGHLIGHT);
        }
        if (hover && inBounds(s, hover) && cell(s, hover).land) {
          if (canTree(s, hover)) {
            mark(hover, TILE_HIGHLIGHT | TILE_HOVER);
            const ghost = treeSprite(view.size, hover, 0.7);
            ghost.key = 'ghost';
            ghost.alpha = 0.55;
            ghost.tint = [tint[0], tint[1], tint[2], 0.35];
            view.sprites.push(ghost);
          } else mark(hover, TILE_DENIED);
        }
        break;
      case 'bridge':
        for (let y = 0; y < s.rules.size; y++) {
          for (let x = 0; x < s.rules.size; x++) {
            const dir = this.bridgeFor(s, { x, y });
            if (!dir) continue;
            const hot = !!hover && hover.x === x && hover.y === y;
            view.bridges.push({ x, y, dir, ghost: !hot, tint: [tint[0], tint[1], tint[2], hot ? 0.45 : 1], drop: hot ? 0 : 0.02 });
          }
        }
        break;
      case 'erase':
        for (const t of view.tiles) {
          if (cell(s, t).tree && canErase(s, t)) mark(t, TILE_HIGHLIGHT | (hover && eq(hover, t) ? TILE_HOVER : 0));
        }
        for (const b of view.bridges) {
          if (canErase(s, b)) b.tint = [tint[0], tint[1], tint[2], hover && eq(hover, b) ? 0.8 : 0.4];
        }
        if (hover) {
          const tree = view.sprites.find((sp) => sp.key === `tree:${posKey(hover)}`);
          if (tree && canErase(s, hover)) tree.alpha = 0.5;
        }
        break;
      case 'skip':
        break;
    }
  }

  private frame = (now: number): void => {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (this.attract && this.paused) this.cam.orbit(dt * 0.12, 0);
    this.cam.update(dt);
    const session = this.session;
    if (session) {
      session.animator.update(dt);
      const s = session.state;
      const busy = session.animator.busy();
      const view = buildSceneView(s, now / 1000);
      session.animator.apply(view);
      if (!busy && !s.over && !this.paused) this.decorate(view, s);
      fadeOccluders(view, this.cam.viewProj(this.renderer.aspect), this.cam.view(), this.cam.eye(), this.aspects());
      this.lastView = view;
      this.renderer.render(view, this.cam);

      if (!busy) {
        const turnKey = `${s.round}:${s.current}:${s.acted}`;
        if (!s.over && turnKey !== this.shownTurn) {
          const newRound = !this.shownTurn.startsWith(`${s.round}:`);
          this.shownTurn = turnKey;
          this.hud.setState(s);
          this.hud.setBusy(false);
          this.tool = 'move';
          this.hud.setTool('move', false);
          this.hud.banner(newRound ? T.roundBanner(s.round, s.current) : T.turnBanner(s.current), s.current);
        }
        if (s.over && !this.overShown && !this.paused) {
          this.overShown = true;
          this.hud.show(false);
          this.cb.onGameOver(s);
        }
      }
      if (!busy && !s.over) {
        const hover = this.hoverTile();
        this.hud.setTool(this.tool, this.tool === 'bridge' && this.anyTwoWayBridge(s));
        this.canvas.style.cursor = hover && this.actionAt(s, hover) ? 'pointer' : 'default';
      }
    }
    requestAnimationFrame(this.frame);
  };
}
