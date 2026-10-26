import { defaultRules, type GameState, type Range, type Rules } from '../game';
import { drawRat } from '../render/draw/sprites';
import { PLAYER_CSS } from '../view/colors';
import { PLAYER_NAME } from './strings';

const STORAGE_KEY = 'the-last-line/rules';

const WIN_LINES = [
  'Zadnja črta je tvoja.',
  'Svinčnik je bil tokrat močnejši od radirke.',
  'Nasprotnik je ostal brez tal pod nogami.',
  'Ta košček papirja je zdaj samo tvoj. Vsaj še nekaj časa.',
  'Podgana na papirju, kralj na plošči.',
  'Erozija je tokrat raje pojedla nasprotnika.',
];
const DRAW_LINES = ['Praznina ni izbirčna.', 'Obe podgani sta zdrsnili z zadnje črte.', 'Papir je zmagal.'];

export interface MenuHandlers {
  /** Start a new game; `seed` undefined = random. */
  onStart(rules: Rules, seed: number | undefined): void;
  onResume(): void;
  onShowMenu(): void;
}

/** Seed from user text (settings field or ?seed=): a non-negative 32-bit integer, or undefined for random. */
export function parseSeed(text: string | null): number | undefined {
  if (text === null || !text.trim()) return undefined;
  const n = Number(text.trim());
  if (!Number.isFinite(n)) return undefined;
  return Math.abs(Math.floor(n)) % 2 ** 32;
}

export function loadRules(): Rules {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return sanitizeRules(JSON.parse(raw));
  } catch {
    /* storage unavailable or corrupt: fall back to defaults */
  }
  return defaultRules();
}

function saveRules(r: Rules): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(r));
  } catch {
    /* private mode etc. */
  }
}

const clampInt = (v: unknown, lo: number, hi: number, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};

/** Coerce stored or edited rules into a playable set (at least one tile must erode each round). */
export function sanitizeRules(r: Partial<Rules>): Rules {
  const size = [6, 8, 10].includes(Number(r.size)) ? Number(r.size) : 8;
  const base = defaultRules(size);
  const range: Range = r.range === 1 || r.range === 2 ? r.range : 'any';
  let edge = clampInt(r.edgeErosion, 0, 4, base.edgeErosion);
  const random = clampInt(r.randomErosion, 0, 4, base.randomErosion);
  if (edge + random === 0) edge = 1;
  return { ...base, edgeErosion: edge, randomErosion: random, range };
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent?: HTMLElement, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  parent?.appendChild(e);
  return e;
}

function button(parent: HTMLElement, text: string, cls: string, fn: () => void): HTMLButtonElement {
  const b = el('button', `btn paper ${cls}`, parent, text);
  b.addEventListener('click', fn);
  return b;
}

export class Menu {
  private layer: HTMLElement;
  private rules: Rules;
  private seedText = '';
  private current: HTMLElement | null = null;

  constructor(private readonly h: MenuHandlers) {
    this.layer = el('div', 'menu-layer', document.body);
    this.rules = loadRules();
  }

  get isOpen(): boolean {
    return this.current !== null;
  }

  private open(card: HTMLElement): void {
    this.layer.replaceChildren(card);
    this.layer.classList.add('open');
    this.current = card;
  }

  close(): void {
    this.layer.classList.remove('open');
    this.layer.replaceChildren();
    this.current = null;
  }

  private card(cls = ''): HTMLElement {
    return el('div', `card paper ${cls}`);
  }

  private seed(): number | undefined {
    return parseSeed(this.seedText);
  }

  showStart(): void {
    const c = this.card('start');
    el('h1', 'title', c, 'The Last Line');
    el('div', 'tagline', c, 'Dve podgani, en svinčnik, ena radirka in svet, ki izginja.');
    const rats = el('div', 'rats', c);
    for (const [i, color] of PLAYER_CSS.entries()) {
      const r = drawRat(color, i ? 23 : 11);
      r.className = i ? 'flip' : '';
      rats.appendChild(r);
    }
    el('div', 'subtitle', c, 'Strategija za dva igralca na eni napravi');
    const btns = el('div', 'buttons', c);
    button(btns, 'Igraj', 'primary', () => {
      this.close();
      this.h.onStart(this.rules, this.seed());
    });
    button(btns, 'Pravila igre', '', () => this.showHelp(() => this.showStart()));
    button(btns, 'Nastavitve pravil', '', () => this.showSettings());
    this.open(c);
  }

