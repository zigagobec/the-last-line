// Screenshots of the menus on a phone-sized screen.
import { chromium } from 'playwright';
const [url, outDir] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chromium-headless-shell', args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan', '--use-angle=vulkan', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await page.goto(url);
await page.waitForTimeout(1500);
await page.screenshot({ path: `${outDir}/m-start.png` });
await page.getByRole('button', { name: 'Pravila igre' }).tap();
await page.waitForTimeout(3000);
console.log('help card opacity', await page.locator('.card').evaluate((e) => getComputedStyle(e).opacity), await page.locator('.card').evaluate((e) => e.getAnimations().map((a) => a.playState).join(',')));
await page.screenshot({ path: `${outDir}/m-help.png` });
await page.getByRole('button', { name: 'Razumem' }).tap();
await page.getByRole('button', { name: 'Nastavitve pravil' }).tap();
await page.waitForTimeout(600);
await page.screenshot({ path: `${outDir}/m-settings.png` });
await browser.close();
