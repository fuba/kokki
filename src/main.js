// Main application entry point

import { FlagRenderer } from './flag-renderer.js';
import { ParticleSystem } from './particles.js';
import { playExplosionSound } from './sound.js';

const SHAPE_NAMES = [
  'Circle', 'Star', 'Crescent', 'Cross',
  'Triangle', 'Diamond', 'Hexagon', 'Ring',
];

const canvas = document.getElementById('canvas');
const btn = document.getElementById('explode-btn');
const info = document.getElementById('info');

const gl = canvas.getContext('webgl', { alpha: false, antialias: true });
if (!gl) {
  document.body.innerHTML = '<h2>WebGL is not supported in your browser.</h2>';
  throw new Error('WebGL not supported');
}

const flagRenderer = new FlagRenderer(gl);
const particleSystem = new ParticleSystem(gl);

let state = 'flag'; // 'flag' | 'exploding' | 'fading_in'
let currentFlag = generateFlag();
let fadeInAlpha = 0;

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
  const bgHex = rgbToHex(flag.bgColor);
  const shapeHex = rgbToHex(flag.shapeColor);
  info.textContent = `${SHAPE_NAMES[flag.shapeType]} | bg: ${bgHex} | shape: ${shapeHex}`;
}

function rgbToHex([r, g, b]) {
  const toHex = (v) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function explode() {
  if (state !== 'flag') return;

  state = 'exploding';
  btn.disabled = true;

  playExplosionSound();
  particleSystem.emit(currentFlag, canvas.width, canvas.height);
}

btn.addEventListener('click', explode);

// Allow spacebar to trigger explosion
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    explode();
  }
});

let lastTime = performance.now();

function render(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  if (state === 'flag') {
    flagRenderer.render(currentFlag, 1.0);
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
      state = 'flag';
      btn.disabled = false;
    }
    flagRenderer.render(currentFlag, fadeInAlpha);
  }

  requestAnimationFrame(render);
}

requestAnimationFrame(render);
