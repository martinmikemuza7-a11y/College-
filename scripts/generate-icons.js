import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// Function to calculate CRC32
function crc32(buf) {
  let table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }

  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcBuf = Buffer.alloc(4);
  const toCrc = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(toCrc), 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function generatePNG(width, height, isMaskable = false) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // 8 bits per channel
  ihdrData.writeUInt8(6, 9); // RGBA
  ihdrData.writeUInt8(0, 10); // Deflate
  ihdrData.writeUInt8(0, 11); // Filter method 0
  ihdrData.writeUInt8(0, 12); // No interlace
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // Raw image data with 0 filter byte per scanline
  const scanlineLength = 1 + width * 4;
  const rawData = Buffer.alloc(height * scanlineLength);

  const cx = width / 2;
  const cy = height / 2;
  const radius = isMaskable ? width * 0.46 : width * 0.42;
  const safeRadius = isMaskable ? width * 0.32 : width * 0.38;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLength;
    rawData[rowOffset] = 0; // Filter byte: None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Default background: indigo gradient #4F46E5 to #4338CA
      const t = y / height;
      const bgR = Math.round(79 * (1 - t) + 67 * t);
      const bgG = Math.round(70 * (1 - t) + 56 * t);
      const bgB = Math.round(229 * (1 - t) + 202 * t);

      if (isMaskable) {
        // Full bleed background for maskable
        let r = bgR;
        let g = bgG;
        let b = bgB;
        let a = 255;

        // Draw graduation cap & book motif in center safe area
        const relX = (x - cx) / safeRadius;
        const relY = (y - cy) / safeRadius;

        // Cap diamond: |relX| + |relY * 1.5 + 0.2| < 0.65
        const inCapDiamond = Math.abs(relX) + Math.abs(relY * 1.6 + 0.2) < 0.7 && relY < 0.2;
        // Cap base/skullcap: relY between 0.1 and 0.4, relX between -0.45 and 0.45
        const inCapBase = relY >= 0.05 && relY <= 0.45 && Math.abs(relX) < 0.5 * (1 - (relY - 0.05));
        // Star/sparkle in top right
        const sparkDist = Math.sqrt((relX - 0.5) ** 2 + (relY + 0.45) ** 2);
        const inSparkle = sparkDist < 0.16;

        if (inCapDiamond || inCapBase || inSparkle) {
          r = 255;
          g = 255;
          b = 255;
        } else if (Math.abs(relX) + Math.abs(relY * 1.6 + 0.2) < 0.78 && relY < 0.25) {
          // Subtle glow
          r = Math.min(255, r + 40);
          g = Math.min(255, g + 40);
          b = Math.min(255, b + 50);
        }

        rawData[pxOffset] = r;
        rawData[pxOffset + 1] = g;
        rawData[pxOffset + 2] = b;
        rawData[pxOffset + 3] = a;
      } else {
        // Rounded squircle / circular icon for "any" purpose
        // Smooth rounded corner container
        const cornerR = width * 0.22;
        const qx = Math.max(0, Math.abs(x - cx) - (cx - cornerR));
        const qy = Math.max(0, Math.abs(y - cy) - (cy - cornerR));
        const inContainer = Math.sqrt(qx * qx + qy * qy) <= cornerR;

        if (inContainer) {
          let r = bgR;
          let g = bgG;
          let b = bgB;
          let a = 255;

          const relX = (x - cx) / safeRadius;
          const relY = (y - cy) / safeRadius;

          const inCapDiamond = Math.abs(relX) + Math.abs(relY * 1.6 + 0.2) < 0.72 && relY < 0.2;
          const inCapBase = relY >= 0.05 && relY <= 0.48 && Math.abs(relX) < 0.52 * (1 - (relY - 0.05));
          const sparkDist = Math.sqrt((relX - 0.5) ** 2 + (relY + 0.45) ** 2);
          const inSparkle = sparkDist < 0.16;

          if (inCapDiamond || inCapBase || inSparkle) {
            r = 255;
            g = 255;
            b = 255;
          }

          rawData[pxOffset] = r;
          rawData[pxOffset + 1] = g;
          rawData[pxOffset + 2] = b;
          rawData[pxOffset + 3] = a;
        } else {
          // Transparent outside squircle
          rawData[pxOffset] = 0;
          rawData[pxOffset + 1] = 0;
          rawData[pxOffset + 2] = 0;
          rawData[pxOffset + 3] = 0;
        }
      }
    }
  }

  const compressedData = zlib.deflateSync(rawData, { level: 9 });
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const publicDir = path.resolve(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 1. Generate standard 192x192 PNG
const png192 = generatePNG(192, 192, false);
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), png192);
console.log('✓ Created public/pwa-192x192.png (192x192, type: any)');

// 2. Generate standard 512x512 PNG
const png512 = generatePNG(512, 512, false);
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), png512);
console.log('✓ Created public/pwa-512x512.png (512x512, type: any)');

// 3. Generate maskable 512x512 PNG (full bleed background, padded safe-zone icon)
const pngMaskable512 = generatePNG(512, 512, true);
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), pngMaskable512);
console.log('✓ Created public/pwa-maskable-512x512.png (512x512, type: maskable)');

// 4. Generate Apple touch icon 180x180 PNG (non-transparent for iOS)
const pngApple180 = generatePNG(180, 180, true);
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), pngApple180);
console.log('✓ Created public/apple-touch-icon.png (180x180, iOS Safari)');

// 5. Generate high-contrast SVG brand icon for desktop browsers
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4F46E5" />
      <stop offset="100%" stop-color="#4338CA" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.25"/>
    </filter>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#grad)" />
  <g filter="url(#shadow)">
    <!-- Graduation Cap Board -->
    <polygon points="256,120 420,205 256,290 92,205" fill="#FFFFFF" />
    <!-- Cap Lower Band -->
    <path d="M152,240 L152,310 C152,350 360,350 360,310 L360,240 L256,294 Z" fill="#EEF2FF" />
    <!-- Tassel Cord -->
    <path d="M410,210 C410,270 428,290 428,335" stroke="#FDE047" stroke-width="8" stroke-linecap="round" fill="none" />
    <circle cx="428" cy="345" r="10" fill="#EAB308" />
    <!-- AI Sparkle Motif -->
    <path d="M370,110 L378,132 L400,140 L378,148 L370,170 L362,148 L340,140 L362,132 Z" fill="#FDE047" />
    <!-- Open Book Pages Motif -->
    <path d="M170,390 C210,380 256,395 256,395 C256,395 302,380 342,390 L342,420 C302,410 256,425 256,425 C256,425 210,410 170,420 Z" fill="#FFFFFF" opacity="0.9" />
  </g>
</svg>`;
fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgContent);
console.log('✓ Created public/icon.svg (Vector Brand)');
