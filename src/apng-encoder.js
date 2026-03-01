// APNG (Animated PNG) encoder — assembles multiple PNG frames into one APNG

// CRC32 lookup table (PNG standard polynomial)
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  crcTable[n] = c;
}

function crc32(buf, start, len) {
  let c = 0xFFFFFFFF;
  for (let i = start; i < start + len; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function writeU32(buf, off, v) {
  buf[off] = (v >>> 24) & 0xFF;
  buf[off + 1] = (v >>> 16) & 0xFF;
  buf[off + 2] = (v >>> 8) & 0xFF;
  buf[off + 3] = v & 0xFF;
}

function writeU16(buf, off, v) {
  buf[off] = (v >>> 8) & 0xFF;
  buf[off + 1] = v & 0xFF;
}

function readU32(buf, off) {
  return ((buf[off] << 24) | (buf[off + 1] << 16) | (buf[off + 2] << 8) | buf[off + 3]) >>> 0;
}

// Build a single PNG chunk (length + type + data + crc)
function makeChunk(type, data) {
  const out = new Uint8Array(12 + data.length);
  writeU32(out, 0, data.length);
  out[4] = type.charCodeAt(0);
  out[5] = type.charCodeAt(1);
  out[6] = type.charCodeAt(2);
  out[7] = type.charCodeAt(3);
  out.set(data, 8);
  writeU32(out, 8 + data.length, crc32(out, 4, 4 + data.length));
  return out;
}

// Parse PNG bytes into chunk list
function parsePNG(buf) {
  const chunks = [];
  let off = 8; // skip signature
  while (off < buf.length) {
    const len = readU32(buf, off);
    const type = String.fromCharCode(buf[off + 4], buf[off + 5], buf[off + 6], buf[off + 7]);
    chunks.push({ type, data: buf.slice(off + 8, off + 8 + len) });
    off += 12 + len;
  }
  return chunks;
}

// Decode base64 data-URL to Uint8Array
function decodeDataURL(url) {
  const b = atob(url.split(',')[1]);
  const arr = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) arr[i] = b.charCodeAt(i);
  return arr;
}

const PNG_SIG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const COLOR_TYPES = new Set(['sRGB', 'gAMA', 'cHRM', 'iCCP', 'sBIT']);

/**
 * Encode an array of PNG data-URLs into a single APNG Uint8Array.
 * @param {string[]} dataURLs  Array of PNG data-URLs (one per frame)
 * @param {number}   fps       Playback frame rate
 * @returns {Uint8Array}
 */
export function encodeAPNG(dataURLs, fps) {
  const delayMs = Math.round(1000 / fps);
  const frames = dataURLs.map(u => parsePNG(decodeDataURL(u)));

  const parts = [];
  parts.push(PNG_SIG);

  // IHDR + color metadata from first frame
  const ihdr = frames[0].find(c => c.type === 'IHDR');
  parts.push(makeChunk('IHDR', ihdr.data));
  for (const c of frames[0]) {
    if (COLOR_TYPES.has(c.type)) parts.push(makeChunk(c.type, c.data));
  }

  // acTL — animation control
  const actl = new Uint8Array(8);
  writeU32(actl, 0, frames.length); // num_frames
  writeU32(actl, 4, 0);             // num_plays (0 = infinite)
  parts.push(makeChunk('acTL', actl));

  const w = readU32(ihdr.data, 0);
  const h = readU32(ihdr.data, 4);
  let seq = 0;

  for (let i = 0; i < frames.length; i++) {
    const idats = frames[i].filter(c => c.type === 'IDAT');

    // fcTL — frame control
    const fctl = new Uint8Array(26);
    writeU32(fctl, 0, seq++);
    writeU32(fctl, 4, w);
    writeU32(fctl, 8, h);
    writeU32(fctl, 12, 0);       // x_offset
    writeU32(fctl, 16, 0);       // y_offset
    writeU16(fctl, 20, delayMs); // delay_num (ms)
    writeU16(fctl, 22, 1000);    // delay_den
    fctl[24] = 0;                // dispose: NONE
    fctl[25] = 0;                // blend: SOURCE
    parts.push(makeChunk('fcTL', fctl));

    if (i === 0) {
      // First frame keeps original IDAT chunks
      for (const idat of idats) parts.push(makeChunk('IDAT', idat.data));
    } else {
      // Subsequent frames use fdAT (seq + IDAT data)
      for (const idat of idats) {
        const fdat = new Uint8Array(4 + idat.data.length);
        writeU32(fdat, 0, seq++);
        fdat.set(idat.data, 4);
        parts.push(makeChunk('fdAT', fdat));
      }
    }
  }

  parts.push(makeChunk('IEND', new Uint8Array(0)));

  // Concatenate all parts
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}
