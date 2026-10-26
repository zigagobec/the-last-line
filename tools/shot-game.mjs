// Screenshot an in-game view (menu dismissed): node tools/shot-game.mjs <url> <out> [w] [h] [mobile]
import { chromium } from 'playwright';
const [url, out, w = '1280', h = '800', mobile] = process.argv.slice(2);
const browser = await chromium.launch({
  channel: 'chromium-headless-shell',
  args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan', '--use-angle=vulkan', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage(mobile ? { viewport: { width: Number(w), height: Number(h) }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: Number(w), height: Number(h) } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url);
await page.getByRole('button', { name: 'Igraj' }).click();
await page.waitForTimeout(2500);
await page.screenshot({ path: out });
console.log(errors.length ? errors.join('\n') : 'no errors');
await browser.close();
