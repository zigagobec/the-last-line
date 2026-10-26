import type { BridgeDir, GameEvent, PlayerId, Pos } from '../game';
import { tileCenter } from '../render/camera';
import type { Vec3 } from '../render/math';
import {
  cellSeed,
  NO_TINT,
  posKey,
  ratSprite,
  signSprite,
  sprite,
  treeSprite,
  TILE_MARKED,
  type SceneView,
  type TileView,
} from './scene';

/**
 * Plays game events as a queue of short effects on top of the *final* state's scene.
 * Each frame the scene is built from the latest game state; then pending effects
 * (latest first) restore what the scene looked like before them, and the running
 * effect draws its in-between frame.
 */
interface Effect {
  duration: number;
  /** p = 0 before the effect starts, 0..1 while running. */
  apply(view: SceneView, p: number): void;
}

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const findSprite = (view: SceneView, key: string) => view.sprites.find((s) => s.key === key);
const removeSprite = (view: SceneView, key: string) => {
  view.sprites = view.sprites.filter((s) => s.key !== key);
};
const findTile = (view: SceneView, p: Pos) => view.tiles.find((t) => t.x === p.x && t.y === p.y);

function restoreTile(view: SceneView, p: Pos, flags: number): TileView {
  const existing = findTile(view, p);
  if (existing) {
    existing.flags |= flags;
    return existing;
  }
  const r = cellSeed(p.x, p.y, view.seed);
  const t: TileView = { x: p.x, y: p.y, drop: 0, flags, tint: NO_TINT, decal: r < 0.55 ? Math.floor(r * 7.27) % 4 : -1, seed: r };
  view.tiles.push(t);
  return t;
}

function poof(view: SceneView, key: string, at: Vec3, p: number): void {
  if (p <= 0 || p >= 1) return;
  const s = sprite(key, 'poof', [at[0], at[1] + 0.05, at[2]], 0.45 + p * 0.45, p > 0.5);
  s.alpha = Math.sin(Math.PI * p);
  view.sprites.push(s);
}

function moveFx(player: PlayerId, from: Pos, to: Pos, viaBridge: boolean): Effect {
  return {
    duration: viaBridge ? 0.55 : 0.32,
    apply(view, p) {
      const rat = findSprite(view, `rat${player}`);
      if (!rat) return;
      const a = tileCenter(view.size, from);
      const b = tileCenter(view.size, to);
      const t = easeInOut(p);
      rat.pos = [lerp(a[0], b[0], t), Math.sin(Math.PI * p) * (viaBridge ? 0.45 : 0.3), lerp(a[2], b[2], t)];
    },
  };
}

function treeFx(at: Pos): Effect {
  return {
    duration: 0.5,
    apply(view, p) {
      const tree = findSprite(view, `tree:${posKey(at)}`);
      if (tree) tree.reveal = easeOut(p);
    },
  };
}

function bridgeFx(at: Pos): Effect {
  return {
    duration: 0.4,
    apply(view, p) {
      if (p <= 0) {
        view.bridges = view.bridges.filter((b) => b.x !== at.x || b.y !== at.y);
        return;
      }
      const b = view.bridges.find((br) => br.x === at.x && br.y === at.y);
      if (b) b.drop = (1 - easeOut(p)) * 0.8;
    },
  };
}

function eraseFx(at: Pos, what: 'tree' | 'bridge', dir: BridgeDir | null): Effect {
  return {
    duration: 0.5,
    apply(view, p) {
      const c = tileCenter(view.size, at);
      if (what === 'tree') {
        const t = treeSprite(view.size, at, cellSeed(at.x, at.y, view.seed));
        t.alpha = 1 - easeOut(p);
        view.sprites.push(t);
      } else if (dir) {
        view.bridges.push({ x: at.x, y: at.y, dir, ghost: false, tint: NO_TINT, drop: -p * p * 5 });
      }
      poof(view, `poof:${posKey(at)}`, c, p);
    },
  };
}

function waitFx(duration: number): Effect {
  return { duration, apply() {} };
}

interface ErosionInfo {
  removed: Pos[];
  treesDestroyed: Pos[];
  bridgesCollapsed: { at: Pos; dir: BridgeDir }[];
  fell: { id: PlayerId; at: Pos }[];
}

const SHAKE = 0.45;
const FALL = 0.85;

