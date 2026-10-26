// Phone screenshot with the bridge tool picked (checks the rotate badge and toolbar layout).
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
const [url, out] = process.argv.slice(2);
const scen = JSON.parse(execFileSync('npx', ['vite-node', 'tools/scenarios.ts'], { encoding: 'utf8' }));
const browser = await chromium.launch({ channel: 'chromium-headless-shell', args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan', '--use-angle=vulkan', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await page.goto(url);
await page.waitForFunction(() => window.__game);
await page.evaluate((s) => window.__game.load(s), scen.ghostBridges);
await page.waitForTimeout(800);
await page.locator('.tool-bridge').tap({ force: true });
await page.waitForTimeout(800);
await page.screenshot({ path: out });
await browser.close();
