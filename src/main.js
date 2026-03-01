// Main application entry point

import { FlagRenderer } from './flag-renderer.js';
import { ExplosionEffect } from './effects/explosion.js';
import { BurnEffect } from './effects/burn.js';
import { playEffectSound } from './sound.js';
import { encodeAPNG } from './apng-encoder.js';
import { playKimigayo, stopKimigayo, KIMIGAYO_CHORUS_SEC } from './kimigayo.js';
import { playAnthem, stopAnthem } from './anthems.js';
import { t, lang } from './i18n.js';

// Fixed palettes: 5 shapes x 5 bg colors x 5 shape colors = 125 combinations
// Japanese flag (white bg + red circle) = 1/125 chance

const SHAPES = [
  { type: 0, name: '円',   size: 0.42 },
  { type: 1, name: '星',   size: 0.45 },
  { type: 2, name: '三日月', size: 0.40 },
  { type: 3, name: '十字', size: 0.42 },
  { type: 4, name: '三角', size: 0.50 },
];

const BG_COLORS = [
  { rgb: [1.0, 1.0, 1.0],   name: '白' },
  { rgb: [0.8, 0.0, 0.0],   name: '赤' },
  { rgb: [0.0, 0.2, 0.6],   name: '青' },
  { rgb: [0.0, 0.4, 0.2],   name: '緑' },
  { rgb: [1.0, 0.8, 0.0],   name: '黄' },
];

const SHAPE_COLORS = [
  { rgb: [0.8, 0.0, 0.0],   name: '赤' },
  { rgb: [1.0, 1.0, 1.0],   name: '白' },
  { rgb: [0.0, 0.2, 0.6],   name: '青' },
  { rgb: [1.0, 0.8, 0.0],   name: '黄' },
  { rgb: [0.0, 0.0, 0.0],   name: '黒' },
];

const EFFECT_TYPES = ['explosion', 'burn'];

// ========== DOM elements ==========

const canvas = document.getElementById('canvas');
const btn = document.getElementById('explode-btn');
const info = document.getElementById('info');
const resultOverlay = document.getElementById('result-overlay');
const resultTitle = document.getElementById('result-title');
const downloadBtn = document.getElementById('download-btn');
const shareXBtn = document.getElementById('share-x-btn');
const resultWarning = document.getElementById('result-warning');
const resultWarningTitle = document.getElementById('result-warning-title');
const resultWarningBody = document.getElementById('result-warning-body');
const resultCloseBtn = document.getElementById('result-close-btn');
const resultFlagImg = document.getElementById('result-flag');

// ========== Apply i18n to static elements ==========

document.title = t.pageTitle;
document.getElementById('heading').textContent = t.heading;
document.getElementById('section-title').textContent = t.sectionTitle;
btn.textContent = t.destroyBtn;
document.getElementById('result-header').textContent = t.resultHeader;
resultFlagImg.alt = t.resultFlagAlt;
document.getElementById('download-label').textContent = t.downloadBtn;
document.getElementById('share-x-label').textContent = t.shareXBtn;
resultCloseBtn.textContent = t.closeBtn;
document.getElementById('footer').textContent = t.footer;

// ========== WebGL setup ==========

const gl = canvas.getContext('webgl', { alpha: false, antialias: true, preserveDrawingBuffer: true, depth: true });
if (!gl) {
  document.body.innerHTML = `<h2>${t.webglError}</h2>`;
  throw new Error('WebGL not supported');
}

const flagRenderer = new FlagRenderer(gl);

// Effect instances (reused)
const effects = {
  explosion: new ExplosionEffect(gl),
  burn: new BurnEffect(gl),
};

// ========== State machine ==========
// idle -> spinning -> showing -> exploding -> result -> spinning -> ...

let state = 'idle';
let currentFlag = generateFlag();
let explodedFlag = null;
let capturedFlagImage = null;
let fadeInAlpha = 1.0;
let currentEffectType = null;
let currentEffect = null;

// APNG capture state
const ANIM_FPS = 12;
const ANIM_FRAME_INTERVAL = 1 / ANIM_FPS;
let animFrames = [];
let animFrameTimer = 0;
let capturedAnimURL = null;

// Roulette state
let spinTimer = 0;
let spinInterval = 0.03;
let spinElapsed = 0;
let spinDuration = 0;
const SPIN_MIN_DURATION = 1.5;
const SPIN_MAX_DURATION = 2.5;
const SETTLE_SLOW_START = 0.7;

// Showing state (pause before destruction)
let showTimer = 0;
let showDuration = 1.0;
const SHOW_DURATION_NORMAL = 1.0;
const SHOW_DURATION_KIMIGAYO = KIMIGAYO_CHORUS_SEC;

showFlagInfo(currentFlag);

