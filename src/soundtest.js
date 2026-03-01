// Sound test panel — triggered by typing "soundtest"

import { playAnthem, stopAnthem } from './anthems.js';
import { playKimigayo, stopKimigayo } from './kimigayo.js';
import { lang } from './i18n.js';

const TRACKS = [
  { id: 'Japan',       ja: '日本',           en: 'Japan',       desc: '君が代',           descEn: 'Kimigayo',           pd: true },
  { id: 'Bangladesh',  ja: 'バングラデシュ',  en: 'Bangladesh',  desc: 'আমার সোনার বাংলা', descEn: 'Amar Sonar Bangla',  pd: true },
  { id: 'Vietnam',     ja: 'ベトナム',        en: 'Vietnam',     desc: 'ベトナム音楽風',     descEn: 'Vietnamese style',   pd: false },
  { id: 'Switzerland', ja: 'スイス',          en: 'Switzerland', desc: 'スイスの賛歌',       descEn: 'Swiss Psalm',        pd: true },
  { id: 'Turkey',      ja: 'トルコ',          en: 'Turkey',      desc: 'トルコ音楽風',       descEn: 'Turkish style',      pd: false },
  { id: 'Pakistan',    ja: 'パキスタン',      en: 'Pakistan',    desc: '南アジア音楽風',     descEn: 'South Asian style',  pd: false },
  { id: 'Tunisia',     ja: 'チュニジア',      en: 'Tunisia',     desc: '北アフリカ音楽風',   descEn: 'North African style', pd: false },
  { id: 'Somalia',     ja: 'ソマリア',        en: 'Somalia',     desc: '東アフリカ音楽風',   descEn: 'East African style', pd: false },
];

let overlay = null;
let currentPlaying = null;
let autoStopTimer = null;
let visible = false;

function stopAll() {
  stopKimigayo();
  stopAnthem();
  if (autoStopTimer) {
    clearTimeout(autoStopTimer);
    autoStopTimer = null;
  }
}

function updateUI() {
  if (!overlay) return;
  for (const row of overlay.querySelectorAll('.st-track')) {
    const playing = row.dataset.id === currentPlaying;
    row.classList.toggle('playing', playing);
    row.querySelector('.st-btn').textContent = playing ? '\u25A0' : '\u25B6';
  }
}

function toggleTrack(id) {
  if (currentPlaying === id) {
    stopAll();
    currentPlaying = null;
    updateUI();
    return;
  }

  stopAll();
  currentPlaying = id;

  if (id === 'Japan') {
    playKimigayo();
  } else {
    const dur = playAnthem(id);
    if (dur > 0) {
      autoStopTimer = setTimeout(() => {
        if (currentPlaying === id) {
          currentPlaying = null;
          updateUI();
        }
      }, dur * 1000 + 300);
    }
  }

  updateUI();
}

function buildOverlay() {
  if (overlay) return;

  // Inject styles
  const style = document.createElement('style');
  style.textContent = `
#st-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.85);
  display: flex; align-items: center; justify-content: center;
  z-index: 2000;
  opacity: 0; pointer-events: none;
  transition: opacity 0.3s;
}
#st-overlay.visible { opacity: 1; pointer-events: auto; }
.st-panel {
  background: #1a1a1a; border: 2px solid #555;
  padding: 24px 28px; max-width: 420px; width: 90%;
  max-height: 80vh; overflow-y: auto;
  font-family: "游明朝","Yu Mincho","Hiragino Mincho ProN",serif;
}
.st-panel h2 {
  margin: 0 0 16px; font-size: 1.2rem; color: #eee;
  text-align: center; border-bottom: 1px solid #444; padding-bottom: 12px;
}
.st-track {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 8px; border-bottom: 1px solid #2a2a2a;
  cursor: pointer; transition: background 0.15s;
}
.st-track:last-of-type { border-bottom: none; }
.st-track:hover { background: #252525; }
.st-track.playing { background: #1a2a1a; }
.st-info { flex: 1; min-width: 0; }
.st-name { color: #eee; font-size: 0.95rem; }
.st-desc { color: #777; font-size: 0.75rem; margin-top: 2px; }
.st-badge {
  display: inline-block; font-size: 0.6rem; padding: 1px 5px;
  border-radius: 3px; margin-left: 6px; vertical-align: middle;
}
.st-badge.pd  { background: #1a3a1a; color: #6b6; }
.st-badge.og  { background: #3a2a0a; color: #ba6; }
.st-btn {
  width: 44px; height: 44px; flex-shrink: 0;
  background: none; border: 1px solid #555; color: #ddd;
  font-size: 1.1rem; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: border-color 0.15s;
}
.st-btn:hover { border-color: #aaa; }
.st-close {
  display: block; margin: 16px auto 0; padding: 10px 28px;
  background: #2a2a2a; border: 1px solid #555; color: #ddd;
  font-family: inherit; font-size: 0.9rem; cursor: pointer;
}
.st-close:hover { background: #3a3a3a; }
`;
  document.head.appendChild(style);

  // Build DOM
  overlay = document.createElement('div');
  overlay.id = 'st-overlay';

  const panel = document.createElement('div');
  panel.className = 'st-panel';

  const h2 = document.createElement('h2');
  h2.textContent = lang === 'en' ? 'Sound Test' : 'サウンドテスト';
  panel.appendChild(h2);

  for (const tr of TRACKS) {
    const row = document.createElement('div');
    row.className = 'st-track';
    row.dataset.id = tr.id;

    const info = document.createElement('div');
    info.className = 'st-info';

    const name = document.createElement('div');
    name.className = 'st-name';
    name.textContent = lang === 'en' ? tr.en : tr.ja;

    const badge = document.createElement('span');
    badge.className = `st-badge ${tr.pd ? 'pd' : 'og'}`;
    badge.textContent = tr.pd ? 'PD' : 'Original';
    name.appendChild(badge);

    const desc = document.createElement('div');
    desc.className = 'st-desc';
    desc.textContent = lang === 'en' ? tr.descEn : tr.desc;

    info.appendChild(name);
    info.appendChild(desc);

    const btn = document.createElement('button');
    btn.className = 'st-btn';
    btn.textContent = '\u25B6';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleTrack(tr.id);
    });

    row.addEventListener('click', () => toggleTrack(tr.id));
    row.appendChild(info);
    row.appendChild(btn);
    panel.appendChild(row);
  }

  const closeBtn = document.createElement('button');
  closeBtn.className = 'st-close';
  closeBtn.textContent = lang === 'en' ? 'Close' : '閉じる';
  closeBtn.addEventListener('click', hideSoundTest);
  panel.appendChild(closeBtn);

  overlay.appendChild(panel);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) hideSoundTest();
  });

  document.body.appendChild(overlay);
}

export function showSoundTest() {
  stopAll();
  buildOverlay();
  overlay.offsetHeight; // force reflow for transition
  overlay.classList.add('visible');
  visible = true;
}

export function hideSoundTest() {
  if (!overlay) return;
  stopAll();
  currentPlaying = null;
  updateUI();
  overlay.classList.remove('visible');
  visible = false;
}

export function isSoundTestVisible() {
  return visible;
}
