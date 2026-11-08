// Regenerate the favicon from Rumi's face (mascot design tokens):
//   node scripts/make-favicon.mjs apps/desktop apps/desktop/static/favicon.ico <tmp-dir>
// Needs Microsoft Edge (Playwright channel "msedge"). Writes 16–256 px PNGs into <tmp-dir>.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const [, , desktopDir, outIco, outDir] = process.argv;
const require = createRequire(path.resolve(desktopDir, "package.json"));
const { chromium } = require('@playwright/test');

const C = { bg: '#FFF4E0', ring: '#F2C94C', fur: '#E3B48A', light: '#F6E3CF', stripe: '#8A6A52', eye: '#263238', nose: '#C9705F', scarf: '#5E8C6A' };

// Simple, bold shapes so it still reads as a tiger face at 16×16.
const svg = (detail) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <rect x="8" y="8" width="240" height="240" rx="60" fill="${C.bg}"/>
  <circle cx="68" cy="78" r="38" fill="${C.fur}"/>
  <circle cx="188" cy="78" r="38" fill="${C.fur}"/>
  <circle cx="68" cy="78" r="18" fill="${C.light}"/>
  <circle cx="188" cy="78" r="18" fill="${C.light}"/>
  <ellipse cx="128" cy="140" rx="98" ry="90" fill="${C.fur}"/>
  ${detail ? `<path d="M128 52 v30 M104 58 l6 24 M152 58 l-6 24" stroke="${C.stripe}" stroke-width="10" stroke-linecap="round"/>
  <path d="M34 128 h26 M36 152 h24 M222 128 h-26 M220 152 h-24" stroke="${C.stripe}" stroke-width="10" stroke-linecap="round"/>` : ''}
  <ellipse cx="128" cy="176" rx="56" ry="42" fill="${C.light}"/>
  <circle cx="92" cy="128" r="${detail ? 14 : 18}" fill="${C.eye}"/>
  <circle cx="164" cy="128" r="${detail ? 14 : 18}" fill="${C.eye}"/>
  ${detail ? `<circle cx="96" cy="123" r="4.5" fill="#fff"/><circle cx="168" cy="123" r="4.5" fill="#fff"/>` : ''}
  <path d="M112 160 h32 q-4 16 -16 18 q-12 -2 -16 -18z" fill="${C.nose}"/>
  ${detail ? `<path d="M128 178 v8 M128 186 q-12 12 -22 2 M128 186 q12 12 22 2" stroke="${C.eye}" stroke-width="5" fill="none" stroke-linecap="round"/>` : ''}
  <path d="M60 222 q68 26 136 0 l-6 18 q-62 14 -124 0z" fill="${C.scarf}"/>
</svg>`;

const SIZES = [16, 24, 32, 48, 64, 128, 256];
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'rumi-icon.svg'), svg(true));

const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage();
const pngs = [];
for (const size of SIZES) {
	await page.setViewportSize({ width: size, height: size });
	// Below 32 px the fine stripes/mouth turn to mush: use the bolder, simpler face.
	const markup = svg(size >= 32).replace('<svg ', `<svg width="${size}" height="${size}" `);
	await page.setContent(`<html><body style="margin:0;background:transparent">${markup}</body></html>`);
	const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
	fs.writeFileSync(path.join(outDir, `rumi-${size}.png`), png);
	pngs.push({ size, png });
}
await browser.close();

// ICO container: 6-byte header, 16-byte directory entry per image, then the PNG data.
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(pngs.length, 4);
let offset = 6 + 16 * pngs.length;
const entries = pngs.map(({ size, png }) => {
	const e = Buffer.alloc(16);
	e.writeUInt8(size >= 256 ? 0 : size, 0);
	e.writeUInt8(size >= 256 ? 0 : size, 1);
	e.writeUInt8(0, 2);
	e.writeUInt8(0, 3);
	e.writeUInt16LE(1, 4);
	e.writeUInt16LE(32, 6);
	e.writeUInt32LE(png.length, 8);
	e.writeUInt32LE(offset, 12);
	offset += png.length;
	return e;
});
fs.writeFileSync(outIco, Buffer.concat([header, ...entries, ...pngs.map((p) => p.png)]));
console.log('wrote', outIco, fs.statSync(outIco).size, 'bytes,', pngs.length, 'sizes');
