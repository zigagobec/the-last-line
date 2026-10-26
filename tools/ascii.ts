/* Headless play in ASCII: npx vite-node tools/ascii.ts -- <seed> "<actions>" [size] [range]
 * actions: m x,y (move) | t x,y (tree) | b x,y H|V (bridge) | e x,y (erase) | s (skip), separated by ';' */
import { applyAction, cell, createGame, defaultRules, moveTargets, type Action, type GameState, type Range } from '../src/game';

declare const process: { argv: string[] };
// vite-node passes [node, vite-node, ...args]
const args = process.argv.slice(2).filter((a) => a !== '--');
const [seedArg, script = '', sizeArg = '8', rangeArg = 'any'] = args;
const range: Range = rangeArg === '1' ? 1 : rangeArg === '2' ? 2 : 'any';
let s = createGame({ ...defaultRules(Number(sizeArg)), range }, Number(seedArg));

function draw(st: GameState): string {
  const n = st.rules.size;
  const rows = ['   ' + Array.from({ length: n }, (_, x) => x).join(' ')];
  for (let y = 0; y < n; y++) {
    let r = `${y}  `;
    for (let x = 0; x < n; x++) {
      const c = cell(st, { x, y });
      const p = st.players.findIndex((pl, i) => !st.fallen[i] && pl.x === x && pl.y === y);
      let ch = c.land ? (c.tree ? 'T' : '.') : c.bridge ? (c.bridge === 'H' ? '=' : '‖') : ' ';
      if (p >= 0) ch = p === 0 ? 'B' : 'R';
      if (c.marked) ch = ch === '.' ? '!' : ch.toLowerCase();
      r += ch + ' ';
    }
    rows.push(r);
  }
  return rows.join('\n');
}

const parse = (t: string): Action => {
  const [k, xy, d] = t.trim().split(/\s+/);
  const [x, y] = (xy ?? '0,0').split(',').map(Number);
  switch (k) {
    case 'm': return { type: 'move', to: { x, y } };
    case 't': return { type: 'tree', at: { x, y } };
    case 'b': return { type: 'bridge', at: { x, y }, dir: d === 'V' ? 'V' : 'H' };
    case 'e': return { type: 'erase', at: { x, y } };
    default: return { type: 'skip' };
  }
};

for (const t of script.split(';').filter((x) => x.trim())) {
  const who = s.current === 0 ? 'B' : 'R';
  try {
    const r = applyAction(s, parse(t));
    s = r.state;
    const ero = r.events.find((e) => e.type === 'erosion');
    console.log(`${who}: ${t.trim()}${ero && ero.type === 'erosion' ? `  → erosion removed ${ero.removed.length}, trees ${ero.treesDestroyed.length}, fell ${JSON.stringify(ero.fell)}` : ''}`);
  } catch {
    console.log(`${who}: ${t.trim()}  ✗ ILLEGAL`);
    break;
  }
}
console.log(`\nround ${s.round}, ${s.current === 0 ? 'BLUE' : 'RED'} to act (${2 - s.acted} left)${s.over ? `  GAME OVER winner=${s.winner}` : ''}`);
console.log('legend: B/R rats (lowercase = on marked), T tree (t = marked tree), ! marked land, = ‖ bridges, blank gap');
console.log(draw(s));
if (!s.over) console.log('moves:', moveTargets(s).map((m) => `${m.to.x},${m.to.y}${m.viaBridge ? '(bridge)' : ''}`).join(' '));
