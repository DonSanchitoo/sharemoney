// Génère les icônes PNG (écran d'accueil iOS, manifest) à partir du SVG.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFileSync, writeFileSync } from 'node:fs';

const svg = readFileSync('public/icons/icon.svg', 'utf8');
const square = svg.replace('rx="112"', 'rx="0"');
const maskable = square.replace('<path', '<g transform="translate(51 51) scale(0.8)"><path').replace('</svg>', '</g></svg>');
const targets = [
  ['public/icons/apple-touch-icon.png', square, 180],
  ['public/icons/icon-192.png', svg, 192],
  ['public/icons/icon-512.png', svg, 512],
  ['public/icons/icon-maskable-512.png', maskable, 512],
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, src, size] of targets) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${src.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  writeFileSync(file, await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } }));
}
await browser.close();
console.log('icônes générées');
