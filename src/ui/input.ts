import type { OrbitCamera } from '../render/camera';

export interface PointerHandlers {
  /** Pointer position in normalised device coordinates, or null when it left the canvas. */
  onHover(ndc: [number, number] | null): void;
  onClick(ndc: [number, number]): void;
}

const DRAG_THRESHOLD = 6;

/** Mouse/touch on the canvas: tap = click, drag = orbit, wheel/pinch = zoom. */
export class PointerInput {
  private pointers = new Map<number, { x: number; y: number; startX: number; startY: number }>();
  private dragging = false;
  private pinchDist = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly cam: OrbitCamera,
    private readonly h: PointerHandlers,
  ) {
    canvas.addEventListener('pointerdown', this.down);
    canvas.addEventListener('pointermove', this.move);
    canvas.addEventListener('pointerup', this.up);
    canvas.addEventListener('pointercancel', this.cancel);
    canvas.addEventListener('lostpointercapture', this.cancel);
    canvas.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse') h.onHover(null);
    });
    canvas.addEventListener('wheel', this.wheel, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private ndc(e: PointerEvent | { clientX: number; clientY: number }): [number, number] {
    const r = this.canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 2 - 1, 1 - ((e.clientY - r.top) / r.height) * 2];
  }

  private down = (e: PointerEvent) => {
    this.canvas.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY });
    if (this.pointers.size === 2) {
      this.dragging = true;
      this.pinchDist = this.spread();
    }
  };

  private spread(): number {
    const [a, b] = [...this.pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private move = (e: PointerEvent) => {
    const p = this.pointers.get(e.pointerId);
    if (!p) {
      if (e.pointerType === 'mouse') this.h.onHover(this.ndc(e));
      return;
    }
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (this.pointers.size === 2) {
      const d = this.spread();
      if (this.pinchDist > 0 && d > 0) this.cam.zoom(this.pinchDist / d);
      this.pinchDist = d;
      this.cam.orbit((-dx / 2) * 0.008, (dy / 2) * 0.006);
      return;
    }
    if (!this.dragging && Math.hypot(e.clientX - p.startX, e.clientY - p.startY) > DRAG_THRESHOLD) this.dragging = true;
    if (this.dragging) this.cam.orbit(-dx * 0.008, dy * 0.006);
    else if (e.pointerType === 'mouse') this.h.onHover(this.ndc(e));
  };

  private up = (e: PointerEvent) => {
    const p = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (!p) return;
    if (!this.dragging && e.button === 0) {
      const ndc = this.ndc(e);
      this.h.onHover(ndc);
      this.h.onClick(ndc);
    }
    if (this.pointers.size === 0) {
      this.dragging = false;
      if (e.pointerType !== 'mouse') this.h.onHover(null);
    }
  };

  private cancel = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size === 0) this.dragging = false;
  };

  private wheel = (e: WheelEvent) => {
    e.preventDefault();
    this.cam.zoom(Math.exp(e.deltaY * 0.0012));
  };
}
