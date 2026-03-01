// GIF89a animated GIF encoder — RGBA pixel frames to animated GIF

// ========== Median-cut color quantization ==========

function computeBounds(colors) {
  let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
  for (const c of colors) {
    if (c[0] < rMin) rMin = c[0]; if (c[0] > rMax) rMax = c[0];
    if (c[1] < gMin) gMin = c[1]; if (c[1] > gMax) gMax = c[1];
    if (c[2] < bMin) bMin = c[2]; if (c[2] > bMax) bMax = c[2];
  }
  return { colors, rMin, rMax, gMin, gMax, bMin, bMax };
}

function quantize(frames, width, height, maxColors) {
  const pixelCount = width * height;

  // Sample pixels across all frames for palette building
  const totalPixels = pixelCount * frames.length;
  const sampleTarget = Math.min(20000, totalPixels);
  const step = Math.max(1, Math.floor(totalPixels / sampleTarget));

  const samples = [];
  let gi = 0;
  for (let f = 0; f < frames.length; f++) {
    const frame = frames[f];
    for (let i = 0; i < pixelCount; i++, gi++) {
      if (gi % step !== 0) continue;
      const off = i * 4;
      samples.push([frame[off], frame[off + 1], frame[off + 2]]);
    }
  }

  // Median cut: recursively split color boxes along longest axis
  const boxes = [computeBounds(samples)];

  while (boxes.length < maxColors) {
    let bestIdx = -1;
    let bestRange = 0;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (b.colors.length < 2) continue;
      const range = Math.max(b.rMax - b.rMin, b.gMax - b.gMin, b.bMax - b.bMin);
      if (range > bestRange) { bestRange = range; bestIdx = i; }
    }
    if (bestIdx === -1) break;

    const box = boxes[bestIdx];
    const rR = box.rMax - box.rMin;
    const gR = box.gMax - box.gMin;
    const bR = box.bMax - box.bMin;
    const ch = (rR >= gR && rR >= bR) ? 0 : (gR >= bR) ? 1 : 2;

    box.colors.sort((a, b) => a[ch] - b[ch]);
    const mid = box.colors.length >> 1;
    boxes[bestIdx] = computeBounds(box.colors.slice(0, mid));
    boxes.push(computeBounds(box.colors.slice(mid)));
  }

  // Build palette from box averages
  const palette = new Uint8Array(maxColors * 3);
  const paletteRGB = new Array(maxColors);

  for (let i = 0; i < maxColors; i++) {
    if (i < boxes.length && boxes[i].colors.length > 0) {
      let rS = 0, gS = 0, bS = 0;
      for (const c of boxes[i].colors) { rS += c[0]; gS += c[1]; bS += c[2]; }
      const n = boxes[i].colors.length;
      palette[i * 3] = Math.round(rS / n);
      palette[i * 3 + 1] = Math.round(gS / n);
      palette[i * 3 + 2] = Math.round(bS / n);
      paletteRGB[i] = [palette[i * 3], palette[i * 3 + 1], palette[i * 3 + 2]];
    } else {
      paletteRGB[i] = [0, 0, 0];
    }
  }

  // Map pixels to nearest palette entry (cached for speed)
  const cache = new Map();

  function nearest(r, g, b) {
    const key = (r << 16) | (g << 8) | b;
    let idx = cache.get(key);
    if (idx !== undefined) return idx;

    let bestDist = Infinity;
    idx = 0;
    for (let j = 0; j < maxColors; j++) {
      const p = paletteRGB[j];
      const dr = r - p[0], dg = g - p[1], db = b - p[2];
      const d = dr * dr + dg * dg + db * db;
      if (d < bestDist) { bestDist = d; idx = j; }
    }

    cache.set(key, idx);
    return idx;
  }

  const indices = [];
  for (const frame of frames) {
    const idx = new Uint8Array(pixelCount);
    for (let i = 0; i < pixelCount; i++) {
      const off = i * 4;
      idx[i] = nearest(frame[off], frame[off + 1], frame[off + 2]);
    }
    indices.push(idx);
  }

  return { palette, indices };
}

// ========== GIF LZW compression ==========

