// PWA placeholder ikon üreteci — bağımsız (harici bağımlılık yok).
// 4 element = 4 çeyrek renk (fire/water/earth/air). Gerçek ikonlar M12'de.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function png(size, quads) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  let p = 0;
  const half = size / 2;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const q = (x < half ? 0 : 1) + (y < half ? 0 : 2);
      const [r, g, b] = quads[q];
      raw[p++] = r;
      raw[p++] = g;
      raw[p++] = b;
      raw[p++] = 255;
    }
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

const quads = [
  [255, 112, 67], // fire  (top-left)
  [66, 165, 245], // water (top-right)
  [139, 195, 74], // earth (bottom-left)
  [176, 190, 197] // air   (bottom-right)
];

mkdirSync('public/icons', { recursive: true });
for (const s of [192, 512]) {
  writeFileSync(`public/icons/icon-${s}.png`, png(s, quads));
}
console.log('✓ PWA ikonları üretildi: public/icons/icon-192.png, icon-512.png');
