/* Headless balance simulation: `npm run sim -- --games 500` */
import { applyAction, cell, cloneState, createGame, defaultRules, moveTargets, Rng } from '../game';
import type { GameState, PlayerId, Rules } from '../game';
import { chooseAction, type BotLevel } from './bot';

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : fallback;
}

/** A rat marked at round start with no unmarked tile to step to is doomed by the dice alone. */
function doomedAtStart(s: GameState): PlayerId[] {
  const out: PlayerId[] = [];
  for (const id of [0, 1] as const) {
    if (!cell(s, s.players[id]).marked) continue;
    const t = cloneState(s);
    t.current = id;
    if (!moveTargets(t).some((m) => !cell(t, m.to).marked)) out.push(id);
  }
  return out;
}

interface Stats {
  p1: number;
  p2: number;
  draw: number;
  rounds: number[];
  diceDooms: number;
  actions: Record<string, number>;
}

function simulate(rules: Rules, games: number, bots: [BotLevel, BotLevel]): Stats {
  const st: Stats = { p1: 0, p2: 0, draw: 0, rounds: [], diceDooms: 0, actions: {} };
  for (let g = 0; g < games; g++) {
    let s = createGame(rules, 1000 + g);
    const rng = new Rng(g * 7919 + 1);
    let lastRound = 0;
    let doomed = false;
    while (!s.over && s.round <= 500) {
      if (s.round !== lastRound) {
        lastRound = s.round;
        if (doomedAtStart(s).length) doomed = true;
      }
      const a = chooseAction(s, rng, bots[s.current]);
      st.actions[a.type] = (st.actions[a.type] ?? 0) + 1;
      s = applyAction(s, a).state;
    }
    if (doomed) st.diceDooms++;
    if (s.winner === 0) st.p1++;
    else if (s.winner === 1) st.p2++;
    else st.draw++;
    st.rounds.push(s.round);
  }
  return st;
}

function report(label: string, st: Stats, games: number) {
  const r = [...st.rounds].sort((a, b) => a - b);
  const mean = r.reduce((a, b) => a + b, 0) / r.length;
  const pct = (n: number) => `${((100 * n) / games).toFixed(1)}%`;
  const total = Object.values(st.actions).reduce((a, b) => a + b, 0);
  const mix = Object.entries(st.actions)
    .map(([k, v]) => `${k} ${pct((v * games) / total)}`)
    .join(', ');
  console.log(
    `${label.padEnd(34)} P1 ${pct(st.p1).padStart(6)}  P2 ${pct(st.p2).padStart(6)}  draw ${pct(st.draw).padStart(6)}  ` +
      `rounds mean ${mean.toFixed(1)} median ${r[r.length >> 1]} max ${r[r.length - 1]}  dice-doomed games ${pct(st.diceDooms)}\n    actions: ${mix}`,
  );
}

const games = arg('games', 300);
const variants: [string, Partial<Rules>][] = [
  ['default (2 edge + 1 rnd, any)', {}],
  ['range 2', { range: 2 }],
  ['range 1', { range: 1 }],
  ['3 edge + 0 rnd', { edgeErosion: 3, randomErosion: 0 }],
  ['2 edge + 0 rnd', { edgeErosion: 2, randomErosion: 0 }],
  ['1 edge + 1 rnd', { edgeErosion: 1, randomErosion: 1 }],
];
console.log(`greedy vs greedy, ${games} games per variant, 8x8\n`);
for (const [label, patch] of variants) {
  report(label, simulate({ ...defaultRules(8), ...patch }, games, ['greedy', 'greedy']), games);
}
console.log('');
report('greedy(P1) vs random(P2)', simulate(defaultRules(8), games, ['greedy', 'random']), games);
