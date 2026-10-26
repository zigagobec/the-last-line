// Plays full games through the real UI: tool buttons + clicks on tiles, bot picks the moves.
// Usage: node tools/play.mjs <url> <outDir> [games=1] [level=greedy] [width=1280] [height=800]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const [url, outDir, gamesArg = '1', level = 'greedy', w = '1280', h = '800'] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  channel: 'chromium-headless-shell',
  args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan', '--use-angle=vulkan', '--enable-unsafe-swiftshader'],
});
const MOBILE = !!process.env.MOBILE;
const page = await browser.newPage(
  MOBILE
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : { viewport: { width: Number(w), height: Number(h) } },
);
const pick = async (tool) => {
  // The armed skip button pulses on purpose, which Playwright reads as 'not stable'.
  if (MOBILE) await page.locator(`.tool-${tool}`).tap({ force: true });
  else await page.keyboard.press(TOOL_KEY[tool]);
};
const errors = [];
if (process.env.RULES) {
  const rules = process.env.RULES;
  await page.addInitScript((r) => localStorage.setItem('the-last-line/rules', r), rules);
}
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
await page.goto(url);
await page.waitForFunction(() => window.__game && window.__game.state());
const TOOL_KEY = { move: '1', tree: '2', bridge: '3', erase: '4', skip: '5' };
const summary = [];
for (let g = 0; g < Number(gamesArg); g++) {
  if (g === 0) await page.getByRole('button', { name: 'Igraj' }).click();
  else await page.getByRole('button', { name: 'Še enkrat' }).click();
  if (MOBILE) await page.screenshot({ path: `${outDir}/mobile-start.png` });
  await page.waitForTimeout(300);
  let steps = 0;
  const counts = {};
  while (steps < 300) {
    await page.waitForFunction(() => !window.__game.busy(), null, { timeout: 15000 });
    await page.waitForTimeout(60);
    const s = await page.evaluate(() => window.__game.state());
    if (s.over) break;
    const a = await page.evaluate((lvl) => window.__game.botAction(lvl), level);
    counts[a.type] = (counts[a.type] ?? 0) + 1;
    const before = JSON.stringify([s.round, s.acted]);
    if (a.type === 'skip') {
      await pick('skip');
      await pick('skip');
    } else {
      await pick(a.type);
      const target = a.type === 'move' ? a.to : a.at;
      await page.waitForFunction(() => window.__game.camSettled(), null, { timeout: 5000 }).catch(() => {});
      let pt = await page.evaluate((p) => window.__game.clickPointFor(p), target);
      for (let turn = 0; !pt && turn < 3; turn++) {
        // Tile hidden behind sprites from this angle: rotate the camera like a player would.
        if (MOBILE) await page.getByRole('button', { name: 'Zavrti desno (E)' }).tap();
        else await page.keyboard.press('e');
        await page.waitForFunction(() => window.__game.camSettled(), null, { timeout: 5000 }).catch(() => {});
        pt = await page.evaluate((p) => window.__game.clickPointFor(p), target);
      }
      if (!pt) {
        errors.push(`game ${g} step ${steps}: tile ${JSON.stringify(target)} not clickable from any angle`);
        pt = await page.evaluate((p) => window.__game.screenOf(p), target);
      }
      if (MOBILE) {
        await page.touchscreen.tap(pt.x, pt.y);
        // Drawing actions preview on the first tap and apply on the second.
        if (a.type !== 'move') {
          await page.waitForTimeout(60);
          await page.touchscreen.tap(pt.x, pt.y);
        }
      } else {
        await page.mouse.move(pt.x, pt.y);
        await page.waitForTimeout(30);
        await page.mouse.click(pt.x, pt.y);
      }
    }
    await page.waitForTimeout(50);
    const after = await page.evaluate(() => { const st = window.__game.state(); return JSON.stringify([st.round, st.acted]); });
    if (after === before) {
      errors.push(`game ${g} step ${steps}: click for ${JSON.stringify(a)} did not apply`);
      await page.screenshot({ path: `${outDir}/stuck-${g}-${steps}.png` });
      // fall back so the game can continue
      await page.evaluate((act) => window.__game.dispatch(act), a);
    }
    if (steps % 12 === 0) await page.screenshot({ path: `${outDir}/g${g}-s${String(steps).padStart(3, '0')}.png` });
    steps++;
  }
  await page.waitForTimeout(800);
  const s = await page.evaluate(() => window.__game.state());
  await page.screenshot({ path: `${outDir}/g${g}-end.png` });
  if (!(await page.getByRole('button', { name: 'Še enkrat' }).isVisible())) errors.push(`game ${g}: end screen not shown`);
  summary.push({ game: g, seed: s.seed, rounds: s.round, winner: s.winner, steps, counts });
}
console.log(JSON.stringify(summary, null, 1));
console.log(errors.length ? `ISSUES:\n${errors.join('\n')}` : 'no errors');
await browser.close();
