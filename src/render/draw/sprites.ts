import { ellipsePts, filledShape, inkStroke, INK, PAPER, prng, wobblyPath, type Pt } from './sketch';

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

/** Rectangle rotated around (cx, cy), as points for wobblyPath. */
function rotRect(cx: number, cy: number, w: number, h: number, angle: number): Pt[] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ].map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c] as Pt);
}

function polygon(ctx: CanvasRenderingContext2D, pts: Pt[]): void {
  ctx.beginPath();
  ctx.moveTo(...pts[0]);
  for (const p of pts.slice(1)) ctx.lineTo(...p);
  ctx.closePath();
}

/** Upright rat facing right, holding a pencil (sword) and an eraser (shield). 320×320, feet at the bottom. */
export function drawRat(color: string, seed: number): HTMLCanvasElement {
  const [c, ctx] = canvas(320, 320);
  const r = prng(seed);
  const shape = (pts: Pt[], closed = true, amp = 1.2) => () => wobblyPath(ctx, pts, closed, r, amp);

  // Tail
  wobblyPath(ctx, [[120, 278], [86, 296], [52, 302], [30, 288], [26, 264], [40, 250], [54, 254]], false, r);
  inkStroke(ctx, 4.5);

  // Feet
  filledShape(ctx, shape(ellipsePts(126, 304, 20, 9, 12)), { line: 3.5 });

  // Body, hatched on the back
  const body = shape(ellipsePts(150, 236, 54, 70, 18, 0.012));
  filledShape(ctx, body, {});
  ctx.save();
  body();
  ctx.clip();
  ctx.beginPath();
  ctx.rect(0, 0, 128, 320);
  ctx.clip();
  ctx.beginPath();
  for (let x = 92; x < 130; x += 6) {
    ctx.moveTo(x, 160);
    ctx.lineTo(x + 2, 320);
  }
  inkStroke(ctx, 1.6);
  ctx.restore();
  body();
  inkStroke(ctx, 4.5);

  filledShape(ctx, shape(ellipsePts(180, 305, 22, 9, 12)), { line: 3.5 });

  // Scarf tail flapping behind
  filledShape(ctx, shape([[146, 186], [116, 196], [96, 222], [104, 232], [122, 214], [150, 200]]), { fill: color, line: 3.5 });

  // Ear behind the head
  filledShape(ctx, shape(ellipsePts(150, 106, 24, 27, 14)), { line: 4 });
  filledShape(ctx, shape(ellipsePts(151, 108, 13, 16, 12)), { fill: '#f6c3cc', line: 0 });

  // Head with snout
  const head: Pt[] = [
    [128, 152], [134, 124], [160, 110], [192, 114], [216, 134], [240, 156],
    [238, 170], [214, 180], [180, 188], [148, 184], [130, 170],
  ];
  filledShape(ctx, shape(head), { line: 4.5 });
  // Nose, eye, whiskers
  filledShape(ctx, shape(ellipsePts(240, 162, 7, 6, 10)), { fill: '#e58a9a', line: 3 });
  filledShape(ctx, shape(ellipsePts(196, 140, 5.5, 6.5, 10)), { fill: INK, line: 0 });
  ctx.beginPath();
  ctx.arc(198, 137.5, 1.8, 0, Math.PI * 2);
  ctx.fillStyle = PAPER;
  ctx.fill();
  ctx.beginPath();
  for (const [x, y] of [[272, 150], [276, 166], [270, 182]] as Pt[]) {
    ctx.moveTo(228, 166);
    ctx.quadraticCurveTo((228 + x) / 2, (166 + y) / 2 - 3, x, y);
  }
  inkStroke(ctx, 1.8);

  // Scarf around the neck
  filledShape(ctx, shape([[134, 178], [168, 186], [204, 182], [208, 198], [170, 204], [136, 196]]), { fill: color, line: 4 });
  ctx.beginPath();
  for (let x = 150; x < 200; x += 14) {
    ctx.moveTo(x, 190);
    ctx.lineTo(x + 4, 200);
  }
  inkStroke(ctx, 1.6, PAPER);

  // Pencil (sword): grip at the front paw, pointing up and forward.
  const grip: Pt = [214, 252];
  const dir: Pt = [0.42, -0.91];
  const nrm: Pt = [-dir[1], dir[0]];
  const along = (t: number, side: number): Pt => [grip[0] + dir[0] * t + nrm[0] * side, grip[1] + dir[1] * t + nrm[1] * side];
  const hw = 9;
  // eraser cap and ferrule at the bottom
  filledShape(ctx, () => polygon(ctx, [along(-46, -hw), along(-46, hw), along(-34, hw), along(-34, -hw)]), { fill: '#f4a3b3', line: 3 });
  filledShape(ctx, () => polygon(ctx, [along(-34, -hw), along(-34, hw), along(-22, hw), along(-22, -hw)]), { fill: '#c9c6c0', line: 3 });
  filledShape(ctx, () => polygon(ctx, [along(-22, -hw), along(-22, hw), along(118, hw), along(118, -hw)]), { fill: color, line: 3.5 });
  ctx.beginPath();
  ctx.moveTo(...along(-20, 0));
  ctx.lineTo(...along(116, 0));
  inkStroke(ctx, 1.6, 'rgba(255,255,255,0.7)');
  filledShape(ctx, () => polygon(ctx, [along(118, -hw), along(118, hw), along(150, 0)]), { fill: '#f2dcb6', line: 3.5 });
  filledShape(ctx, () => polygon(ctx, [along(140, -2.8), along(140, 2.8), along(150, 0)]), { fill: INK, line: 2 });
  // paw over the grip
  filledShape(ctx, shape(ellipsePts(grip[0] - 2, grip[1] - 4, 12, 10, 10)), { line: 3.5 });
  // arm
  wobblyPath(ctx, [[184, 218], [198, 236], [206, 246]], false, r);
  inkStroke(ctx, 4);

  // Eraser (shield) held in front of the belly
  const shield = rotRect(116, 250, 62, 82, -0.12);
  filledShape(ctx, () => wobblyPath(ctx, shield, true, r, 1.5), { fill: '#f7b1bf', line: 4.5 });
  const sleeve = rotRect(117.5, 262, 64, 40, -0.12);
  filledShape(ctx, () => polygon(ctx, sleeve), { fill: color, line: 3.5 });
  ctx.beginPath();
  ctx.moveTo(98, 262);
  ctx.lineTo(136, 257);
  inkStroke(ctx, 2.2, PAPER);
  filledShape(ctx, shape(ellipsePts(136, 232, 11, 9, 10)), { line: 3.5 });
  return c;
}

