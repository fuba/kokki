// Main application entry point

import { FlagRenderer } from './flag-renderer.js';
import { ParticleSystem } from './particles.js';
import { playExplosionSound } from './sound.js';

const SHAPE_NAMES = [
  '円', '星', '三日月', '十字',
  '三角', '菱形', '六角', '輪',
];

const canvas = document.getElementById('canvas');
const btn = document.getElementById('explode-btn');
const info = document.getElementById('info');

const gl = canvas.getContext('webgl', { alpha: false, antialias: true });
if (!gl) {
  document.body.innerHTML = '<h2>WebGL非対応</h2>';
  throw new Error('WebGL not supported');
}

const flagRenderer = new FlagRenderer(gl);
const particleSystem = new ParticleSystem(gl);

// State machine: idle -> spinning -> settling -> exploding -> fading_in -> idle
let state = 'idle';
let currentFlag = generateFlag();
let fadeInAlpha = 1.0;

// Roulette state
let spinTimer = 0;
let spinInterval = 0.03; // seconds between flag changes (starts fast)
let spinElapsed = 0;
let spinDuration = 0;
const SPIN_MIN_DURATION = 1.5;
const SPIN_MAX_DURATION = 2.5;
const SETTLE_SLOW_START = 0.7; // start slowing at 70% through

showFlagInfo(currentFlag);

function randomColor() {
  return [Math.random(), Math.random(), Math.random()];
}

function generateFlag() {
  return {
    bgColor: randomColor(),
    shapeColor: randomColor(),
    shapeType: Math.floor(Math.random() * SHAPE_NAMES.length),
    shapeSize: 0.2 + Math.random() * 0.25,
  };
}

function showFlagInfo(flag) {
  info.textContent = `${SHAPE_NAMES[flag.shapeType]}｜${rgbToHex(flag.bgColor)}｜${rgbToHex(flag.shapeColor)}`;
}

function rgbToHex([r, g, b]) {
  const toHex = (v) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function startSpin() {
  if (state !== 'idle') return;

  state = 'spinning';
  btn.disabled = true;
  spinTimer = 0;
  spinElapsed = 0;
  spinInterval = 0.03;
  spinDuration = SPIN_MIN_DURATION + Math.random() * (SPIN_MAX_DURATION - SPIN_MIN_DURATION);
}

btn.addEventListener('click', startSpin);

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    startSpin();
  }
});

let lastTime = performance.now();

function render(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  gl.viewport(0, 0, canvas.width, canvas.height);
  // Canvas background matches page background when clearing
  gl.clearColor(0.96, 0.94, 0.91, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  if (state === 'idle') {
    flagRenderer.render(currentFlag, 1.0);

  } else if (state === 'spinning') {
    spinElapsed += dt;
    spinTimer += dt;

    // Slow down as we approach the end
    const progress = spinElapsed / spinDuration;
    if (progress > SETTLE_SLOW_START) {
      const slowFactor = (progress - SETTLE_SLOW_START) / (1.0 - SETTLE_SLOW_START);
      spinInterval = 0.03 + slowFactor * 0.25;
    }

    if (spinTimer >= spinInterval) {
      spinTimer = 0;
      currentFlag = generateFlag();
      showFlagInfo(currentFlag);
    }

    flagRenderer.render(currentFlag, 1.0);

    // Transition to exploding when spin is done
    if (spinElapsed >= spinDuration) {
      state = 'exploding';
      playExplosionSound();
      particleSystem.emit(currentFlag, canvas.width, canvas.height);
    }

  } else if (state === 'exploding') {
    particleSystem.update(dt);
    particleSystem.render();

    if (particleSystem.isDead()) {
      state = 'fading_in';
      currentFlag = generateFlag();
      showFlagInfo(currentFlag);
      fadeInAlpha = 0;
    }

  } else if (state === 'fading_in') {
    fadeInAlpha += dt * 2.5;
    if (fadeInAlpha >= 1.0) {
      fadeInAlpha = 1.0;
      state = 'idle';
      btn.disabled = false;
    }
    flagRenderer.render(currentFlag, fadeInAlpha);
  }

  requestAnimationFrame(render);
}

requestAnimationFrame(render);
