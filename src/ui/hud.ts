import type { GameState, PlayerId } from '../game';
import type { FitBox } from '../render/camera';
import { PLAYER_CSS } from '../view/colors';
import { T, TOOL_HINT, TOOL_LABEL, type Tool } from './strings';

const ICONS: Record<Tool, string> = {
  move: '<path d="M4 13 C9 12 13 12 19 12 M14 7 L19 12 L14 17"/>',
  tree: '<path d="M12 21 V13"/><path d="M7 13 C3 13 3 8 7 8 C7 4 12 3 13 6 C16 4 20 7 18 10 C21 12 18 15 15 13 Z"/>',
  bridge: '<path d="M2 9 H22 M2 15 H22 M6 9 V15 M10 9 V15 M14 9 V15 M18 9 V15"/>',
  erase: '<path d="M8 19 L3 14 L13 4 L20 11 L12 19 Z M8 9 L15 16 M8 19 H20"/>',
  skip: '<path d="M5 6 L12 12 L5 18 Z M13 6 L20 12 L13 18 Z"/>',
};
const TOOLS: Tool[] = ['move', 'tree', 'bridge', 'erase', 'skip'];

export interface HudHandlers {
  onTool(tool: Tool): void;
  onRotateBridge(): void;
  onCamera(dir: 1 | -1): void;
  onHelp(): void;
  onMenu(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent?: HTMLElement, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  parent?.appendChild(e);
  return e;
}

export class Hud {
  readonly root: HTMLElement;
  private round: HTMLElement;
  private turn: HTMLElement;
  private sub: HTMLElement;
  private bannerEl: HTMLElement;
  private hint: HTMLElement;
  private toolbar: HTMLElement;
  private buttons = new Map<Tool, HTMLButtonElement>();
  private rotate: HTMLButtonElement;
  private bannerTimer = 0;
  private status: HTMLElement;
  private topButtons: HTMLElement;
  private toolKey = '';
  private hintUntil = 0;

  constructor(parent: HTMLElement, h: HudHandlers) {
    this.root = el('div', 'hud hidden', parent);
    const top = el('div', 'hud-top', this.root);
    const status = el('div', 'status paper', top);
    this.status = status;
    this.round = el('div', 'round', status);
    this.turn = el('div', 'turn', status);
    this.sub = el('div', 'sub', status);
    const btns = el('div', 'top-buttons', top);
    this.topButtons = btns;
    const iconBtn = (label: string, title: string, fn: () => void) => {
      const b = el('button', 'icon-btn paper', btns, label);
      b.title = title;
      b.setAttribute('aria-label', title);
      b.addEventListener('click', fn);
      return b;
    };
    iconBtn('⟲', T.camLeft, () => h.onCamera(-1));
    iconBtn('⟳', T.camRight, () => h.onCamera(1));
    iconBtn('?', 'Pravila igre', () => h.onHelp());
    iconBtn('☰', 'Meni', () => h.onMenu());

    this.bannerEl = el('div', 'banner', this.root);

    const bottom = el('div', 'hud-bottom', this.root);
    this.hint = el('div', 'hint', bottom);
    this.toolbar = el('div', 'toolbar', bottom);
    TOOLS.forEach((tool, i) => {
      const b = el(
        'button',
        `tool paper tool-${tool}`,
        this.toolbar,
        `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[tool]}</svg><span>${TOOL_LABEL[tool]}</span><kbd>${i + 1}</kbd>`,
      );
      b.addEventListener('click', () => h.onTool(tool));
      this.buttons.set(tool, b);
    });
    this.rotate = el('button', 'tool paper rotate', this.toolbar, '<span>⇄</span><kbd>R</kbd>');
    this.rotate.title = T.rotateBridge;
    this.rotate.addEventListener('click', () => h.onRotateBridge());
  }

  /** Screen area (NDC) left free between the top HUD and the toolbar, for fitting the board. */
  freeBox(): FitBox {
    const h = window.innerHeight;
    if (this.root.classList.contains('hidden') || h <= 0) return { left: -0.92, right: 0.92, bottom: -0.8, top: 0.8 };
    const ndcY = (px: number) => 1 - (2 * px) / h;
    const top = Math.max(this.status.getBoundingClientRect().bottom, this.topButtons.getBoundingClientRect().bottom);
    let bottom = this.toolbar.getBoundingClientRect().top;
    if (getComputedStyle(this.hint).display !== 'none') {
      // Reserve two hint lines so switching tools (shorter or longer hints) doesn't re-zoom the board.
      const line = parseFloat(getComputedStyle(this.hint).lineHeight) || 22;
      bottom -= 2 * line + 10;
    }
    const snap = (px: number) => Math.round(px / 4) * 4;
    return { left: -0.95, right: 0.95, top: ndcY(snap(top) + 6), bottom: ndcY(snap(bottom) - 6) };
  }

  show(visible: boolean): void {
    this.root.classList.toggle('hidden', !visible);
  }

  setState(s: GameState): void {
    this.root.style.setProperty('--pc', PLAYER_CSS[s.current]);
    this.round.textContent = T.round(s.round);
    this.turn.innerHTML = `<span class="chip"></span>${T.turn(s.current)}`;
    const marks = s.cells.filter((c) => c.marked).length;
    const me = s.players[s.current];
    const inDanger = s.cells[me.y * s.rules.size + me.x].marked;
    this.sub.textContent = inDanger ? T.danger : `${T.marked(marks)} · ${T.actsLeft(2 - s.acted)}`;
    this.sub.classList.toggle('danger', inDanger);
  }

  setTool(tool: Tool, rotatable: boolean): void {
    const key = `${tool}:${rotatable}`;
    const flashOver = this.hintUntil !== 0 && performance.now() >= this.hintUntil;
    if (key === this.toolKey && !flashOver) return;
    this.toolKey = key;
    this.hintUntil = 0;
    for (const [t, b] of this.buttons) b.classList.toggle('active', t === tool);
    this.rotate.classList.toggle('visible', tool === 'bridge' && rotatable);
    this.hint.textContent = TOOL_HINT[tool];
    this.hint.classList.remove('shake');
  }

  setBusy(busy: boolean): void {
    this.toolbar.classList.toggle('busy', busy);
  }

  flashHint(text: string, shake = true): void {
    this.hintUntil = performance.now() + 1800;
    this.hint.textContent = text;
    this.hint.classList.remove('shake');
    if (!shake) return;
    void this.hint.offsetWidth;
    this.hint.classList.add('shake');
  }

  banner(text: string, player: PlayerId | null): void {
    this.bannerEl.textContent = text;
    this.bannerEl.style.color = player === null ? '' : PLAYER_CSS[player];
    this.bannerEl.classList.remove('show');
    void this.bannerEl.offsetWidth;
    this.bannerEl.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => this.bannerEl.classList.remove('show'), 1600);
  }
}
