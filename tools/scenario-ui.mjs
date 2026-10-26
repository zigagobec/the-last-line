// Plays hand-made scenarios through the real UI (keys + clicks) and checks the outcomes.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
const [url, outDir] = process.argv.slice(2);
const scen = JSON.parse(execFileSync('npx', ['vite-node', 'tools/scenarios.ts'], { encoding: 'utf8' }));
const browser = await chromium.launch({
  channel: 'chromium-headless-shell',
  args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan', '--use-angle=vulkan', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url);
await page.waitForFunction(() => window.__game);
const results = [];
const check = (name, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
const idle = () => page.waitForFunction(() => !window.__game.busy(), null, { timeout: 15000 });
const state = () => page.evaluate(() => window.__game.state());
const cell = (s, x, y) => s.cells[y * s.rules.size + x];
async function clickTile(x, y) {
  const pt = await page.evaluate((p) => window.__game.clickPointFor(p), { x, y });
  if (!pt) throw new Error(`tile ${x},${y} not clickable`);
  await page.mouse.move(pt.x, pt.y);
  await page.waitForTimeout(40);
  await page.mouse.click(pt.x, pt.y);
}
async function load(name) {
  await page.evaluate((s) => window.__game.load(s), scen[name]);
  await page.waitForTimeout(300);
  await idle();
}
const skip = async () => { await page.keyboard.press('5'); await page.keyboard.press('5'); };

// 1. Bridge crossing by clicking the far side with the default Move tool.
await load('bridgeCross');
await clickTile(2, 1);
await idle();
let s = await state();
check('bridge crossing via click', s.players[0].x === 2 && s.players[0].y === 1, JSON.stringify(s.players[0]));
await page.screenshot({ path: `${outDir}/1-bridge.png` });

// 2. Saving a marked tile with a tree.
await load('saveTile');
await page.keyboard.press('2');
await clickTile(2, 2);
await idle();
s = await state();
check('tree drawn on marked tile', cell(s, 2, 2).tree === true);
await skip();
await idle();
s = await state();
check('tree absorbed erosion, tile kept', cell(s, 2, 2).land === true && cell(s, 2, 2).tree === false && s.round === 2);

// 3. Trap: block the last exit, opponent falls, blue wins.
await load('trapWin');
await page.keyboard.press('2');
await clickTile(2, 3);
await idle();
await page.screenshot({ path: `${outDir}/3-trapped.png` });
s = await state();
check('red has no moves after trap', s.current === 1);
await clickTile(2, 3); // red tries to walk into the tree with the Move tool: should be refused
await page.waitForTimeout(200);
s = await state();
check('illegal click refused', s.acted === 1 && s.current === 1);
await skip();
await idle();
await page.waitForTimeout(500);
s = await state();
check('trapped player fell, blue wins', s.over && s.winner === 0, `winner=${s.winner}`);
check('win screen shows', await page.getByText('ZMAGA!').isVisible());
await page.screenshot({ path: `${outDir}/3-win.png` });

// 4. Both fall in the same erosion: draw.
await load('draw');
await page.keyboard.press('2');
await clickTile(3, 4);
await idle();
await page.keyboard.press('2');
await clickTile(1, 0);
await idle();
await page.waitForTimeout(500);
s = await state();
check('both fall = draw', s.over && s.winner === 'draw', `winner=${s.winner}`);
check('draw screen shows', await page.getByText('Neodločeno!').isVisible());
await page.screenshot({ path: `${outDir}/4-draw.png` });

// 5. Bridge orientation toggle with R, then erase it.
await load('bridgeRotateErase');
await page.keyboard.press('3');
await page.waitForTimeout(150);
check('rotate button visible for two-way gap', await page.locator('.tool.rotate.visible').isVisible());
await page.keyboard.press('r');
await clickTile(2, 2);
await idle();
s = await state();
check('R rotates bridge to V', cell(s, 2, 2).bridge === 'V', String(cell(s, 2, 2).bridge));
await page.screenshot({ path: `${outDir}/5-bridgeV.png` });
await page.keyboard.press('4');
await clickTile(2, 2);
await idle();
s = await state();
check('eraser removes bridge', cell(s, 2, 2).bridge === null);

// 6. Clicks during an animation are ignored.
await load('saveTile');
await page.keyboard.press('2');
await clickTile(3, 3);
const busyNow = await page.evaluate(() => window.__game.busy());
await page.keyboard.press('2');
await clickTile(1, 1);
s = await state();
check('click during animation ignored', busyNow && s.acted === 1 && !cell(s, 1, 1).tree, `busy=${busyNow}`);

// 7. Erase tool: hovering a tree canopy is stable and a canopy click erases that tree.
await load('eraseCanopy');
await page.keyboard.press('4');
for (const [tx, ty] of [[2, 2], [3, 3]]) {
  const top = await page.evaluate((p) => window.__game.screenOf(p), { x: tx, y: ty });
  const cx = top.x;
  const cy = top.y - 45; // up into the canopy, above the tile
  await page.mouse.move(cx, cy);
  const cursors = [];
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(40);
    cursors.push(await page.evaluate(() => document.getElementById('gfx').style.cursor));
  }
  check(`erase hover on canopy ${tx},${ty} is stable`, cursors.every((c) => c === 'pointer'), cursors.join(','));
}
{
  const top = await page.evaluate((p) => window.__game.screenOf(p), { x: 3, y: 3 });
  await page.mouse.click(top.x, top.y - 45);
  await idle();
  s = await state();
  check('canopy click erases the tree', cell(s, 3, 3).tree === false);
}

// 8. Bridge previews are drawn in the player's colour (not black).
await load('ghostBridges');
await page.keyboard.press('3');
await page.mouse.move(5, 5);
await page.waitForTimeout(400);
await page.screenshot({ path: `${outDir}/8-ghosts.png` });
{
  const g = await page.evaluate((p) => window.__game.screenOf(p), { x: 2, y: 3 });
  const shot = await page.screenshot({ clip: { x: g.x - 6, y: g.y - 3, width: 12, height: 6 } });
  const { PNG } = await import('pngjs').catch(() => ({ PNG: null }));
  if (PNG) {
    const img = PNG.sync.read(shot);
    let blue = 0, dark = 0;
    for (let i = 0; i < img.data.length; i += 4) {
      const [r, gg, b] = [img.data[i], img.data[i + 1], img.data[i + 2]];
      if (b > r + 30) blue++;
      if (r + gg + b < 150) dark++;
    }
    check('ghost bridge is tinted, not black', blue > dark, `blue=${blue} dark=${dark}`);
  }
}

check('no console errors', errors.length === 0, errors.join(' | '));
console.log(results.join('\n'));
await browser.close();
