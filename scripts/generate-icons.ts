// `npm run icons`: renders the PNG app icons from the SVGs in assets/icons, using the Chromium
// that Playwright already installs (no image library needed). Commit the output.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const ICONS = [
  { svg: 'assets/icons/icon.svg', out: 'public/icons/icon-192.png', size: 192 },
  { svg: 'assets/icons/icon.svg', out: 'public/icons/icon-512.png', size: 512 },
  {
    svg: 'assets/icons/icon-full-bleed.svg',
    out: 'public/icons/icon-maskable-512.png',
    size: 512,
  },
  {
    svg: 'assets/icons/icon-full-bleed.svg',
    out: 'public/apple-touch-icon.png',
    size: 180,
  },
];

const browser = await chromium.launch();
for (const { svg, out, size } of ICONS) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
  });
  const markup = readFileSync(svg, 'utf8').replace(
    '<svg ',
    `<svg width="${size}" height="${size}" `
  );
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block}</style>${markup}`
  );
  await page.screenshot({ path: out, omitBackground: true });
  await page.close();
  console.log(`✓ ${out} (${size}×${size})`);
}
await browser.close();
