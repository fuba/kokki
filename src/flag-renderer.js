// Flag renderer - 3D waving flag with time-based sky background

import { createProgram, getUniformLocations } from './webgl-utils.js';

// ========== Vector / Matrix utilities (column-major for WebGL) ==========

const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm3 = (a) => {
  const l = Math.sqrt(dot3(a, a));
  return [a[0] / l, a[1] / l, a[2] / l];
};

function mat4Persp(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2);
  const nf = 1 / (near - far);
  // Column-major
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}

function mat4Look(eye, target, up) {
  const z = norm3(sub3(eye, target));
  const x = norm3(cross3(up, z));
  const y = cross3(z, x);
  // Column-major
  return new Float32Array([
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    -dot3(x, eye), -dot3(y, eye), -dot3(z, eye), 1,
  ]);
}

function mat4Mul(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
  return o;
}

function mvMul(m, v) {
  return [
    m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12] * v[3],
    m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13] * v[3],
    m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14] * v[3],
    m[3] * v[0] + m[7] * v[1] + m[11] * v[2] + m[15] * v[3],
  ];
}

// ========== Sky colors by time of day ==========

function lerpC(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function getSkyColors() {
  const now = new Date();
  const h = now.getHours() + now.getMinutes() / 60;

  if (h >= 4 && h < 6) {
    // Pre-dawn
    const t = (h - 4) / 2;
    return {
      horizon: lerpC([0.10, 0.12, 0.25], [0.9, 0.5, 0.3], t),
      zenith: lerpC([0.05, 0.07, 0.18], [0.2, 0.15, 0.35], t),
      cloudBright: 0.2 + t * 0.5,
    };
  } else if (h >= 6 && h < 8) {
    // Sunrise
    const t = (h - 6) / 2;
    return {
      horizon: lerpC([0.9, 0.5, 0.3], [0.75, 0.85, 0.95], t),
      zenith: lerpC([0.2, 0.15, 0.35], [0.3, 0.5, 0.85], t),
      cloudBright: 0.7 + t * 0.3,
    };
  } else if (h >= 8 && h < 16) {
    // Daytime
    return { horizon: [0.75, 0.88, 1.0], zenith: [0.25, 0.45, 0.9], cloudBright: 1.0 };
  } else if (h >= 16 && h < 18) {
    // Sunset approach
    const t = (h - 16) / 2;
    return {
      horizon: lerpC([0.75, 0.85, 0.95], [0.95, 0.55, 0.25], t),
      zenith: lerpC([0.25, 0.45, 0.9], [0.3, 0.3, 0.6], t),
      cloudBright: 1.0 - t * 0.2,
    };
  } else if (h >= 18 && h < 20) {
    // Sunset / twilight
    const t = (h - 18) / 2;
    return {
      horizon: lerpC([0.95, 0.55, 0.25], [0.12, 0.13, 0.25], t),
      zenith: lerpC([0.3, 0.3, 0.6], [0.05, 0.07, 0.18], t),
      cloudBright: 0.8 - t * 0.5,
    };
  } else {
    // Night - slightly blue, not pitch black
    return { horizon: [0.08, 0.10, 0.22], zenith: [0.04, 0.06, 0.16], cloudBright: 0.2 };
  }
}

// ========== Constants ==========

const FLAG_W = 1.5;
const FLAG_H = 1.0;
const FLAG_ASPECT = FLAG_W / FLAG_H;
const GRID_X = 40;
const GRID_Y = 28;
const PI = Math.PI;

// Camera: looking up from diagonally below
const EYE = [0.25, -0.55, 1.9];
const TARGET = [0.0, 0.05, 0.0];
const UP = [0, 1, 0];
const FOV = 38 * PI / 180;

// ========== Sky shaders ==========

const SKY_VS = `
attribute vec2 a_position;
varying vec2 v_pos;
void main() {
    gl_Position = vec4(a_position, 0.999, 1.0);
    v_pos = a_position;
}
`;

const SKY_FS = `
precision highp float;
varying vec2 v_pos;
uniform vec3 u_horizon;
uniform vec3 u_zenith;
uniform float u_time;
uniform float u_cloudBright;

// Hash-based noise for procedural clouds
float hash(vec2 p) {
    float h = dot(p, vec2(127.1, 311.7));
    return fract(sin(h) * 43758.5453123);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Fractal Brownian motion - 5 octaves for detailed clouds
float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    vec2 shift = vec2(100.0);
    for (int i = 0; i < 5; i++) {
        v += amp * noise(p);
        p = p * 2.0 + shift;
        amp *= 0.5;
    }
    return v;
}

void main() {
    // Sky gradient
    float t = v_pos.y * 0.5 + 0.5;
    t = pow(t, 0.75);
    vec3 sky = mix(u_horizon, u_zenith, t);

    // Cloud layer
    vec2 uv = vec2(v_pos.x * 2.0, v_pos.y + 0.3);
    float wind = u_time * 0.02;

    // Two layers of FBM for more complex cloud shapes
    float n1 = fbm(uv * 3.0 + vec2(wind, 0.0));
    float n2 = fbm(uv * 3.0 + vec2(wind * 0.7, 0.3) + n1 * 0.5);

    // Cloud density with threshold for distinct shapes
    float density = smoothstep(0.38, 0.65, n2);

    // Clouds thinner near bottom of screen (near horizon = haze)
    float heightFade = smoothstep(-0.3, 0.4, v_pos.y);
    density *= heightFade;

    // Cloud color: bright white in day, dim gray-blue at night
    vec3 cloudColor = vec3(u_cloudBright);
    vec3 color = mix(sky, cloudColor, density * 0.7);

    gl_FragColor = vec4(color, 1.0);
}
`;

// ========== Flag shaders ==========

const FLAG_VS = `
attribute vec2 a_uv;

uniform mat4 u_mvp;
uniform float u_time;

varying vec2 v_uv;
varying float v_shade;

const float FLAG_W = 1.5;
const float FLAG_H = 1.0;
const float PI = 3.14159265;

void main() {
    float u = a_uv.x;
    float v = a_uv.y;

    // World position on flag plane
    float x = (u - 0.5) * FLAG_W;
    float y = (v - 0.5) * FLAG_H;

    // Wave deformation: amplitude grows from pole (u=0) to free end (u=1)
    float amp = pow(u, 1.5);
    float wave1 = amp * 0.15 * sin(u * 6.283 - u_time * 2.5);
    float wave2 = amp * 0.06 * sin(u * 9.42 - u_time * 3.8);
    float z = wave1 + wave2;

    // Slight vertical flutter
    y += amp * 0.025 * sin(u * 7.85 - u_time * 3.0);

    // Normal approximation for lighting (dz/du, simplified)
    float dzdu = amp * 0.15 * 6.283 * cos(u * 6.283 - u_time * 2.5)
               + amp * 0.06 * 9.42  * cos(u * 9.42 - u_time * 3.8);
    float dzdx = dzdu / FLAG_W;
    vec3 normal = normalize(vec3(-dzdx, 0.0, 1.0));
    vec3 lightDir = normalize(vec3(0.3, 0.5, 1.0));
    v_shade = max(dot(normal, lightDir), 0.35);

    gl_Position = u_mvp * vec4(x, y, z, 1.0);
    v_uv = a_uv;
}
`;

const FLAG_FS = `
precision highp float;

varying vec2 v_uv;
varying float v_shade;

uniform vec3 u_bgColor;
uniform vec3 u_shapeColor;
uniform float u_shapeType;
uniform float u_shapeSize;
uniform float u_alpha;
uniform float u_burnLine; // negative = no burn, 0..1 = burn progress

const float FLAG_ASPECT = 1.5;

// --- SDF functions ---

float sdCircle(vec2 p, float r) {
    return length(p) - r;
}

float sdBox(vec2 p, vec2 b) {
    vec2 d = abs(p) - b;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float sdTriangle(vec2 p, float r) {
    float k = 1.732050808;
    p.x = abs(p.x) - r;
    p.y = p.y + r / k;
    if (p.x + k * p.y > 0.0) {
        p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
    }
    p.x -= clamp(p.x, -2.0 * r, 0.0);
    return -length(p) * sign(p.y);
}

float sdStar5(vec2 p, float r) {
    float innerR = r * 0.38;
    float angle = atan(p.y, p.x) + 1.5707963;
    float segAngle = 6.2831853 / 5.0;
    float halfSeg = segAngle * 0.5;
    float a = mod(angle + 6.2831853, segAngle);
    if (a > halfSeg) a = segAngle - a;
    float t = a / halfSeg;
    float targetR = mix(r, innerR, t);
    return length(p) - targetR;
}

float sdHexagon(vec2 p, float r) {
    vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
    p = abs(p);
    p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
    p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
    return length(p) * sign(p.y);
}

float sdCross(vec2 p, float size) {
    float w = size * 0.28;
    float h = size;
    float d1 = sdBox(p, vec2(w, h));
    float d2 = sdBox(p, vec2(h, w));
    return min(d1, d2);
}

float sdCrescent(vec2 p, float r) {
    float d1 = sdCircle(p, r);
    float d2 = sdCircle(p - vec2(r * 0.4, 0.0), r * 0.85);
    return max(d1, -d2);
}

float sdDiamond(vec2 p, float r) {
    vec2 rp = vec2(p.x + p.y, p.y - p.x) * 0.7071;
    return sdBox(rp, vec2(r * 0.7));
}

float sdRing(vec2 p, float r) {
    return abs(length(p) - r) - r * 0.15;
}

float getShape(vec2 p, float shapeType, float size) {
    if (shapeType < 0.5) return sdCircle(p, size);
    if (shapeType < 1.5) return sdStar5(p, size);
    if (shapeType < 2.5) return sdCrescent(p, size);
    if (shapeType < 3.5) return sdCross(p, size);
    if (shapeType < 4.5) return sdTriangle(p, size);
    if (shapeType < 5.5) return sdDiamond(p, size);
    if (shapeType < 6.5) return sdHexagon(p, size);
    return sdRing(p, size);
}

void main() {
    vec2 p = v_uv * 2.0 - 1.0;
    p.x *= FLAG_ASPECT;

    float d = getShape(p, u_shapeType, u_shapeSize);
    float shape = 1.0 - smoothstep(-0.006, 0.006, d);

    vec3 color = mix(u_bgColor, u_shapeColor, shape);

    // Apply lighting shade
    float shade = v_shade;
    if (!gl_FrontFacing) shade *= 0.75;
    color *= shade;

    if (u_burnLine >= 0.0) {
        // Burn edge: dissolve bottom-to-top
        float bl = u_burnLine;
        float edge = smoothstep(bl - 0.02, bl + 0.12, v_uv.y);
        if (edge < 0.005) discard;

        // Charring near the burn front
        float charr = smoothstep(bl + 0.05, bl + 0.30, v_uv.y);
        color = mix(vec3(0.10, 0.04, 0.01), color, charr);

        // Orange glow at the very edge
        float glow = smoothstep(bl + 0.12, bl + 0.02, v_uv.y) * edge;
        color += vec3(0.9, 0.35, 0.0) * glow * 0.6;

        gl_FragColor = vec4(color, u_alpha * edge);
    } else {
        gl_FragColor = vec4(color, u_alpha);
    }
}
`;

// ========== Pole shaders ==========

const POLE_VS = `
attribute vec3 a_position;
attribute vec3 a_normal;
uniform mat4 u_mvp;
varying vec3 v_normal;
varying vec3 v_worldPos;
void main() {
    gl_Position = u_mvp * vec4(a_position, 1.0);
    v_normal = a_normal;
    v_worldPos = a_position;
}
`;

const POLE_FS = `
precision highp float;
varying vec3 v_normal;
varying vec3 v_worldPos;
uniform vec3 u_eye;

void main() {
    vec3 N = normalize(v_normal);
    vec3 L = normalize(vec3(0.4, 0.8, 1.0));
    vec3 V = normalize(u_eye - v_worldPos);
    vec3 H = normalize(L + V);

    // Silver metal: high ambient, diffuse, strong specular
    vec3 baseColor = vec3(0.75, 0.76, 0.78);
    float diff = max(dot(N, L), 0.0) * 0.4;
    float spec = pow(max(dot(N, H), 0.0), 60.0) * 0.8;
    float ambient = 0.35;

    vec3 color = baseColor * (ambient + diff) + vec3(1.0) * spec;
    gl_FragColor = vec4(color, 1.0);
}
`;

// Pole geometry: shiny metal cylinder at left edge of flag
const POLE_RADIUS = 0.032;
const POLE_SEGMENTS = 12;
const POLE_TOP = 0.65;    // extends above flag
const POLE_BOTTOM = -1.2; // extends below flag
const POLE_X = -FLAG_W / 2;

// Rope: connects flag top/bottom edges to the pole
const ROPE_SEGMENTS = 10;

// ========== Camera orbit parameters ==========

const CAM_DIST = 2.1;
const CAM_BASE_THETA = -0.13; // base horizontal angle (radians, slight right offset)
const CAM_BASE_PHI = -0.27;   // base vertical angle (radians, looking up from below)
const CAM_DRAG_LIMIT = 0.6;   // max drag rotation (radians)

// ========== FlagRenderer class ==========

export class FlagRenderer {
  constructor(gl) {
    this.gl = gl;
    this.startTime = performance.now() / 1000;
    this.time = 0;

    // Camera orbit angles (modified by drag)
    this.camTheta = CAM_BASE_THETA;
    this.camPhi = CAM_BASE_PHI;
    this._dragging = false;
    this._dragStartX = 0;
    this._dragStartY = 0;
    this._dragStartTheta = 0;
    this._dragStartPhi = 0;

    // --- Sky program ---
    this.skyProg = createProgram(gl, SKY_VS, SKY_FS);
    this.skyUni = getUniformLocations(gl, this.skyProg, ['u_horizon', 'u_zenith', 'u_time', 'u_cloudBright']);
    this.skyPosAttr = gl.getAttribLocation(this.skyProg, 'a_position');

    // Full-screen quad buffer (shared)
    this.quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1,
      -1, 1, 1, -1, 1, 1,
    ]), gl.STATIC_DRAW);

    // --- Flag program ---
    this.flagProg = createProgram(gl, FLAG_VS, FLAG_FS);
    this.flagUni = getUniformLocations(gl, this.flagProg, [
      'u_bgColor', 'u_shapeColor', 'u_shapeType', 'u_shapeSize',
      'u_alpha', 'u_mvp', 'u_time', 'u_burnLine',
    ]);
    this.flagUVAttr = gl.getAttribLocation(this.flagProg, 'a_uv');

    // --- Pole program ---
    this.poleProg = createProgram(gl, POLE_VS, POLE_FS);
    this.poleUni = getUniformLocations(gl, this.poleProg, ['u_mvp', 'u_eye']);
    this.polePosAttr = gl.getAttribLocation(this.poleProg, 'a_position');
    this.poleNormAttr = gl.getAttribLocation(this.poleProg, 'a_normal');

    // --- Build meshes ---
    this._buildFlagMesh();
    this._buildPoleMesh();

    // --- Compute initial MVP ---
    this.canvasAspect = gl.canvas.width / gl.canvas.height;
    this._updateMVP();

    // --- Setup drag events ---
    this._setupDrag(gl.canvas);
  }

  _updateMVP() {
    const proj = mat4Persp(FOV, this.canvasAspect, 0.1, 10);
    const view = mat4Look(this._getCamEye(), TARGET, UP);
    this.mvp = mat4Mul(proj, view);
  }

  _setupDrag(canvas) {
    const onStart = (x, y) => {
      this._dragging = true;
      this._dragStartX = x;
      this._dragStartY = y;
      this._dragStartTheta = this.camTheta;
      this._dragStartPhi = this.camPhi;
    };

    const onMove = (x, y) => {
      if (!this._dragging) return;
      const dx = (x - this._dragStartX) / canvas.width;
      const dy = (y - this._dragStartY) / canvas.height;
      this.camTheta = this._dragStartTheta + dx * 2.0;
      this.camPhi = this._dragStartPhi - dy * 2.0;
      // Clamp rotation range
      this.camTheta = Math.max(CAM_BASE_THETA - CAM_DRAG_LIMIT,
                      Math.min(CAM_BASE_THETA + CAM_DRAG_LIMIT, this.camTheta));
      this.camPhi = Math.max(CAM_BASE_PHI - CAM_DRAG_LIMIT,
                    Math.min(CAM_BASE_PHI + CAM_DRAG_LIMIT, this.camPhi));
      this._updateMVP();
    };

    const onEnd = () => { this._dragging = false; };

    // Mouse events
    canvas.addEventListener('mousedown', (e) => onStart(e.clientX, e.clientY));
    window.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', onEnd);

    // Touch events
    canvas.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      onStart(touch.clientX, touch.clientY);
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (!this._dragging) return;
      const touch = e.touches[0];
      onMove(touch.clientX, touch.clientY);
    }, { passive: true });
    window.addEventListener('touchend', onEnd);
  }

  _buildFlagMesh() {
    const { gl } = this;
    const verts = [];
    const indices = [];

    for (let iy = 0; iy <= GRID_Y; iy++) {
      for (let ix = 0; ix <= GRID_X; ix++) {
        verts.push(ix / GRID_X, iy / GRID_Y);
      }
    }

    for (let iy = 0; iy < GRID_Y; iy++) {
      for (let ix = 0; ix < GRID_X; ix++) {
        const i = iy * (GRID_X + 1) + ix;
        indices.push(i, i + 1, i + (GRID_X + 1));
        indices.push(i + 1, i + (GRID_X + 1) + 1, i + (GRID_X + 1));
      }
    }

    this.flagVBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.flagVBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);

    this.flagIBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.flagIBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    this.flagIndexCount = indices.length;
  }

  _buildPoleMesh() {
    const { gl } = this;
    // Interleaved: position(3) + normal(3) = 6 floats per vertex
    const verts = [];
    const indices = [];

    // Cylinder body: two rings with outward normals
    for (let i = 0; i <= POLE_SEGMENTS; i++) {
      const angle = (i / POLE_SEGMENTS) * Math.PI * 2;
      const nx = Math.cos(angle);
      const nz = Math.sin(angle);
      const cx = POLE_X + nx * POLE_RADIUS;
      const cz = nz * POLE_RADIUS;

      // Top vertex: pos + normal
      verts.push(cx, POLE_TOP, cz, nx, 0, nz);
      // Bottom vertex: pos + normal
      verts.push(cx, POLE_BOTTOM, cz, nx, 0, nz);
    }

    for (let i = 0; i < POLE_SEGMENTS; i++) {
      const t0 = i * 2, b0 = i * 2 + 1;
      const t1 = (i + 1) * 2, b1 = (i + 1) * 2 + 1;
      indices.push(t0, b0, t1);
      indices.push(t1, b0, b1);
    }

    // Top cap (spherical finial)
    const capBase = verts.length / 6;
    const FINIAL_R = POLE_RADIUS * 1.5;
    const CAP_RINGS = 5;
    for (let ring = 0; ring <= CAP_RINGS; ring++) {
      const phi = (ring / CAP_RINGS) * Math.PI * 0.5; // 0 (equator) to pi/2 (top)
      const rr = FINIAL_R * Math.cos(phi);
      const yy = POLE_TOP + FINIAL_R * Math.sin(phi);
      for (let i = 0; i <= POLE_SEGMENTS; i++) {
        const theta = (i / POLE_SEGMENTS) * Math.PI * 2;
        const nx = Math.cos(theta) * Math.cos(phi);
        const nz = Math.sin(theta) * Math.cos(phi);
        const ny = Math.sin(phi);
        verts.push(POLE_X + Math.cos(theta) * rr, yy, Math.sin(theta) * rr, nx, ny, nz);
      }
    }
    for (let ring = 0; ring < CAP_RINGS; ring++) {
      for (let i = 0; i < POLE_SEGMENTS; i++) {
        const a = capBase + ring * (POLE_SEGMENTS + 1) + i;
        const b = a + 1;
        const c = a + (POLE_SEGMENTS + 1);
        const d = c + 1;
        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }

    this.poleVBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.poleVBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);

    this.poleIBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.poleIBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    this.poleIndexCount = indices.length;

    // --- Rope mesh (GL_LINES) ---
    // Two ropes: top and bottom of flag, from pole to flag edge (u=0)
    // Ropes sag slightly with a catenary curve
    const ropeVerts = [];
    const flagTopY = FLAG_H / 2;
    const flagBotY = -FLAG_H / 2;
    const poleAttachX = POLE_X;

    for (const attachY of [flagTopY, flagBotY]) {
      for (let i = 0; i <= ROPE_SEGMENTS; i++) {
        const t = i / ROPE_SEGMENTS;
        // Rope runs along x from pole to flag edge, slight z offset, slight sag
        const x = poleAttachX + t * POLE_RADIUS * 2;
        const sag = -0.015 * Math.sin(t * Math.PI); // small downward sag
        const y = attachY + sag;
        const z = POLE_RADIUS * 0.5 * (1 - t); // z from pole surface to flag plane
        ropeVerts.push(x, y, z);
      }
    }

    this.ropeVBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.ropeVBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ropeVerts), gl.STATIC_DRAW);
    this.ropeVertCount = (ROPE_SEGMENTS + 1) * 2;
  }

  // Wave functions (must match GLSL exactly)
  _waveZ(u, time) {
    const amp = Math.pow(u, 1.5);
    return amp * 0.15 * Math.sin(u * 6.283 - time * 2.5)
         + amp * 0.06 * Math.sin(u * 9.42 - time * 3.8);
  }

  _waveY(u, time) {
    return Math.pow(u, 1.5) * 0.025 * Math.sin(u * 7.85 - time * 3.0);
  }

  // Project flag UV (0..1, 0..1) to screen NDC (-1..1, -1..1)
  projectFlagPoint(u, v) {
    const x = (u - 0.5) * FLAG_W;
    let y = (v - 0.5) * FLAG_H;
    y += this._waveY(u, this.time);
    const z = this._waveZ(u, this.time);

    const clip = mvMul(this.mvp, [x, y, z, 1]);
    return [clip[0] / clip[3], clip[1] / clip[3]];
  }

  renderSky() {
    this.time = performance.now() / 1000 - this.startTime;

    const { gl } = this;
    const sky = getSkyColors();

    gl.useProgram(this.skyProg);
    gl.uniform3fv(this.skyUni.u_horizon, sky.horizon);
    gl.uniform3fv(this.skyUni.u_zenith, sky.zenith);
    gl.uniform1f(this.skyUni.u_time, this.time);
    gl.uniform1f(this.skyUni.u_cloudBright, sky.cloudBright);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.enableVertexAttribArray(this.skyPosAttr);
    gl.vertexAttribPointer(this.skyPosAttr, 2, gl.FLOAT, false, 0, 0);

    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.depthMask(true);
  }

  _getCamEye() {
    return [
      CAM_DIST * Math.sin(this.camTheta) * Math.cos(this.camPhi),
      CAM_DIST * Math.sin(this.camPhi),
      CAM_DIST * Math.cos(this.camTheta) * Math.cos(this.camPhi),
    ];
  }

  renderPole() {
    const { gl } = this;
    const stride = 6 * 4; // 6 floats per vertex

    gl.useProgram(this.poleProg);
    gl.uniformMatrix4fv(this.poleUni.u_mvp, false, this.mvp);
    gl.uniform3fv(this.poleUni.u_eye, this._getCamEye());

    gl.bindBuffer(gl.ARRAY_BUFFER, this.poleVBuf);
    gl.enableVertexAttribArray(this.polePosAttr);
    gl.vertexAttribPointer(this.polePosAttr, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(this.poleNormAttr);
    gl.vertexAttribPointer(this.poleNormAttr, 3, gl.FLOAT, false, stride, 12);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.poleIBuf);

    gl.enable(gl.DEPTH_TEST);
    gl.drawElements(gl.TRIANGLES, this.poleIndexCount, gl.UNSIGNED_SHORT, 0);

    // Draw ropes as line strips (reuse sky program with flat color hack)
    // Use pole shader but with zero normal for flat shading
    gl.bindBuffer(gl.ARRAY_BUFFER, this.ropeVBuf);
    gl.vertexAttribPointer(this.polePosAttr, 3, gl.FLOAT, false, 0, 0);
    gl.disableVertexAttribArray(this.poleNormAttr);
    gl.vertexAttrib3f(this.poleNormAttr, 0, 1, 0); // upward normal for consistent color

    gl.lineWidth(1.0);
    gl.drawArrays(gl.LINE_STRIP, 0, ROPE_SEGMENTS + 1); // top rope
    gl.drawArrays(gl.LINE_STRIP, ROPE_SEGMENTS + 1, ROPE_SEGMENTS + 1); // bottom rope

    gl.enableVertexAttribArray(this.poleNormAttr);
    gl.disable(gl.DEPTH_TEST);
  }

  renderFlag(flag, alpha, burnLine = -1) {
    const { gl } = this;

    // Pole first (behind flag)
    this.renderPole();

    gl.useProgram(this.flagProg);

    gl.uniformMatrix4fv(this.flagUni.u_mvp, false, this.mvp);
    gl.uniform1f(this.flagUni.u_time, this.time);
    gl.uniform3fv(this.flagUni.u_bgColor, flag.bgColor);
    gl.uniform3fv(this.flagUni.u_shapeColor, flag.shapeColor);
    gl.uniform1f(this.flagUni.u_shapeType, flag.shapeType);
    gl.uniform1f(this.flagUni.u_shapeSize, flag.shapeSize);
    gl.uniform1f(this.flagUni.u_alpha, alpha);
    gl.uniform1f(this.flagUni.u_burnLine, burnLine);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.flagVBuf);
    gl.enableVertexAttribArray(this.flagUVAttr);
    gl.vertexAttribPointer(this.flagUVAttr, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.flagIBuf);

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.drawElements(gl.TRIANGLES, this.flagIndexCount, gl.UNSIGNED_SHORT, 0);

    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
  }

  // Convenience: render sky + pole + flag
  render(flag, alpha) {
    this.renderSky();
    this.renderFlag(flag, alpha);
  }
}
