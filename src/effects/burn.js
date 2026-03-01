// Burn effect - flames spread upward from bottom of the flag

import { ParticleEffect, FLOATS_PER_PARTICLE } from './base.js';

const LIFE_DECAY = 0.4;
const RISE_SPEED = 0.8;
const SWAY_STRENGTH = 1.5;
const BURN_SPREAD_TIME = 1.2; // seconds for fire to reach top of flag

export class BurnEffect extends ParticleEffect {
  constructor(gl) {
    super(gl);
    this.elapsed = 0;
  }

  // How far the burn front has progressed (0 = bottom, 1 = top consumed)
  get burnProgress() {
    return Math.min(1.0, this.elapsed / BURN_SPREAD_TIME);
  }

  emit(flag, projectFn) {
    this.initGrid(flag, projectFn);
    this.elapsed = 0;

    for (let i = 0; i < this.particleCount; i++) {
      const idx = i * FLOATS_PER_PARTICLE;
      const [, v] = this.getUV(i);

      // Stagger ignition: bottom particles (v=0) start first
      const ignitionDelay = v * BURN_SPREAD_TIME;
      this.particles[idx + 7] = -ignitionDelay; // negative = waiting

      // Upward velocity with horizontal sway
      this.particles[idx + 2] = (Math.random() - 0.5) * SWAY_STRENGTH;
      this.particles[idx + 3] = RISE_SPEED + Math.random() * 0.6;

      // Warm color tint: shift original color toward red/orange/yellow
      const r = this.particles[idx + 4];
      const g = this.particles[idx + 5];
      const b = this.particles[idx + 6];
      this.particles[idx + 4] = Math.min(1.0, r * 0.4 + 0.6);
      this.particles[idx + 5] = Math.min(1.0, g * 0.3 + Math.random() * 0.15);
      this.particles[idx + 6] = b * 0.1;

      this.particles[idx + 8] = 5.0 + Math.random() * 5.0;
    }

    this.alive = true;
  }

  update(dt) {
    if (!this.alive) return;
    this.elapsed += dt;
    let anyAlive = false;

    for (let i = 0; i < this.particleCount; i++) {
      const idx = i * FLOATS_PER_PARTICLE;
      let life = this.particles[idx + 7];

      // Waiting to ignite
      if (life < 0) {
        life += dt;
        if (life >= 0) life = 1.0;
        this.particles[idx + 7] = life;
        if (life < 0) { anyAlive = true; continue; }
      }

      if (life <= 0) continue;

      life -= LIFE_DECAY * dt;
      if (life <= 0) { this.particles[idx + 7] = 0; continue; }

      // Horizontal sway oscillation
      this.particles[idx + 2] += (Math.random() - 0.5) * 3.0 * dt;

      this.particles[idx + 0] += this.particles[idx + 2] * dt;
      this.particles[idx + 1] += this.particles[idx + 3] * dt;
      this.particles[idx + 7] = life;
      anyAlive = true;
    }

    if (!anyAlive) this.alive = false;
  }
}
