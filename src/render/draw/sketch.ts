/** Canvas2D helpers for a hand-drawn ink look. */
export const INK = '#1f1c21';
export const PAPER = '#fdfbf4';

/** Deterministic PRNG so sprites look the same on every load. */
export function prng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Pt = [number, number];

/** Polyline/curve through points with a slight wobble, drawn as a smooth path. */
export function wobblyPath(ctx: CanvasRenderingContext2D, pts: Pt[], closed: boolean, rand: () => number, amp = 1.2): void {
  const j = pts.map(([x, y]) => [x + (rand() - 0.5) * amp, y + (rand() - 0.5) * amp] as Pt);
  ctx.beginPath();
  if (closed) {
    const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const start = mid(j[j.length - 1], j[0]);
    ctx.moveTo(...start);
    for (let i = 0; i < j.length; i++) {
      const next = j[(i + 1) % j.length];
      ctx.quadraticCurveTo(j[i][0], j[i][1], ...mid(j[i], next));
    }
    ctx.closePath();
  } else {
    ctx.moveTo(...j[0]);
    for (let i = 1; i < j.length - 1; i++) {
      const m: Pt = [(j[i][0] + j[i + 1][0]) / 2, (j[i][1] + j[i + 1][1]) / 2];
      ctx.quadraticCurveTo(j[i][0], j[i][1], ...m);
    }
    ctx.lineTo(...j[j.length - 1]);
  }
}

/** Points on an ellipse (optionally bumpy) for wobblyPath. */
export function ellipsePts(cx: number, cy: number, rx: number, ry: number, n = 16, bump = 0, rot = 0): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rot;
    const r = 1 + (i % 2 ? bump : -bump);
    out.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r]);
  }
  return out;
}

export function inkStroke(ctx: CanvasRenderingContext2D, width: number, color = INK): void {
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/** Fill the current path with paper, then hatch inside it, then outline. */
export function filledShape(
  ctx: CanvasRenderingContext2D,
  path: () => void,
  opts: { fill?: string; hatch?: { angle: number; gap: number; width?: number }; line?: number; color?: string },
): void {
  path();
  ctx.fillStyle = opts.fill ?? PAPER;
  ctx.fill();
  if (opts.hatch) {
    ctx.save();
    path();
    ctx.clip();
    hatchLines(ctx, opts.hatch.angle, opts.hatch.gap, opts.hatch.width ?? 1.4);
    ctx.restore();
  }
  if (opts.line !== 0) {
    path();
    inkStroke(ctx, opts.line ?? 4, opts.color ?? INK);
  }
}

/** Parallel hatch lines across the whole canvas (call inside a clip). */
export function hatchLines(ctx: CanvasRenderingContext2D, angle: number, gap: number, width: number): void {
  const { width: w, height: h } = ctx.canvas;
  const len = Math.hypot(w, h);
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(angle);
  ctx.beginPath();
  for (let x = -len; x < len; x += gap) {
    ctx.moveTo(x, -len);
    ctx.lineTo(x, len);
  }
  ctx.restore();
  ctx.lineWidth = width;
  ctx.strokeStyle = INK;
  ctx.stroke();
}
