import type { Vec4 } from '../render/math';

/** Ink colours of the two rats (blue = player 1, red = player 2). */
export const PLAYER_CSS = ['#2d6cdf', '#e0442e'] as const;
export const PLAYER_TINT: [Vec4, Vec4] = [
  [0.18, 0.42, 0.87, 1],
  [0.88, 0.27, 0.18, 1],
];