/** Scribbly dust cloud for erasing and crumbling. */
export function drawPoof(seed: number): HTMLCanvasElement {
  const [c, ctx] = canvas(192, 160);
  const r = prng(seed);
  const puffs: [number, number, number][] = [
    [62, 104, 30], [100, 92, 36], [136, 106, 28], [82, 70, 24], [122, 64, 22], [96, 122, 26],
  ];
  for (const [x, y, rad] of puffs) {
    filledShape(ctx, () => wobblyPath(ctx, ellipsePts(x, y, rad, rad * 0.86, 12, 0.04), true, r, 2), {
      hatch: { angle: 0.6, gap: 9, width: 1.2 },
      line: 3.5,
    });
  }
  ctx.beginPath();
  for (const [x1, y1, x2, y2] of [[20, 60, 6, 48], [172, 70, 186, 56], [30, 140, 14, 150], [168, 140, 184, 150]]) {
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
  }
  inkStroke(ctx, 3);
  return c;
}

/** Small top-view doodles stamped on tile tops (128×128, ink only). */
export function drawDecal(kind: number, seed: number): HTMLCanvasElement {
  const [c, ctx] = canvas(128, 128);
  const r = prng(seed);
  ctx.translate(64, 64);
  if (kind === 0) {
    // grass tuft
    ctx.beginPath();
    ctx.moveTo(-34, 14);
    ctx.quadraticCurveTo(-28, -18, -16, 10);
    ctx.quadraticCurveTo(-6, -30, 4, 8);
    ctx.quadraticCurveTo(16, -22, 26, 12);
    inkStroke(ctx, 6);
  } else if (kind === 1) {
    // four-petal flower
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + 0.3;
      filledShape(ctx, () => wobblyPath(ctx, ellipsePts(Math.cos(a) * 17, Math.sin(a) * 17, 14, 12, 10, 0, a), true, r, 1.5), { line: 5.5 });
    }
    filledShape(ctx, () => wobblyPath(ctx, ellipsePts(0, 0, 7, 7, 8), true, r), { fill: INK, line: 0 });
  } else if (kind === 2) {
    // swirl
    ctx.beginPath();
    for (let t = 0; t < 9.5; t += 0.15) {
      const rad = 3 + t * 3.6;
      const x = Math.cos(t) * rad;
      const y = Math.sin(t) * rad * 0.8;
      if (t === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    inkStroke(ctx, 6);
  } else {
    // pebbles
    for (const [x, y, s] of [[-18, 6, 13], [10, -12, 10], [18, 16, 8]] as [number, number, number][]) {
      filledShape(ctx, () => wobblyPath(ctx, ellipsePts(x, y, s, s * 0.75, 10), true, r), {
        hatch: { angle: 0.8, gap: 6, width: 2 },
        line: 5,
      });
    }
  }
  return c;
}