  showSettings(): void {
    const c = this.card('settings');
    el('h2', '', c, 'Nastavitve pravil');
    el('p', 'note', c, 'Prototip: preizkusite različice in poglejte, kaj je najbolj zabavno.');
    const form = el('div', 'form', c);

    const row = (label: string, help: string) => {
      const r = el('div', 'row', form);
      const l = el('div', 'label', r);
      el('div', '', l, label);
      el('div', 'row-help', l, help);
      return el('div', 'control', r);
    };
    const segmented = <T,>(parent: HTMLElement, options: [T, string][], get: () => T, set: (v: T) => void) => {
      const g = el('div', 'seg', parent);
      const render = () => {
        g.replaceChildren();
        for (const [v, text] of options) {
          const b = el('button', `seg-btn${get() === v ? ' on' : ''}`, g, text);
          b.addEventListener('click', () => {
            set(v);
            render();
          });
        }
      };
      render();
    };
    const update = (patch: Partial<Rules>) => {
      this.rules = sanitizeRules({ ...this.rules, ...patch });
      saveRules(this.rules);
    };

    segmented(row('Velikost plošče', 'Manjša plošča pomeni krajšo in bolj napeto igro.'), [[6, '6×6'], [8, '8×8'], [10, '10×10']], () => this.rules.size, (v) => update({ size: v }));
    const counts: [number, string][] = [0, 1, 2, 3, 4].map((n) => [n, String(n)]);
    let rerender = () => {};
    const edgeCtl = row('Robna polja na krog', 'Koliko polj ob robu plošče izgine vsak krog.');
    const randCtl = row('Naključna polja na krog', 'Koliko polj kjerkoli na plošči izgine vsak krog.');
    rerender = () => {
      edgeCtl.replaceChildren();
      randCtl.replaceChildren();
      segmented(edgeCtl, counts, () => this.rules.edgeErosion, (v) => {
        update({ edgeErosion: v });
        rerender();
      });
      segmented(randCtl, counts, () => this.rules.randomErosion, (v) => {
        update({ randomErosion: v });
        rerender();
      });
    };
    rerender();
    segmented(
      row('Doseg risanja in radiranja', 'Kako daleč od svoje podgane lahko rišeš drevesa in mostove ali radiraš.'),
      [['any', 'Kjerkoli'], [2, 'Do 2 polji'], [1, 'Sosednja']] as [Range, string][],
      () => this.rules.range,
      (v) => update({ range: v }),
    );
    const seedCtl = row('Seed postavitve', 'Prazno pomeni naključno. Ista številka da isto začetno ploščo.');
    const input = el('input', 'seed-input', seedCtl);
    input.type = 'text';
    input.inputMode = 'numeric';
    input.placeholder = 'naključno';
    input.value = this.seedText;
    input.addEventListener('input', () => (this.seedText = input.value.replace(/[^0-9]/g, '')));

    const btns = el('div', 'buttons', c);
    button(btns, 'Privzeto', '', () => {
      this.rules = defaultRules();
      saveRules(this.rules);
      this.seedText = '';
      this.showSettings();
    });
    button(btns, 'Nazaj', 'primary', () => this.showStart());
    this.open(c);
  }

