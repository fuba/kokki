// Full Kimigayo (Japanese national anthem) — orchestral arrangement
// Public domain melody (Hayashi/Eckert, 1880; 60 BPM, 4/4)
// Notes: C4 D4 E4 G4 A4 B4 C5 D5 (Ichikotsu-cho mode)

let audioCtx = null;
let scheduledNodes = [];
let loopTimer = null;
let kimigayoMaster = null;
let isPlaying = false;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

// MIDI note number to frequency (A4 = 69 = 440 Hz)
function midiFreq(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

// Exact melody from official score: [MIDI note, start beat, duration beats]
// 60 BPM → 1 beat = 1 second
const MELODY = [
  // きみがよは
  [62, 0.00, 1.00], [60, 1.00, 1.00], [62, 2.00, 1.00], [64, 3.00, 1.00],
  [67, 4.00, 1.00], [64, 5.00, 1.00], [62, 6.00, 2.00],
  // ちよに
  [64, 8.00, 1.00], [67, 9.00, 1.00], [69, 10.00, 1.00],
  [67, 11.00, 0.50], [69, 11.50, 0.50],
  // やちよに
  [74, 12.00, 1.00], [71, 13.00, 1.00], [69, 14.00, 1.00], [67, 15.00, 1.00],
  // さざれ
  [64, 16.00, 1.00], [67, 17.00, 1.00], [69, 18.00, 2.00],
  // いしの
  [74, 20.00, 1.00], [72, 21.00, 1.00], [74, 22.00, 2.00],
  // いわおと
  [64, 24.00, 1.00], [67, 25.00, 1.00], [69, 26.00, 1.00], [67, 27.00, 1.00],
  [64, 28.00, 1.50], [67, 29.50, 0.50], [62, 30.00, 2.00],
  // なりて
  [69, 32.00, 1.00], [72, 33.00, 1.00], [74, 34.00, 2.00],
  // こけの
  [72, 36.00, 1.00], [74, 37.00, 1.00], [69, 38.00, 1.00], [67, 39.00, 1.00],
  // むすまで
  [69, 40.00, 1.00], [67, 41.00, 0.50], [64, 41.50, 0.50], [62, 42.00, 2.00],
];

const TOTAL_BEATS = 44;
const BEAT_SEC = 1.0; // 60 BPM
export const KIMIGAYO_CHORUS_SEC = TOTAL_BEATS * BEAT_SEC;

const LOOP_GAP = 2.5;

// ~10-voice orchestral layering:
// [waveform, octaveShift, detuneCents, gainLevel, attackSec, releaseSec]
const VOICES = [
  ['sine',      0,    0,  0.22, 0.04, 0.08],  // Violin I (lead)
  ['sine',      0,    4,  0.13, 0.05, 0.08],  // Violin I (chorus L)
  ['sine',      0,   -4,  0.13, 0.05, 0.08],  // Violin II (chorus R)
  ['triangle',  0,    0,  0.05, 0.04, 0.06],  // Oboe
  ['sine',      1,    0,  0.04, 0.03, 0.05],  // Flute
  ['sine',      1,    6,  0.02, 0.03, 0.05],  // Piccolo (chorus)
  ['sine',     -1,    0,  0.10, 0.07, 0.10],  // Cello
  ['sine',     -1,   -3,  0.07, 0.07, 0.10],  // Cello (chorus)
  ['triangle', -1,    0,  0.03, 0.06, 0.08],  // Bassoon
  ['sine',     -2,    0,  0.05, 0.10, 0.12],  // Contrabass
];

function scheduleChorus(ctx, master, offset, broken) {
  for (const [midi, startBeat, durBeat] of MELODY) {
    // Broken mode: skip ~15% of notes randomly
    if (broken && Math.random() < 0.15) continue;

    // Per-note chaos in broken mode
    const timeJitter = broken ? (Math.random() - 0.5) * 0.4 : 0;
    const pitchShift = broken ? (Math.random() - 0.5) * 350 : 0; // up to ±175 cents
    const durScale = broken ? 0.5 + Math.random() * 0.9 : 1.0;
    const volScale = broken ? 0.3 + Math.random() * 1.4 : 1.0;

    const t = Math.max(offset, offset + startBeat * BEAT_SEC + timeJitter);
    const d = durBeat * BEAT_SEC * durScale;
    const baseFreq = midiFreq(midi);

    for (const [wave, octShift, detCents, vol, atk, rel] of VOICES) {
      const osc = ctx.createOscillator();
      osc.type = wave;
      osc.frequency.value = baseFreq * Math.pow(2, octShift);
      // Each voice gets additional random spread in broken mode
      osc.detune.value = detCents + pitchShift + (broken ? (Math.random() - 0.5) * 60 : 0);

      const adjVol = Math.min(vol * volScale, 0.35);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0, t);
      g.gain.linearRampToValueAtTime(adjVol, t + atk);
      g.gain.setValueAtTime(adjVol, t + d - rel);
      g.gain.linearRampToValueAtTime(0.0, t + d);

      osc.connect(g);
      g.connect(master);
      osc.start(t);
      osc.stop(t + d + 0.02);
      scheduledNodes.push(osc);
    }
  }
}

/**
 * Play Kimigayo in an infinite loop.
 * @param {boolean} broken — true for chaotic near-miss version
 */
export function playKimigayo(broken = false) {
  stopKimigayo();

  const ctx = getAudioContext();
  isPlaying = true;

  kimigayoMaster = ctx.createGain();
  kimigayoMaster.gain.value = 0.28;
  kimigayoMaster.connect(ctx.destination);

  let nextStart = ctx.currentTime;
  const interval = KIMIGAYO_CHORUS_SEC + LOOP_GAP;

  function scheduleLoop() {
    if (!isPlaying) return;
    scheduleChorus(ctx, kimigayoMaster, nextStart, broken);
    nextStart += interval;
    loopTimer = setTimeout(scheduleLoop, (interval - 3) * 1000);
  }

  scheduleLoop();
}

export function stopKimigayo() {
  isPlaying = false;

  if (loopTimer) {
    clearTimeout(loopTimer);
    loopTimer = null;
  }

  // Fade out gracefully
  if (kimigayoMaster && audioCtx) {
    const now = audioCtx.currentTime;
    kimigayoMaster.gain.setValueAtTime(kimigayoMaster.gain.value, now);
    kimigayoMaster.gain.linearRampToValueAtTime(0.0, now + 0.5);
  }

  // Stop all oscillators after fade completes
  const nodes = scheduledNodes;
  scheduledNodes = [];
  setTimeout(() => {
    for (const n of nodes) {
      try { n.stop(); } catch (_) { /* already stopped */ }
    }
    kimigayoMaster = null;
  }, 600);
}