function lzwEncode(indexStream, minCodeSize) {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;

  const bytes = [];
  let bitBuf = 0;
  let bitCount = 0;

  function writeBits(code, size) {
    bitBuf |= code << bitCount;
    bitCount += size;
    while (bitCount >= 8) {
      bytes.push(bitBuf & 0xFF);
      bitBuf >>>= 8;
      bitCount -= 8;
    }
  }

  let codeSize, nextCode, table;

  function reset() {
    table = new Map();
    nextCode = eoiCode + 1;
    codeSize = minCodeSize + 1;
  }

  writeBits(clearCode, minCodeSize + 1);
  reset();

  let prefix = indexStream[0];

  for (let i = 1; i < indexStream.length; i++) {
    const k = indexStream[i];
    const key = prefix * 256 + k;

    if (table.has(key)) {
      prefix = table.get(key);
    } else {
      writeBits(prefix, codeSize);

      if (nextCode <= 4095) {
        table.set(key, nextCode);
        nextCode++;
        if (nextCode > (1 << codeSize) && codeSize < 12) {
          codeSize++;
        }
      } else {
        writeBits(clearCode, codeSize);
        reset();
      }

      prefix = k;
    }
  }

  writeBits(prefix, codeSize);
  writeBits(eoiCode, codeSize);

  if (bitCount > 0) bytes.push(bitBuf & 0xFF);

  return new Uint8Array(bytes);
}

// ========== GIF89a format ==========

/**
 * Encode RGBA pixel frames into an animated GIF.
 * @param {Uint8Array[]} rawFrames  Array of RGBA pixel data (top-to-bottom)
 * @param {number} width
 * @param {number} height
 * @param {number} fps
 * @returns {Uint8Array}
 */
export function encodeGIF(rawFrames, width, height, fps) {
  const baseCentisec = Math.round(100 / fps);

  // Merge consecutive identical frames (same buffer reference) into one with longer delay
  const frames = [];
  const delays = [];
  for (let i = 0; i < rawFrames.length; ) {
    let count = 1;
    while (i + count < rawFrames.length && rawFrames[i + count] === rawFrames[i]) count++;
    frames.push(rawFrames[i]);
    delays.push(baseCentisec * count);
    i += count;
  }

  const { palette, indices } = quantize(frames, width, height, 256);

  const parts = [];

  // Header: "GIF89a"
  parts.push(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]));

  // Logical Screen Descriptor
  parts.push(new Uint8Array([
    width & 0xFF, (width >> 8) & 0xFF,
    height & 0xFF, (height >> 8) & 0xFF,
    0xF7, // GCT flag=1, color res=7, sort=0, GCT size=7 (256 colors)
    0x00, // background color index
    0x00, // pixel aspect ratio
  ]));

  // Global Color Table (256 entries × 3 bytes = 768 bytes)
  parts.push(palette);

  // NETSCAPE2.0 Application Extension — infinite loop
  parts.push(new Uint8Array([
    0x21, 0xFF, 0x0B,
    0x4E, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, // "NETSCAPE"
    0x32, 0x2E, 0x30, // "2.0"
    0x03, 0x01, 0x00, 0x00, // loop count = 0 (infinite)
    0x00, // terminator
  ]));

  // Each frame
  for (let f = 0; f < indices.length; f++) {
    const delay = delays[f];

    // Graphics Control Extension
    parts.push(new Uint8Array([
      0x21, 0xF9, 0x04,
      0x04, // disposal=1 (leave in place), no transparency
      delay & 0xFF, (delay >> 8) & 0xFF,
      0x00, // transparent color (unused)
      0x00, // terminator
    ]));

    // Image Descriptor
    parts.push(new Uint8Array([
      0x2C,
      0x00, 0x00, 0x00, 0x00, // left, top
      width & 0xFF, (width >> 8) & 0xFF,
      height & 0xFF, (height >> 8) & 0xFF,
      0x00, // no local color table
    ]));

    // LZW data
    const minCodeSize = 8; // 256 colors
    const lzwData = lzwEncode(indices[f], minCodeSize);

    parts.push(new Uint8Array([minCodeSize]));

    // Sub-blocks (max 255 bytes each)
    for (let off = 0; off < lzwData.length; ) {
      const blockSize = Math.min(255, lzwData.length - off);
      parts.push(new Uint8Array([blockSize]));
      parts.push(lzwData.subarray(off, off + blockSize));
      off += blockSize;
    }
    parts.push(new Uint8Array([0x00])); // block terminator
  }

  // Trailer
  parts.push(new Uint8Array([0x3B]));

  // Concatenate all parts
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}