  showHelp(back: () => void): void {
    const c = this.card('help');
    el('h2', '', c, 'Pravila igre');
    const sec = (title: string, ...lines: string[]) => {
      const s = el('div', 'sec', c);
      el('h3', '', s, title);
      for (const line of lines) el('p', '', s, line);
    };
    sec('Cilj', 'Ostani na plošči dlje od nasprotnika. Svet se vsak krog krči, zato ujemi nasprotnika na polju brez izhoda.');
    sec(
      'Potek kroga',
      'Na začetku kroga se nekaj polj označi z rdečo šrafuro in opozorilno tablo. Ta polja bodo izginila.',
      'Vsak igralec nato naredi eno potezo. Kdo začne, se menja vsak krog.',
      'Na koncu kroga označena polja izginejo. Če na takem polju raste drevo, izgine samo drevo, polje pa ostane.',
    );
    sec(
      'Poteze',
      'Premik: na sosednje polje gor, dol, levo ali desno. Na drevo in na nasprotnika ne moreš.',
      'Most prečkaš tako, da klikneš polje na drugi strani vrzeli.',
      'Drevo: nariši ga na prazno polje. Je ovira za oba in enkrat zaščiti polje pred erozijo.',
      'Most: nariši ga čez vrzel, ki ima kopno na obeh straneh.',
      'Radirka: zradiraj katerokoli drevo ali most.',
      'Preskoči: ne narediš nič. Klikni dvakrat.',
    );
    sec('Konec', 'Kdor ob koncu kroga stoji na polju, ki izgine, pade in izgubi. Če padeta oba, je neodločeno.');
    sec(
      'Upravljanje',
      'Izberi orodje spodaj (ali tipke 1–5) in klikni polje. Obarvana polja pokažejo, kam lahko klikneš.',
      'Na telefonu tapni orodje in nato polje. Drevo, most in radirka pokažejo predogled, drugi tap ga potrdi.',
      'Vleci z miško ali prstom, da zavrtiš ploščo. Kolešček ali dva prsta za povečavo. Q/E zavrtita za četrt obrata. Most obrneš s ponovnim klikom na Most ali s tipko R.',
    );
    const btns = el('div', 'buttons', c);
    button(btns, 'Razumem', 'primary', back);
    this.open(c);
  }

  showPause(): void {
    const c = this.card('pause');
    el('h2', '', c, 'Pavza');
    const btns = el('div', 'buttons column', c);
    button(btns, 'Nadaljuj', 'primary', () => {
      this.close();
      this.h.onResume();
    });
    button(btns, 'Pravila igre', '', () => this.showHelp(() => this.showPause()));
    button(btns, 'Nova igra', '', () => {
      this.close();
      this.h.onStart(this.rules, this.seed());
    });
    button(btns, 'Glavni meni', '', () => {
      this.h.onShowMenu();
      this.showStart();
    });
    this.open(c);
  }

  showHelpInGame(): void {
    this.showHelp(() => {
      this.close();
      this.h.onResume();
    });
  }

  showEnd(s: GameState): void {
    const c = this.card('end');
    const draw = s.winner === 'draw';
    const winner = draw ? null : (s.winner as 0 | 1);
    const big = el('div', 'win-title', c, draw ? 'Neodločeno!' : 'ZMAGA!');
    if (winner !== null) big.style.color = PLAYER_CSS[winner];
    const rats = el('div', 'rats', c);
    if (winner !== null) {
      const r = drawRat(PLAYER_CSS[winner], winner ? 23 : 11);
      r.className = 'winner';
      rats.appendChild(r);
    } else {
      for (const [i, color] of PLAYER_CSS.entries()) {
        const r = drawRat(color, i ? 23 : 11);
        r.className = `fallen ${i ? 'flip' : ''}`;
        rats.appendChild(r);
      }
    }
    el('div', 'win-name', c, draw ? 'Obe podgani sta padli v praznino.' : `${PLAYER_NAME[winner!]} je zadnja na liniji!`);
    const lines = draw ? DRAW_LINES : WIN_LINES;
    el('div', 'win-line', c, lines[(s.seed + s.round) % lines.length]);
    el('div', 'win-meta', c, `Krogov: ${s.round} · seed ${s.seed}`);
    const btns = el('div', 'buttons', c);
    button(btns, 'Še enkrat', 'primary', () => {
      this.close();
      this.h.onStart(this.rules, undefined);
    });
    button(btns, 'Meni', '', () => {
      this.h.onShowMenu();
      this.showStart();
    });
    this.open(c);
  }
}