function erosionFx(info: ErosionInfo): Effect {
  return {
    duration: SHAKE + FALL,
    apply(view, p) {
      const time = p * (SHAKE + FALL);
      const shaking = time < SHAKE;
      const fallT = Math.max(0, time - SHAKE) / FALL;
      const shake = shaking && p > 0 ? Math.sin(time * 70) * 0.025 * (time / SHAKE) : 0;
      const drop = shaking ? shake : -14 * fallT * fallT;
      for (const at of info.removed) {
        const t = restoreTile(view, at, shaking ? TILE_MARKED : 0);
        t.drop = drop;
        const sign = signSprite(view.size, at);
        sign.pos = [sign.pos[0], drop, sign.pos[2]];
        view.sprites.push(sign);
      }
      for (const at of info.treesDestroyed) {
        if (shaking) {
          restoreTile(view, at, TILE_MARKED);
          view.sprites.push(signSprite(view.size, at));
        }
        const tree = treeSprite(view.size, at, cellSeed(at.x, at.y, view.seed));
        tree.alpha = shaking ? 1 : 1 - easeOut(Math.min(1, fallT * 2));
        view.sprites.push(tree);
        if (!shaking) poof(view, `poof:${posKey(at)}`, tileCenter(view.size, at), Math.min(1, fallT * 1.4));
      }
      for (const b of info.bridgesCollapsed) {
        view.bridges.push({ x: b.at.x, y: b.at.y, dir: b.dir, ghost: false, tint: NO_TINT, drop });
      }
      for (const f of info.fell) {
        const rat = findSprite(view, `rat${f.id}`) ?? ratSprite(view.size, f.id, f.at);
        if (!view.sprites.includes(rat)) view.sprites.push(rat);
        const c = tileCenter(view.size, f.at);
        rat.pos = [c[0], drop, c[2]];
        rat.flip = shaking ? rat.flip : Math.floor(fallT * 10) % 2 === 0;
        rat.alpha = 1 - Math.max(0, fallT - 0.6) / 0.4;
      }
    },
  };
}

function roundStartFx(marked: Pos[]): Effect {
  return {
    duration: 0.55,
    apply(view, p) {
      for (const at of marked) {
        const t = findTile(view, at);
        if (p <= 0) {
          if (t) t.flags &= ~TILE_MARKED;
          removeSprite(view, `sign:${posKey(at)}`);
          continue;
        }
        const sign = findSprite(view, `sign:${posKey(at)}`);
        if (sign) sign.reveal = easeOut(p);
        if (t && p < 0.5) t.flags &= ~TILE_MARKED;
      }
    },
  };
}

export class Animator {
  private queue: { fx: Effect; elapsed: number }[] = [];
  /** Bridge orientation per cell, remembered so erased/collapsed bridges can be drawn falling. */
  private bridgeDirs = new Map<string, BridgeDir>();

  /** Tell the animator about bridges currently on the board (call with the pre-action state's bridges). */
  noteBridges(bridges: { x: number; y: number; dir: BridgeDir }[]): void {
    this.bridgeDirs.clear();
    for (const b of bridges) this.bridgeDirs.set(posKey(b), b.dir);
  }

  push(events: GameEvent[], playerPositions?: [Pos, Pos]): void {
    for (const e of events) {
      switch (e.type) {
        case 'move':
          this.queue.push({ fx: moveFx(e.player, e.from, e.to, e.viaBridge), elapsed: 0 });
          break;
        case 'tree':
          this.queue.push({ fx: treeFx(e.at), elapsed: 0 });
          break;
        case 'bridge':
          this.bridgeDirs.set(posKey(e.at), e.dir);
          this.queue.push({ fx: bridgeFx(e.at), elapsed: 0 });
          break;
        case 'erase':
          this.queue.push({ fx: eraseFx(e.at, e.what, this.bridgeDirs.get(posKey(e.at)) ?? null), elapsed: 0 });
          break;
        case 'skip':
          this.queue.push({ fx: waitFx(0.2), elapsed: 0 });
          break;
        case 'erosion':
          this.queue.push({
            fx: erosionFx({
              removed: e.removed,
              treesDestroyed: e.treesDestroyed,
              bridgesCollapsed: e.bridgesCollapsed.map((at) => ({ at, dir: this.bridgeDirs.get(posKey(at)) ?? 'H' })),
              fell: e.fell.map((id) => ({ id, at: playerPositions ? playerPositions[id] : e.removed[0] })),
            }),
            elapsed: 0,
          });
          break;
        case 'roundStart':
          this.queue.push({ fx: roundStartFx(e.marked), elapsed: 0 });
          break;
        case 'gameOver':
          this.queue.push({ fx: waitFx(0.3), elapsed: 0 });
          break;
      }
    }
  }

  busy(): boolean {
    return this.queue.length > 0;
  }

  /** Seconds until every queued effect has finished. */
  remaining(): number {
    return this.queue.reduce((sum, q) => sum + q.fx.duration - q.elapsed, 0);
  }

  update(dt: number): void {
    let left = dt;
    while (this.queue.length && left > 0) {
      const head = this.queue[0];
      const need = head.fx.duration - head.elapsed;
      if (left >= need) {
        left -= need;
        this.queue.shift();
      } else {
        head.elapsed += left;
        left = 0;
      }
    }
  }

  apply(view: SceneView): void {
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const q = this.queue[i];
      q.fx.apply(view, i === 0 ? Math.min(1, Math.max(1e-4, q.elapsed / q.fx.duration)) : 0);
    }
  }
}