// ========== Helpers ==========

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

// Known real-world flags
const KNOWN_FLAGS = [
  { bg: '白', sc: '赤', shape: '円',   country: '日本',         countryEn: 'Japan',       japan: true },
  { bg: '緑', sc: '赤', shape: '円',   country: 'バングラデシュ', countryEn: 'Bangladesh' },
  { bg: '青', sc: '黄', shape: '円',   country: 'パラオ',        countryEn: 'Palau' },
  { bg: '赤', sc: '黄', shape: '星',   country: 'ベトナム',      countryEn: 'Vietnam' },
  { bg: '青', sc: '白', shape: '星',   country: 'ソマリア',      countryEn: 'Somalia' },
  { bg: '赤', sc: '白', shape: '十字', country: 'スイス',        countryEn: 'Switzerland' },
  { bg: '赤', sc: '白', shape: '三日月', country: 'トルコ',      countryEn: 'Turkey' },
  { bg: '緑', sc: '白', shape: '三日月', country: 'パキスタン',   countryEn: 'Pakistan' },
  { bg: '白', sc: '赤', shape: '三日月', country: 'チュニジア',   countryEn: 'Tunisia' },
];

const POLICE_STATIONS = [
  '警視庁 丸の内警察署（東京都千代田区丸の内一丁目1番1号）',
  '警視庁 麹町警察署（東京都千代田区麹町五丁目1番6号）',
  '大阪府警察 曽根崎警察署（大阪市北区曽根崎二丁目16番14号）',
  '神奈川県警察 加賀町警察署（横浜市中区山下町203番地）',
  '愛知県警察 中警察署（名古屋市中区丸の内三丁目27番26号）',
  '京都府警察 五条警察署（京都市下京区大宮通松原下ル上五条町394番地）',
  '福岡県警察 博多警察署（福岡市博多区博多駅前一丁目1番1号）',
  '北海道警察 札幌中央警察署（札幌市中央区北一条西五丁目11番地）',
];

function matchFlag(flag) {
  return KNOWN_FLAGS.find(
    (k) => k.bg === flag.bgName && k.sc === flag.shapeColorName && k.shape === flag.shapeName
  ) || null;
}

// Near-miss: circle shape + one color matches Japan (white bg XOR red emblem)
function isNearMissJapan(flag) {
  if (flag.shapeName !== '円') return false;
  const whiteBg = flag.bgName === '白';
  const redSc = flag.shapeColorName === '赤';
  return whiteBg !== redSc; // exactly one matches
}
const SHOW_DURATION_NEAR_MISS = 5.0;

function localizeShape(name) { return t.shapes[name] || name; }
function localizeColor(name) { return t.colors[name] || name; }

function showFlagInfo(flag) {
  info.textContent = t.infoFormat(
    localizeShape(flag.shapeName),
    localizeColor(flag.bgName),
    localizeColor(flag.shapeColorName)
  );
}

function showResultDialog(flag) {
  const match = matchFlag(flag);
  lastMatchResult = match;
  const countryName = match ? (lang === 'en' ? match.countryEn : match.country) : null;

  resultFlagImg.src = capturedFlagImage;

  if (match) {
    resultTitle.textContent = match.japan ? t.resultJapan : t.resultCountry(countryName);
    resultWarning.style.display = 'block';

    if (match.japan) {
      resultWarningTitle.textContent = t.warningJapanTitle;
      resultWarningBody.innerHTML = t.warningJapanBody(
        POLICE_STATIONS[Math.floor(Math.random() * POLICE_STATIONS.length)]
      );
    } else {
      resultWarningTitle.textContent = t.warningForeignTitle;
      resultWarningBody.innerHTML = t.warningForeignBody(countryName);
    }
  } else {
    resultTitle.textContent = t.resultGeneric;
    resultWarning.style.display = 'none';
  }

  resultOverlay.classList.add('visible');
}

function hideResultDialog() {
  resultOverlay.classList.remove('visible');
  // "再度損壊" -> skip idle, go directly to spinning
  currentFlag = generateFlag();
  showFlagInfo(currentFlag);
  state = 'spinning';
  btn.disabled = true;
  spinTimer = 0;
  spinElapsed = 0;
  spinInterval = 0.03;
  spinDuration = SPIN_MIN_DURATION + Math.random() * (SPIN_MAX_DURATION - SPIN_MIN_DURATION);
}

resultCloseBtn.addEventListener('click', hideResultDialog);

// Download APNG (falls back to static PNG if not ready)
downloadBtn.addEventListener('click', () => {
  const url = capturedAnimURL || capturedFlagImage;
  if (!url) return;
  const a = document.createElement('a');
  a.href = url;
  a.download = 'destroyed-flag.png';
  a.click();
});

