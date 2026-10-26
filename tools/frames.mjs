// Captures frames while an animation plays: node tools/frames.mjs <url> <outPrefix> <actionsJson> [count] [intervalMs]
import { chromium } from 'playwright';
const [url, out, actionsJson, count = '6', interval = '250'] = process.argv.slice(2);
const browser = await chromium.launch({
  channel: 'chromium-headless-shell',
  args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan', '--use-angle=vulkan', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url);
await page.waitForFunction(() => window.__game && window.__game.state());
const actions = JSON.parse(actionsJson);
for (let i = 0; i < actions.length; i++) {
  await page.waitForFunction(() => !window.__game.busy());
  const ok = await page.evaluate((a) => window.__game.dispatch(a === 'bot' ? window.__game.botAction() : a), actions[i]);
  if (!ok) errors.push(`action ${i} rejected`);
}
for (let f = 0; f < Number(count); f++) {
  await page.screenshot({ path: `${out}${f}.png` });
  await page.waitForTimeout(Number(interval));
}
console.log(errors.length ? errors.join('\n') : 'no errors');
await browser.close();
