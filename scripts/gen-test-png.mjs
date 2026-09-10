// Deterministic test drawing PNG: white canvas, dark rectangle, red band.
// Node stdlib only. Prints a PNG data URL to stdout.
import { deflateSync } from 'node:zlib';

function crc32(buf) {
  let c = 0xffffffff | 0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xEDB88320 : 0);
  }
  return (~c) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type);
  const l = Buffer.alloc(4);
  l.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  const tb = Buffer.concat([t, data]);
  crc.writeUInt32BE(crc32(tb), 0);
  return Buffer.concat([l, t, data, crc]);
}

const w = 240, h = 160, bpp = 4;
const stride = w * bpp;
const rows = [];
for (let y = 0; y < h; y++) {
  const row = Buffer.alloc(stride + 1);
  row[0] = 0; // filter: none
  for (let x = 0; x < w; x++) {
    const o = 1 + x * bpp;
    row[o] = 255; row[o + 1] = 255; row[o + 2] = 255; row[o + 3] = 255;
  }
  if (y > 30 && y < 120) {
    for (let x = 40; x < 200; x++) {
      const o = 1 + x * bpp;
      row[o] = 0x18; row[o + 1] = 0x18; row[o + 2] = 0x18; row[o + 3] = 255;
    }
    if (y > 50 && y < 65) {
      for (let x = 60; x < 180; x++) {
        const o = 1 + x * bpp;
        row[o] = 0xe6; row[o + 1] = 0x39; row[o + 2] = 0x46;
      }
    }
  }
  rows.push(row);
}
const raw = Buffer.concat(rows);
const comp = deflateSync(raw, { level: 9 });
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(w, 0);
ihdr.writeUInt32BE(h, 4);
ihdr[8] = 8; ihdr[9] = 6;
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', comp),
  chunk('IEND', Buffer.alloc(0)),
]);
process.stdout.write('data:image/png;base64,' + png.toString('base64'));