// Share to X (Twitter)
let lastMatchResult = null;
shareXBtn.addEventListener('click', () => {
  let text;
  if (lastMatchResult && lastMatchResult.japan) {
    text = t.shareTextJapan;
  } else if (lastMatchResult) {
    const name = lang === 'en' ? lastMatchResult.countryEn : lastMatchResult.country;
    text = t.shareTextCountry(name);
  } else {
    text = t.shareText;
  }
  const url = location.href;
  window.open(
    `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
    '_blank'
  );
});

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
    if (state === 'result') {
      hideResultDialog();
    } else {
      startSpin();
    }
  }

  // Hidden key sequences to trigger anthem
  kimigayoBuf += e.key.toLowerCase();
  if (kimigayoBuf.length > 20) kimigayoBuf = kimigayoBuf.slice(-20);
  if (kimigayoBuf.endsWith('kimigayo')) {
    kimigayoBuf = '';
    playKimigayo();
  } else if (kimigayoBuf.endsWith('yogamiki')) {
    kimigayoBuf = '';
    playKimigayo(true); // broken version
  }
});

let kimigayoBuf = '';

// ========== Render loop ==========

let lastTime = performance.now();

function render(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Always render sky background
  flagRenderer.renderSky();

  if (state === 'idle') {
    flagRenderer.renderFlag(currentFlag, 1.0);

  } else if (state === 'spinning') {
    spinElapsed += dt;
    spinTimer += dt;

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

    flagRenderer.renderFlag(currentFlag, 1.0);

    if (spinElapsed >= spinDuration) {
      state = 'showing';
      showTimer = 0;
      const match = matchFlag(currentFlag);
      if (match && match.japan) {
        showDuration = SHOW_DURATION_KIMIGAYO;
        playKimigayo();
      } else if (match) {
        // Foreign country matched — play its national anthem
        const anthemDur = playAnthem(match.countryEn);
        showDuration = anthemDur > 0 ? anthemDur + 0.5 : SHOW_DURATION_NORMAL;
      } else if (isNearMissJapan(currentFlag)) {
        showDuration = SHOW_DURATION_NEAR_MISS;
        playKimigayo(true); // broken/chaotic near-miss version
      } else {
        showDuration = SHOW_DURATION_NORMAL;
      }
    }

  } else if (state === 'showing') {
    showTimer += dt;
    flagRenderer.renderFlag(currentFlag, 1.0);

    if (showTimer >= showDuration) {
      stopKimigayo();
      stopAnthem();
      capturedFlagImage = canvas.toDataURL('image/png');
      state = 'exploding';
      explodedFlag = currentFlag;

      // Pick random effect type
      currentEffectType = pick(EFFECT_TYPES);
      currentEffect = effects[currentEffectType];
      playEffectSound(currentEffectType);
      currentEffect.emit(currentFlag, (u, v) => flagRenderer.projectFlagPoint(u, v));

      // Start APNG capture — include pre-destruction frames (0.5s hold)
      if (capturedAnimURL) { URL.revokeObjectURL(capturedAnimURL); capturedAnimURL = null; }
      animFrames = [];
      const preCount = Math.round(ANIM_FPS * 0.5);
      for (let i = 0; i < preCount; i++) animFrames.push(capturedFlagImage);
      animFrameTimer = 0;
    }

  } else if (state === 'exploding') {
    currentEffect.update(dt);

    if (currentEffectType === 'burn') {
      flagRenderer.renderFlag(explodedFlag, 1.0, currentEffect.burnProgress);
    } else {
      flagRenderer.renderPole();
    }

    currentEffect.render();

    // Capture frames for APNG
    animFrameTimer += dt;
    if (animFrameTimer >= ANIM_FRAME_INTERVAL) {
      animFrameTimer -= ANIM_FRAME_INTERVAL;
      animFrames.push(canvas.toDataURL('image/png'));
    }

    if (currentEffect.isDead()) {
      state = 'result';
      showResultDialog(explodedFlag);
      // Encode APNG asynchronously to avoid blocking dialog display
      const frames = animFrames;
      animFrames = [];
      setTimeout(() => {
        const apng = encodeAPNG(frames, ANIM_FPS);
        capturedAnimURL = URL.createObjectURL(new Blob([apng], { type: 'image/png' }));
        resultFlagImg.src = capturedAnimURL;
      }, 0);
    }

  } else if (state === 'fading_in') {
    fadeInAlpha += dt * 2.5;
    if (fadeInAlpha >= 1.0) {
      fadeInAlpha = 1.0;
      state = 'idle';
      btn.disabled = false;
    }
    flagRenderer.renderFlag(currentFlag, fadeInAlpha);
  }

  // In 'result' state, just sky is shown (already rendered)

  requestAnimationFrame(render);
}

requestAnimationFrame(render);
