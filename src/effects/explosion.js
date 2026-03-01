// Explosion effect - particles fly outward radially from flag position

import { ParticleEffect, FLOATS_PER_PARTICLE } from './base.js';

const GRAVITY = -1.2;
const LIFE_DECAY = 0.35;

export class ExplosionEffect extends ParticleEffect {
  emit(flag, projectFn) {
    this.initGrid(flag, projectFn);

    // Flag center in screen NDC
    const [cx, cy] = projectFn(0.5, 0.5);

    for (let i = 0; i < this.particleCount; i++) {
      const idx = i * FLOATS_PER_PARTICLE;
      const x = this.particles[idx + 0];
      const y = this.particles[idx + 1];

      const speed = 1.5 + Math.random() * 2.5;
      const angle = Math.atan2(y - cy, x - cx) + (Math.random() - 0.5) * 0.8;
      this.particles[idx + 2] = Math.cos(angle) * speed;
      this.particles[idx + 3] = Math.sin(angle) * speed;
      this.particles[idx + 8] = 4.0 + Math.random() * 6.0;
    }

    this.alive = true;
  }

  update(dt) {
    if (!this.alive) return;
    let anyAlive = false;

    for (let i = 0; i < this.particleCount; i++) {
      const idx = i * FLOATS_PER_PARTICLE;
      let life = this.particles[idx + 7];
      if (life <= 0) continue;

      life -= LIFE_DECAY * dt;
      if (life <= 0) { this.particles[idx + 7] = 0; continue; }

      this.particles[idx + 3] += GRAVITY * dt;
      this.particles[idx + 0] += this.particles[idx + 2] * dt;
      this.particles[idx + 1] += this.particles[idx + 3] * dt;
      this.particles[idx + 7] = life;
      anyAlive = true;
    }

    if (!anyAlive) this.alive = false;
  }
}
