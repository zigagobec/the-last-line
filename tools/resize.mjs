// Resizes the viewport mid-game and checks rendering keeps working (no console errors).
import { chromium } from 'playwright';
const [url, out] = process.argv.slice(2);
const browser = await chromium.launch({
  channel: 'chromium-headless-shell',
  args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan', '--use-angle=vulkan', '--enable-unsafe-swiftshader'],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
await page.goto(url);
await page.waitForFunction(() => window.__game && window.__game.state());
await page.getByRole('button', { name: 'Igraj' }).click();
await page.waitForTimeout(300);
const ok = await page.evaluate(() => window.__game.dispatch(window.__game.botAction()));
if (!ok) errors.push('mid-game action was rejected');
for (const [w, h] of [[390, 844], [1600, 900], [800, 1200], [1280, 800]]) {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(400);
}
// Background the tab for a while (rAF stops), then come back mid-animation.
const other = await page.context().newPage();
await other.bringToFront();
await other.waitForTimeout(1500);
await page.bringToFront();
await page.waitForTimeout(1500);
const after = await page.evaluate(() => ({ busy: window.__game.busy(), acted: window.__game.state().acted }));
if (after.busy) errors.push('animation stuck after returning to the tab');
const ok2 = await page.evaluate(() => window.__game.dispatch(window.__game.botAction()));
if (!ok2) errors.push('input rejected after returning to the tab');
const size = await page.evaluate(() => { const c = document.getElementById('gfx'); return [c.width, c.height]; });
await page.screenshot({ path: out });
console.log('canvas', size, errors.length ? errors.join('\n') : 'no errors');
await browser.close();
