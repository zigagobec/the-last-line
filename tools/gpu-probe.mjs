import { chromium } from 'playwright';
const variants = [
  { name: 'headless-shell default', opts: { args: ['--enable-unsafe-webgpu'] } },
  { name: 'headless-shell swiftshader', opts: { args: ['--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader', '--enable-features=Vulkan'] } },
  { name: 'chromium new headless vulkan', opts: { channel: 'chromium', args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-angle=vulkan'] } },
  { name: 'chromium new headless swiftshader', opts: { channel: 'chromium', args: ['--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader', '--enable-features=Vulkan'] } },
];
for (const v of variants) {
  try {
    const b = await chromium.launch(v.opts);
    const p = await b.newPage();
    await p.goto('http://localhost:8765/');
    const r = await p.evaluate(async () => {
      if (!navigator.gpu) return 'no navigator.gpu';
      const a = await navigator.gpu.requestAdapter();
      if (!a) return 'no adapter';
      const info = a.info || {};
      const d = await a.requestDevice();
      return `adapter ok: ${info.vendor} ${info.architecture} ${info.description} device=${!!d}`;
    });
    console.log(v.name, '->', r);
    await b.close();
  } catch (e) { console.log(v.name, 'ERR', e.message.split('\n')[0]); }
}
