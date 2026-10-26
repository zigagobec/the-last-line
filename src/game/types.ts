export type PlayerId = 0 | 1;

export interface Pos {
  x: number;
  y: number;
}

/** H spans (x-1,y)–(x+1,y); V spans (x,y-1)–(x,y+1). */
export type BridgeDir = 'H' | 'V';

export interface Cell {
  land: boolean;
  tree: boolean;
  bridge: BridgeDir | null;
  marked: boolean;
}

/** Manhattan distance from the acting rat within which drawing/erasing is allowed. */
export type Range = 'any' | 1 | 2;

export interface Rules {
  size: number;
  edgeErosion: number;
  randomErosion: number;
  range: Range;
  trees: number;
  gaps: number;
}

export function defaultRules(size = 8): Rules {
  const trees = Math.max(2, Math.round((size * size) / 16 / 2) * 2);
  return { size, edgeErosion: 2, randomErosion: 1, range: 'any', trees, gaps: 2 };
}

export interface GameState {
  rules: Rules;
  seed: number;
  /** Serializable RNG state. */
  rng: number;
  cells: Cell[];
  players: [Pos, Pos];
  fallen: [boolean, boolean];
  round: number;
  starter: PlayerId;
  current: PlayerId;
  /** Number of actions already taken this round (0 or 1). */
  acted: number;
  over: boolean;
  winner: PlayerId | 'draw' | null;
}

export type Action =
  | { type: 'move'; to: Pos }
  | { type: 'tree'; at: Pos }
  | { type: 'bridge'; at: Pos; dir: BridgeDir }
  | { type: 'erase'; at: Pos }
  | { type: 'skip' };

export type GameEvent =
  | { type: 'move'; player: PlayerId; from: Pos; to: Pos; viaBridge: boolean }
  | { type: 'tree'; player: PlayerId; at: Pos }
  | { type: 'bridge'; player: PlayerId; at: Pos; dir: BridgeDir }
  | { type: 'erase'; player: PlayerId; at: Pos; what: 'tree' | 'bridge' }
  | { type: 'skip'; player: PlayerId }
  | {
      type: 'erosion';
      removed: Pos[];
      treesDestroyed: Pos[];
      bridgesCollapsed: Pos[];
      fell: PlayerId[];
    }
  | { type: 'roundStart'; round: number; starter: PlayerId; marked: Pos[] }
  | { type: 'gameOver'; winner: PlayerId | 'draw' };
