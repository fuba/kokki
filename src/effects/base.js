// Base class for particle-based destruction effects

import { createProgram } from '../webgl-utils.js';
import { isInsideShape } from '../shapes.js';

// Shared particle shaders
const PARTICLE_VS = `
attribute vec2 a_position;
attribute vec3 a_color;
attribute float a_life;
attribute float a_size;

varying vec3 v_color;
varying float v_life;

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    gl_PointSize = a_size * a_life;
    v_color = a_color;
    v_life = a_life;
}
`;

const PARTICLE_FS = `
precision highp float;

varying vec3 v_color;
varying float v_life;

void main() {
    vec2 center = gl_PointCoord - 0.5;
    float dist = length(center);
    if (dist > 0.5) discard;

    float edge = smoothstep(0.5, 0.3, dist);
    float alpha = v_life * edge;

    gl_FragColor = vec4(v_color * alpha, alpha);
}
`;

const PARTICLE_COUNT = 3000;
// x, y, vx, vy, r, g, b, life, size
const FLOATS_PER_PARTICLE = 9;
const FLAG_ASPECT = 1.5;

export class ParticleEffect {
  constructor(gl) {
    this.gl = gl;
    this.program = createProgram(gl, PARTICLE_VS, PARTICLE_FS);

    this.aPosition = gl.getAttribLocation(this.program, 'a_position');
    this.aColor = gl.getAttribLocation(this.program, 'a_color');
    this.aLife = gl.getAttribLocation(this.program, 'a_life');
    this.aSize = gl.getAttribLocation(this.program, 'a_size');

    this.buffer = gl.createBuffer();

    this.particles = new Float32Array(PARTICLE_COUNT * FLOATS_PER_PARTICLE);
    this.gpuData = new Float32Array(PARTICLE_COUNT * 7);
    this.alive = false;
    this.particleCount = PARTICLE_COUNT;
    this.gridCols = 0;
    this.gridRows = 0;
  }

  // Place particles on the flag surface and project to screen NDC
  // projectFn(u, v) => [ndcX, ndcY]
  initGrid(flag, projectFn) {
    this.gridCols = Math.ceil(Math.sqrt(this.particleCount * FLAG_ASPECT));
    this.gridRows = Math.ceil(this.particleCount / this.gridCols);

    for (let i = 0; i < this.particleCount; i++) {
      const col = i % this.gridCols;
      const row = Math.floor(i / this.gridCols);

      const u = col / (this.gridCols - 1);
      const v = row / (this.gridRows - 1);

      // Project to screen NDC via 3D flag position
      const [ndcX, ndcY] = projectFn(u, v);

      // Determine color from flag SDF
      const px = (u * 2 - 1) * FLAG_ASPECT;
      const py = v * 2 - 1;
      const inside = isInsideShape(px, py, flag.shapeType, flag.shapeSize);
      const color = inside ? flag.shapeColor : flag.bgColor;

      const idx = i * FLOATS_PER_PARTICLE;
      this.particles[idx + 0] = ndcX;
      this.particles[idx + 1] = ndcY;
      this.particles[idx + 4] = color[0];
      this.particles[idx + 5] = color[1];
      this.particles[idx + 6] = color[2];
      this.particles[idx + 7] = 1.0;
    }
  }

  // Get original UV for particle index (for subclass use)
  getUV(i) {
    const col = i % this.gridCols;
    const row = Math.floor(i / this.gridCols);
    return [col / (this.gridCols - 1), row / (this.gridRows - 1)];
  }

  emit(flag, projectFn) {
    throw new Error('emit() not implemented');
  }

  isDead() {
    return !this.alive;
  }

  render() {
    if (!this.alive) return;

    const { gl } = this;

    for (let i = 0; i < this.particleCount; i++) {
      const si = i * FLOATS_PER_PARTICLE;
      const di = i * 7;
      this.gpuData[di + 0] = this.particles[si + 0];
      this.gpuData[di + 1] = this.particles[si + 1];
      this.gpuData[di + 2] = this.particles[si + 4];
      this.gpuData[di + 3] = this.particles[si + 5];
      this.gpuData[di + 4] = this.particles[si + 6];
      this.gpuData[di + 5] = this.particles[si + 7];
      this.gpuData[di + 6] = this.particles[si + 8];
    }

    gl.useProgram(this.program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.gpuData, gl.DYNAMIC_DRAW);

    const stride = 7 * 4;

    gl.enableVertexAttribArray(this.aPosition);
    gl.vertexAttribPointer(this.aPosition, 2, gl.FLOAT, false, stride, 0);

    gl.enableVertexAttribArray(this.aColor);
    gl.vertexAttribPointer(this.aColor, 3, gl.FLOAT, false, stride, 8);

    gl.enableVertexAttribArray(this.aLife);
    gl.vertexAttribPointer(this.aLife, 1, gl.FLOAT, false, stride, 20);

    gl.enableVertexAttribArray(this.aSize);
    gl.vertexAttribPointer(this.aSize, 1, gl.FLOAT, false, stride, 24);

    gl.drawArrays(gl.POINTS, 0, this.particleCount);

    gl.disable(gl.BLEND);
  }
}

export { FLOATS_PER_PARTICLE, PARTICLE_COUNT };
