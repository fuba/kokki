// Main application entry point

import { FlagRenderer } from './flag-renderer.js';
import { ParticleSystem } from './particles.js';
import { playExplosionSound } from './sound.js';
import { playKimigayo } from './kimigayo.js';

// Fixed palettes: 5 shapes x 5 bg colors x 5 shape colors = 125 combinations
// Japanese flag (white bg + red circle) = 1/125 chance

// Circle size 0.3 = radius, diameter 0.6 = 3/5 of flag height (official Japan ratio)
const SHAPES = [
  { type: 0, name: '円',   size: 0.30 },
  { type: 1, name: '星',   size: 0.35 },
  { type: 2, name: '三日月', size: 0.35 },
  { type: 3, name: '十字', size: 0.30 },
  { type: 4, name: '三角', size: 0.38 },
];

const BG_COLORS = [
  { rgb: [1.0, 1.0, 1.0],   name: '白' },   // white - Japan bg
  { rgb: [0.8, 0.0, 0.0],   name: '赤' },   // red
  { rgb: [0.0, 0.2, 0.6],   name: '青' },   // blue
  { rgb: [0.0, 0.4, 0.2],   name: '緑' },   // green
  { rgb: [1.0, 0.8, 0.0],   name: '黄' },   // yellow
];

const SHAPE_COLORS = [
  { rgb: [0.8, 0.0, 0.0],   name: '赤' },   // red - Japan circle
  { rgb: [1.0, 1.0, 1.0],   name: '白' },   // white
  { rgb: [0.0, 0.2, 0.6],   name: '青' },   // blue
  { rgb: [1.0, 0.8, 0.0],   name: '黄' },   // yellow
  { rgb: [0.0, 0.0, 0.0],   name: '黒' },   // black
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

// State machine: idle -> spinning -> showing (1s pause) -> exploding -> fading_in -> idle
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

// Showing state (pause before explosion)
let showTimer = 0;
let showDuration = 1.0;
const SHOW_DURATION_NORMAL = 1.0;
const SHOW_DURATION_KIMIGAYO = 3.0;

showFlagInfo(currentFlag);

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateFlag() {
  const shape = pick(SHAPES);
  const bg = pick(BG_COLORS);
  const sc = pick(SHAPE_COLORS);
  return {
    bgColor: bg.rgb,
    shapeColor: sc.rgb,
    shapeType: shape.type,
    shapeSize: shape.size,
    bgName: bg.name,
    shapeName: shape.name,
    shapeColorName: sc.name,
  };
}

function isJapaneseFlag(flag) {
  return flag.shapeType === 0 &&
    flag.bgColor[0] === 1.0 && flag.bgColor[1] === 1.0 && flag.bgColor[2] === 1.0 &&
    flag.shapeColor[0] === 0.8 && flag.shapeColor[1] === 0.0 && flag.shapeColor[2] === 0.0;
}

function showFlagInfo(flag) {
  info.textContent = `${flag.shapeName}｜地：${flag.bgName}｜紋：${flag.shapeColorName}`;
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

    // Transition to showing when spin is done
    if (spinElapsed >= spinDuration) {
      state = 'showing';
      showTimer = 0;
      if (isJapaneseFlag(currentFlag)) {
        showDuration = SHOW_DURATION_KIMIGAYO;
        playKimigayo();
      } else {
        showDuration = SHOW_DURATION_NORMAL;
      }
    }

  } else if (state === 'showing') {
    // Hold the final flag for a moment before exploding
    showTimer += dt;
    flagRenderer.render(currentFlag, 1.0);

    if (showTimer >= showDuration) {
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
