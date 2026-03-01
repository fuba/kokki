// Particle explosion system rendered with WebGL

import { createProgram, getUniformLocations } from './webgl-utils.js';
import { isInsideShape } from './shapes.js';

const VS = `
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

const FS = `
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
const PARTICLE_FLOATS = 9;
const GRAVITY = -1.2;
const LIFE_DECAY = 0.6;

export class ParticleSystem {
  constructor(gl) {
    this.gl = gl;
    this.program = createProgram(gl, VS, FS);
    this.uniforms = getUniformLocations(gl, this.program, []);

    this.aPosition = gl.getAttribLocation(this.program, 'a_position');
    this.aColor = gl.getAttribLocation(this.program, 'a_color');
    this.aLife = gl.getAttribLocation(this.program, 'a_life');
    this.aSize = gl.getAttribLocation(this.program, 'a_size');

    this.buffer = gl.createBuffer();

    this.particles = new Float32Array(PARTICLE_COUNT * PARTICLE_FLOATS);
    // GPU data: x, y, r, g, b, life, size
    this.gpuData = new Float32Array(PARTICLE_COUNT * 7);
    this.alive = false;
  }

  emit(flag, canvasWidth, canvasHeight) {
    const aspect = canvasWidth / canvasHeight;
    const gridCols = Math.ceil(Math.sqrt(PARTICLE_COUNT * aspect));
    const gridRows = Math.ceil(PARTICLE_COUNT / gridCols);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const col = i % gridCols;
      const row = Math.floor(i / gridCols);

      // Map to NDC (-1 to 1)
      const x = (col / (gridCols - 1)) * 2 - 1;
      const y = (row / (gridRows - 1)) * 2 - 1;

      // Determine color from flag analytically
      const px = x * aspect;
      const py = y;
      const inside = isInsideShape(px, py, flag.shapeType, flag.shapeSize);
      const color = inside ? flag.shapeColor : flag.bgColor;

      // Velocity: radial outward + random perturbation
      const speed = 1.5 + Math.random() * 2.5;
      const angle = Math.atan2(y, x) + (Math.random() - 0.5) * 0.8;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      const idx = i * PARTICLE_FLOATS;
      this.particles[idx + 0] = x;
      this.particles[idx + 1] = y;
      this.particles[idx + 2] = vx;
      this.particles[idx + 3] = vy;
      this.particles[idx + 4] = color[0];
      this.particles[idx + 5] = color[1];
      this.particles[idx + 6] = color[2];
      this.particles[idx + 7] = 1.0;
      this.particles[idx + 8] = 4.0 + Math.random() * 6.0; // fixed size per particle
    }

    this.alive = true;
  }

  update(dt) {
    if (!this.alive) return;

    let anyAlive = false;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const idx = i * PARTICLE_FLOATS;
      let life = this.particles[idx + 7];
      if (life <= 0) continue;

      life -= LIFE_DECAY * dt;
      if (life <= 0) {
        life = 0;
        this.particles[idx + 7] = 0;
        continue;
      }

      // Apply gravity
      this.particles[idx + 3] += GRAVITY * dt;

      // Update position
      this.particles[idx + 0] += this.particles[idx + 2] * dt;
      this.particles[idx + 1] += this.particles[idx + 3] * dt;
      this.particles[idx + 7] = life;

      anyAlive = true;
    }

    if (!anyAlive) {
      this.alive = false;
    }
  }

  isDead() {
    return !this.alive;
  }

  render() {
    if (!this.alive) return;

    const { gl } = this;

    // Pack GPU data: x, y, r, g, b, life, size
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const si = i * PARTICLE_FLOATS;
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

    gl.drawArrays(gl.POINTS, 0, PARTICLE_COUNT);

    gl.disable(gl.BLEND);
  }
}
