// Builds the favicons and the PWA icons from the brand logos in public/brand (spec §13.2).
// Run `npm run brand:build` after changing a logo and commit the outputs; the app build never runs it.
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');
/** Rounded corners: favicons and the logo inside the app. */
const ROUNDED_LOGO = join(PUBLIC, 'brand', 'cuentas-claras-logo.svg');
/** Full bleed: Android and iOS round the corners of installed icons themselves. */
const SQUARE_LOGO = join(PUBLIC, 'brand', 'cuentas-claras-logo-square.svg');

/** Sizes inside favicon.ico. */
const FAVICON_SIZES = [16, 32, 48] as const;
/**
 * At 16 px the two C (strokes of about one pixel) blur into the ring, so that size draws the same
 * geometry with thicker letters. Thicker than this, the blue C merges with the ring.
 */
const SMALL_FAVICON = { size: 16, letterStrokeScale: 1.4 } as const;

const PNG_OUTPUTS = [
  { file: join(PUBLIC, 'icons', 'icon-192x192.png'), size: 192 },
  { file: join(PUBLIC, 'icons', 'icon-512x512.png'), size: 512 },
  { file: join(PUBLIC, 'icons', 'icon-maskable-512x512.png'), size: 512 },
  { file: join(PUBLIC, 'icons', 'apple-touch-icon.png'), size: 180 },
] as const;

function renderPng(svg: string, size: number): Buffer {
  return new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
}

/** The logo with the strokes of its letters (the paths) `scale` times thicker, same geometry. */
function withThickerLetters(svg: string, scale: number): string {
  return svg.replace(/<path\b[^>]*>/g, (path) =>
    path.replace(
      /stroke-width="([\d.]+)"/,
      (_, width: string) => `stroke-width="${(Number(width) * scale).toFixed(2)}"`,
    ),
  );
}

/** An .ico file whose images are PNGs (supported by every current browser and by Windows). */
function icoFromPngs(images: readonly { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  const entries: Buffer[] = [];
  let offset = header.length + 16 * images.length;
  for (const { size, png } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 means 256)
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // no color palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += png.length;
  }
  return Buffer.concat([header, ...entries, ...images.map(({ png }) => png)]);
}

async function main(): Promise<void> {
  const rounded = await readFile(ROUNDED_LOGO, 'utf8');
  const square = await readFile(SQUARE_LOGO, 'utf8');

  const favicons = FAVICON_SIZES.map((size) => ({
    size,
    png: renderPng(
      size === SMALL_FAVICON.size
        ? withThickerLetters(rounded, SMALL_FAVICON.letterStrokeScale)
        : rounded,
      size,
    ),
  }));
  await writeFile(join(PUBLIC, 'favicon.ico'), icoFromPngs(favicons));
  await copyFile(ROUNDED_LOGO, join(PUBLIC, 'favicon.svg'));

  for (const { file, size } of PNG_OUTPUTS) {
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, renderPng(square, size));
  }
  console.log(
    `favicon.ico (${FAVICON_SIZES.join(', ')} px), favicon.svg and ${PNG_OUTPUTS.length} PNG icons`,
  );
}

await main();
