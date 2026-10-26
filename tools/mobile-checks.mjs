// Touch-specific checks: two-tap skip, two-tap drawing with a preview in between.
import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chromium-headless-shell', args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan', '--use-angle=vulkan', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const results = [];
const check = (name, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
await page.goto(process.argv[2]);
await page.getByRole('button', { name: 'Igraj' }).tap();
await page.waitForFunction(() => !window.__game.busy());
await page.waitForTimeout(500);
const acted = () => page.evaluate(() => window.__game.state().acted);

// Skip needs two taps.
await page.locator('.tool-skip').tap({ force: true });
check('first skip tap only arms', (await acted()) === 0);
await page.locator('.tool-skip').tap({ force: true });
await page.waitForTimeout(300);
check('second skip tap skips', (await acted()) === 1);
await page.waitForFunction(() => !window.__game.busy());
await page.waitForTimeout(300);

// Drawing a tree needs two taps on the same tile; the first shows a preview.
// Pick the tool first: what a point targets depends on the tool (move/bridge look through trees).
await page.locator('.tool-tree').tap({ force: true });
const s = await page.evaluate(() => window.__game.state());
const n = s.rules.size;
let target = null;
for (let y = 0; y < n && !target; y++) for (let x = 0; x < n && !target; x++) {
  const c = s.cells[y * n + x];
  const occupied = s.players.some((p) => p.x === x && p.y === y);
  if (c.land && !c.tree && !occupied) {
    const pt = await page.evaluate((p) => window.__game.clickPointFor(p), { x, y });
    if (pt) target = { x, y, pt };
  }
}
const actedBefore = await acted();
await page.touchscreen.tap(target.pt.x, target.pt.y);
await page.waitForTimeout(250);
const afterFirst = await page.evaluate((t) => window.__game.state().cells[t.y * window.__game.state().rules.size + t.x].tree, target);
check('first tap on a tile only previews', afterFirst === false && (await acted()) === actedBefore);
await page.screenshot({ path: `${process.argv[3]}/touch-preview.png` });
await page.touchscreen.tap(target.pt.x, target.pt.y);
await page.waitForTimeout(250);
const afterSecond = await page.evaluate((t) => window.__game.state().cells[t.y * window.__game.state().rules.size + t.x].tree, target);
check('second tap on the same tile draws', afterSecond === true);
check('no console errors', errors.length === 0, errors.join(' | '));
console.log(results.join('\n'));
await browser.close();
