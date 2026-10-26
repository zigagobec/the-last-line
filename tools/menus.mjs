// Checks the menus: rules panel changes reach the game, help opens, WebGPU fallback message.
import { chromium } from 'playwright';
const [url, outDir] = process.argv.slice(2);
const launch = () => chromium.launch({
  channel: 'chromium-headless-shell',
  args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan', '--use-angle=vulkan', '--enable-unsafe-swiftshader'],
});
const results = [];
const check = (name, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`);
{
  const b = await launch();
  const page = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  await page.getByRole('button', { name: 'Nastavitve pravil' }).click();
  await page.getByRole('button', { name: '6×6' }).click();
  await page.getByRole('button', { name: 'Do 2 polji' }).click();
  await page.screenshot({ path: `${outDir}/settings.png` });
  await page.getByRole('button', { name: 'Nazaj' }).click();
  await page.getByRole('button', { name: 'Pravila igre' }).click();
  await page.screenshot({ path: `${outDir}/help.png` });
  await page.getByRole('button', { name: 'Razumem' }).click();
  await page.getByRole('button', { name: 'Igraj' }).click();
  await page.waitForTimeout(800);
  const yaw0 = await page.evaluate(() => window.__game.camYaw());
  await page.waitForTimeout(1000);
  const yaw1 = await page.evaluate(() => window.__game.camYaw());
  check('board stops spinning once the game starts', Math.abs(yaw1 - yaw0) < 1e-3, `${yaw0} → ${yaw1}`);
  const rules = await page.evaluate(() => window.__game.state().rules);
  check('rules panel applies size', rules.size === 6, JSON.stringify(rules));
  check('rules panel applies range', rules.range === 2);
  await page.reload();
  await page.getByRole('button', { name: 'Igraj' }).click();
  await page.waitForTimeout(300);
  const rules2 = await page.evaluate(() => window.__game.state().rules);
  check('rules persist across reload', rules2.size === 6);
  // in-game pause menu
  await page.getByRole('button', { name: 'Meni' }).click();
  check('pause menu opens', await page.getByRole('button', { name: 'Nadaljuj' }).isVisible());
  await page.getByRole('button', { name: 'Nadaljuj' }).click();
  await page.getByRole('button', { name: 'Pravila igre' }).click();
  check('in-game help opens', await page.getByRole('button', { name: 'Razumem' }).isVisible());
  await page.getByRole('button', { name: 'Razumem' }).click();
  // reset to defaults for other tests
  await page.getByRole('button', { name: 'Meni' }).click();
  await page.getByRole('button', { name: 'Glavni meni' }).click();
  await page.getByRole('button', { name: 'Nastavitve pravil' }).click();
  await page.getByRole('button', { name: 'Privzeto' }).click();
  check('no console errors', errors.length === 0, errors.join(' | '));
  await b.close();
}
{
  const b = await launch();
  const page = await b.newPage({ viewport: { width: 800, height: 600 } });
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'gpu', { get: () => undefined }));
  await page.goto(url);
  await page.waitForTimeout(800);
  const text = await page.locator('.fatal').textContent().catch(() => null);
  check('fallback message without WebGPU', !!text && text.includes('WebGPU'), text ?? '');
  await page.screenshot({ path: `${outDir}/nogpu.png` });
  await b.close();
}
console.log(results.join('\n'));
