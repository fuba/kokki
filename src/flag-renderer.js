// Flag renderer using WebGL with SDF shapes

import { createProgram, getUniformLocations } from './webgl-utils.js';

const VS = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_uv = a_position;
}
`;

const FS = `
precision highp float;

varying vec2 v_uv;

uniform vec3 u_bgColor;
uniform vec3 u_shapeColor;
uniform float u_shapeType;
uniform float u_shapeSize;
uniform float u_alpha;
uniform float u_aspect;

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
    vec2 p = v_uv;
    p.x *= u_aspect;

    float d = getShape(p, u_shapeType, u_shapeSize);

    // Anti-aliased edge
    float shape = 1.0 - smoothstep(-0.006, 0.006, d);

    vec3 color = mix(u_bgColor, u_shapeColor, shape);

    // Fade to black for fade-in effect
    color *= u_alpha;

    gl_FragColor = vec4(color, 1.0);
}
`;

export class FlagRenderer {
  constructor(gl) {
    this.gl = gl;
    this.program = createProgram(gl, VS, FS);
    this.uniforms = getUniformLocations(gl, this.program, [
      'u_bgColor', 'u_shapeColor', 'u_shapeType',
      'u_shapeSize', 'u_alpha', 'u_aspect',
    ]);

    // Full-screen quad
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1,  -1, 1,
      -1,  1,  1, -1,   1, 1,
    ]), gl.STATIC_DRAW);
    this.buffer = buffer;

    this.aPosition = gl.getAttribLocation(this.program, 'a_position');
  }

  render(flag, alpha) {
    const { gl } = this;
    const aspect = gl.canvas.width / gl.canvas.height;

    gl.useProgram(this.program);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(this.aPosition);
    gl.vertexAttribPointer(this.aPosition, 2, gl.FLOAT, false, 0, 0);

    gl.uniform3fv(this.uniforms.u_bgColor, flag.bgColor);
    gl.uniform3fv(this.uniforms.u_shapeColor, flag.shapeColor);
    gl.uniform1f(this.uniforms.u_shapeType, flag.shapeType);
    gl.uniform1f(this.uniforms.u_shapeSize, flag.shapeSize);
    gl.uniform1f(this.uniforms.u_alpha, alpha);
    gl.uniform1f(this.uniforms.u_aspect, aspect);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}
