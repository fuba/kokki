// JavaScript SDF shape functions matching the GLSL implementations.
// Used to determine particle colors when the flag explodes.

function sdCircle(px, py, r) {
  return Math.sqrt(px * px + py * py) - r;
}

function sdBox(px, py, bx, by) {
  const dx = Math.abs(px) - bx;
  const dy = Math.abs(py) - by;
  const outside = Math.sqrt(Math.max(dx, 0) ** 2 + Math.max(dy, 0) ** 2);
  const inside = Math.min(Math.max(dx, dy), 0);
  return outside + inside;
}

function sdStar5(px, py, r) {
  // Straight-edge 5-pointed star (American flag style)
  const innerR = r * 0.38;
  const hs = Math.PI / 5.0;
  const angle = Math.atan2(px, py);
  // GLSL-style mod: x - y * floor(x / y)
  const raw = angle + hs;
  const period = hs * 2.0;
  const a = Math.abs((raw - period * Math.floor(raw / period)) - hs);
  const len = Math.sqrt(px * px + py * py);
  const qx = len * Math.sin(a);
  const qy = len * Math.cos(a);
  const v1x = innerR * Math.sin(hs);
  const v1y = innerR * Math.cos(hs);
  const ex = v1x;
  const ey = v1y - r;
  const dx = qx;
  const dy = qy - r;
  const t = Math.max(0, Math.min(1, (dx * ex + dy * ey) / (ex * ex + ey * ey)));
  const distX = dx - ex * t;
  const distY = dy - ey * t;
  const dist = Math.sqrt(distX * distX + distY * distY);
  const s = ex * dy - ey * dx;
  return s < 0 ? -dist : dist;
}

function sdCrescent(px, py, r) {
  const d1 = sdCircle(px, py, r);
  const d2 = sdCircle(px - r * 0.4, py, r * 0.85);
  return Math.max(d1, -d2);
}

function sdCross(px, py, size) {
  const w = size * 0.28;
  const h = size;
  const d1 = sdBox(px, py, w, h);
  const d2 = sdBox(px, py, h, w);
  return Math.min(d1, d2);
}

function sdTriangle(px, py, r) {
  const k = Math.sqrt(3);
  let x = Math.abs(px) - r;
  let y = py + r / k;
  if (x + k * y > 0) {
    const nx = (x - k * y) / 2;
    const ny = (-k * x - y) / 2;
    x = nx;
    y = ny;
  }
  x -= Math.max(-2 * r, Math.min(x, 0));
  return -Math.sqrt(x * x + y * y) * Math.sign(y);
}

function sdDiamond(px, py, r) {
  const rpx = (px + py) * 0.7071;
  const rpy = (py - px) * 0.7071;
  return sdBox(rpx, rpy, r * 0.7, r * 0.7);
}

function sdHexagon(px, py, r) {
  const kx = -0.866025404;
  const ky = 0.5;
  const kz = 0.577350269;
  let x = Math.abs(px);
  let y = Math.abs(py);
  const dot = Math.min(kx * x + ky * y, 0);
  x -= 2 * dot * kx;
  y -= 2 * dot * ky;
  x -= Math.max(-kz * r, Math.min(x, kz * r));
  y -= r;
  return Math.sqrt(x * x + y * y) * Math.sign(y);
}

function sdRing(px, py, r) {
  return Math.abs(Math.sqrt(px * px + py * py) - r) - r * 0.15;
}

// Rising Sun: static version (no rotation) for particle color sampling, offset right
function sdRisingSun(px, py, r) {
  const rpx = px - 0.35;
  const len = Math.sqrt(rpx * rpx + py * py);
  const circleD = len - r * 0.55;
  const angle = Math.atan2(py, rpx);
  const rayD = -Math.cos(angle * 16.0) * 0.015;
  return Math.min(circleD, rayD);
}

// Returns true if point (px, py) is inside the shape
// px, py are in aspect-corrected coordinates (px = uv.x * aspect)
export function isInsideShape(px, py, shapeType, shapeSize) {
  let d;
  switch (shapeType) {
    case 0: d = sdCircle(px, py, shapeSize); break;
    case 1: d = sdStar5(px, py, shapeSize); break;
    case 2: d = sdCrescent(px, py, shapeSize); break;
    case 3: d = sdCross(px, py, shapeSize); break;
    case 5: d = sdDiamond(px, py, shapeSize); break;
    case 6: d = sdHexagon(px, py, shapeSize); break;
    case 7: d = sdRing(px, py, shapeSize); break;
    case 8: d = sdRisingSun(px, py, shapeSize); break;
    default: d = sdCircle(px, py, shapeSize);
  }
  return d < 0;
}
