/**
 * Generates MapLibre-compatible SDF glyph PBF files from a woff2 font.
 * Outputs to public/fonts/<FontName>/<start>-<end>.pbf (256 glyphs per file).
 *
 * Usage: node scripts/generateGlyphs.mjs
 */

import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import wawoff2 from 'wawoff2';
import opentype from 'opentype.js';
import TinySDF from 'tiny-sdf';
import Pbf from 'pbf';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Config
const FONT_FILE = join(ROOT, 'src/assets/GT-Walsheim-Bold.woff2');
const FONT_NAME = 'GT Walsheim Bold';
const OUT_DIR = join(ROOT, 'public/fonts', FONT_NAME);

// SDF parameters (must match what MapLibre expects)
const BUFFER = 3;     // pixels of padding around glyph
const RADIUS = 8;     // SDF radius
const CUTOFF = 0.25;  // SDF cutoff

// Ranges to generate (covers ASCII + extended Latin)
const RANGES = [
  [0, 255],
  [256, 511],
];

async function main() {
  // Decompress woff2 → ttf bytes
  const woff2Bytes = new Uint8Array(readFileSync(FONT_FILE));
  const ttfBytes = await wawoff2.decompress(woff2Bytes);
  // Slice to own ArrayBuffer (wawoff2 returns a view into a larger shared buffer)
  const font = opentype.parse(ttfBytes.buffer.slice(ttfBytes.byteOffset, ttfBytes.byteOffset + ttfBytes.byteLength));

  const unitsPerEm = font.unitsPerEm;
  mkdirSync(OUT_DIR, { recursive: true });

  for (const [start, end] of RANGES) {
    const glyphs = [];

    for (let codepoint = start; codepoint <= end; codepoint++) {
      const char = String.fromCodePoint(codepoint);
      const glyph = font.charToGlyph(char);
      if (!glyph) continue;

      // Render at 24px for SDF generation
      const fontSize = 24;
      const scale = fontSize / unitsPerEm;
      const advance = Math.round((glyph.advanceWidth || 0) * scale);

      // Get bounding box
      const bb = glyph.getBoundingBox();
      const width = Math.ceil((bb.x2 - bb.x1) * scale);
      const height = Math.ceil((bb.y2 - bb.y1) * scale);

      if (width <= 0 || height <= 0) {
        // Whitespace / empty glyph — still include with no bitmap
        glyphs.push({ id: codepoint, bitmap: null, width: 0, height: 0, left: 0, top: 0, advance });
        continue;
      }

      // Draw glyph to offscreen canvas via path commands
      const pad = BUFFER;
      const imgW = width + 2 * pad;
      const imgH = height + 2 * pad;
      const alpha = new Uint8ClampedArray(imgW * imgH);

      // Manual rasterisation using opentype path segments
      const path = glyph.getPath(pad - bb.x1 * scale, pad + bb.y2 * scale, fontSize);
      rasterizePath(path.commands, alpha, imgW, imgH);

      // Generate SDF
      const sdf = new TinySDF({ buffer: BUFFER, radius: RADIUS, cutoff: CUTOFF, width: imgW, height: imgH });
      const sdfData = sdf.draw(alpha);

      const left = Math.round(bb.x1 * scale);
      const top = Math.round(bb.y2 * scale);

      glyphs.push({
        id: codepoint,
        bitmap: Buffer.from(sdfData),
        width: imgW,
        height: imgH,
        left,
        top,
        advance,
      });
    }

    // Serialize to PBF
    const pbf = new Pbf();
    writeFontstack(pbf, FONT_NAME, `${start}-${end}`, glyphs);
    const buf = pbf.finish();

    const outPath = join(OUT_DIR, `${start}-${end}.pbf`);
    writeFileSync(outPath, buf);
    console.log(`Written: ${outPath} (${glyphs.length} glyphs)`);
  }

  console.log('Done. Update GLYPHS_URL to: /fonts/{fontstack}/{range}.pbf');
}

// --- PBF serialization (MapLibre glyph format) ---
function writeFontstack(pbf, name, range, glyphs) {
  pbf.writeMessage(1, (pbf) => {
    pbf.writeStringField(1, name);
    pbf.writeStringField(2, range);
    for (const g of glyphs) {
      pbf.writeMessage(3, writeGlyph, g);
    }
  });
}

function writeGlyph(pbf, g) {
  pbf.writeVarintField(1, g.id);
  if (g.bitmap && g.bitmap.length > 0) {
    pbf.writeBytesField(2, g.bitmap);
  }
  pbf.writeVarintField(3, g.width);
  pbf.writeVarintField(4, g.height);
  pbf.writeSVarintField(5, g.left);
  pbf.writeSVarintField(6, g.top);
  pbf.writeVarintField(7, g.advance);
}

// --- Simple scanline rasterizer ---
// Converts opentype path commands to a grayscale alpha buffer
function rasterizePath(commands, alpha, width, height) {
  // Build scanline edge table
  const edges = [];
  let px = 0, py = 0;

  for (const cmd of commands) {
    if (cmd.type === 'M') {
      px = cmd.x; py = cmd.y;
    } else if (cmd.type === 'L') {
      edges.push({ x1: px, y1: py, x2: cmd.x, y2: cmd.y });
      px = cmd.x; py = cmd.y;
    } else if (cmd.type === 'C') {
      // Approximate cubic bezier with line segments
      const steps = 16;
      let lx = px, ly = py;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const t2 = t * t, t3 = t2 * t;
        const mt = 1 - t, mt2 = mt * mt, mt3 = mt2 * mt;
        const nx = mt3 * px + 3 * mt2 * t * cmd.x1 + 3 * mt * t2 * cmd.x2 + t3 * cmd.x;
        const ny = mt3 * py + 3 * mt2 * t * cmd.y1 + 3 * mt * t2 * cmd.y2 + t3 * cmd.y;
        edges.push({ x1: lx, y1: ly, x2: nx, y2: ny });
        lx = nx; ly = ny;
      }
      px = cmd.x; py = cmd.y;
    } else if (cmd.type === 'Q') {
      // Approximate quadratic bezier
      const steps = 12;
      let lx = px, ly = py;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const mt = 1 - t;
        const nx = mt * mt * px + 2 * mt * t * cmd.x1 + t * t * cmd.x;
        const ny = mt * mt * py + 2 * mt * t * cmd.y1 + t * t * cmd.y;
        edges.push({ x1: lx, y1: ly, x2: nx, y2: ny });
        lx = nx; ly = ny;
      }
      px = cmd.x; py = cmd.y;
    }
  }

  // Scanline fill using even-odd rule
  for (let y = 0; y < height; y++) {
    const intersections = [];
    for (const e of edges) {
      const { x1, y1, x2, y2 } = e;
      const minY = Math.min(y1, y2);
      const maxY = Math.max(y1, y2);
      if (y + 0.5 < minY || y + 0.5 >= maxY) continue;
      const t = (y + 0.5 - y1) / (y2 - y1);
      intersections.push(x1 + t * (x2 - x1));
    }
    intersections.sort((a, b) => a - b);
    for (let i = 0; i < intersections.length - 1; i += 2) {
      const x0 = Math.max(0, Math.floor(intersections[i]));
      const x1 = Math.min(width - 1, Math.ceil(intersections[i + 1]));
      for (let x = x0; x <= x1; x++) {
        alpha[y * width + x] = 255;
      }
    }
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
