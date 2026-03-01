// Gunkan March (軍艦行進曲) — chorus section
// Public domain melody (Setoguchi Tokichi, 1897; 120 BPM, Bb major)
// Single playback (no loop)

let audioCtx = null;
let scheduledNodes = [];
let gunkanMaster = null;
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

// Chorus melody: [MIDI note, start beat, duration beats]
// 120 BPM → 1 beat = 0.5 seconds
// Bb4=70, C5=72, D5=74, Eb5=75, F5=77
const MELODY = [
  // Phrase 1: 守るも攻むるも (mamoru mo semuru mo)
  [70, 0.0, 0.75],   // Bb4 dotted-eighth
  [70, 0.75, 0.25],  // Bb4 sixteenth
  [74, 1.0, 1.0],    // D5 quarter
  [70, 2.0, 0.75],   // Bb4 dotted-eighth
  [70, 2.75, 0.25],  // Bb4 sixteenth
  [74, 3.0, 1.0],    // D5 quarter

  // Phrase 2: 黒鉄の (kurogane no)
  [77, 4.0, 0.75],   // F5 dotted-eighth
  [75, 4.75, 0.25],  // Eb5 sixteenth
  [74, 5.0, 0.5],    // D5 eighth
  [72, 5.5, 0.5],    // C5 eighth
  [74, 6.0, 0.5],    // D5 eighth
  [75, 6.5, 0.5],    // Eb5 eighth

  // Phrase 3: 浮かべる城ぞ (ukaberu shiro zo)
  [75, 7.0, 0.5],    // Eb5 eighth
  [74, 7.5, 0.5],    // D5 eighth
  [72, 8.0, 0.5],    // C5 eighth
  [70, 8.5, 0.5],    // Bb4 eighth
  [72, 9.0, 1.0],    // C5 quarter
  [70, 10.0, 1.5],   // Bb4 dotted-quarter

  // Brief rest, then:
  // Phrase 4: 浮かべるその城 (ukaberu sono shiro)
  [70, 12.0, 0.75],  // Bb4 dotted-eighth
  [70, 12.75, 0.25], // Bb4 sixteenth
  [74, 13.0, 1.0],   // D5 quarter
  [70, 14.0, 0.75],  // Bb4 dotted-eighth
  [70, 14.75, 0.25], // Bb4 sixteenth
  [74, 15.0, 1.0],   // D5 quarter

  // Phrase 5: 日の本の (hinomoto no)
  [77, 16.0, 1.0],   // F5 quarter
  [75, 17.0, 0.5],   // Eb5 eighth
  [74, 17.5, 0.5],   // D5 eighth

  // Phrase 6: 皇国の四方を守るべし (mikuni no yomo wo mamoru beshi)
  [75, 18.0, 0.5],   // Eb5 eighth
  [74, 18.5, 0.5],   // D5 eighth
  [77, 19.0, 1.0],   // F5 quarter
  [75, 20.0, 0.5],   // Eb5 eighth
  [74, 20.5, 0.5],   // D5 eighth
  [72, 21.0, 0.5],   // C5 eighth
  [70, 21.5, 0.5],   // Bb4 eighth
  [70, 22.0, 2.0],   // Bb4 half (final)
];

const TOTAL_BEATS = 24;
const BEAT_SEC = 0.5; // 120 BPM
export const GUNKAN_DURATION_SEC = TOTAL_BEATS * BEAT_SEC;

// ~10-voice orchestral layering (same as kimigayo.js):
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

function scheduleChorus(ctx, master, offset) {
  for (const [midi, startBeat, durBeat] of MELODY) {
    const t = offset + startBeat * BEAT_SEC;
    const d = durBeat * BEAT_SEC;
    const baseFreq = midiFreq(midi);

    for (const [wave, octShift, detCents, vol, atk, rel] of VOICES) {
      const osc = ctx.createOscillator();
      osc.type = wave;
      osc.frequency.value = baseFreq * Math.pow(2, octShift);
      osc.detune.value = detCents;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0, t);
      g.gain.linearRampToValueAtTime(vol, t + atk);
      g.gain.setValueAtTime(vol, t + d - rel);
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
 * Play Gunkan March chorus once (no loop).
 */
export function playGunkan() {
  stopGunkan();

  const ctx = getAudioContext();
  isPlaying = true;

  gunkanMaster = ctx.createGain();
  gunkanMaster.gain.value = 0.28;
  gunkanMaster.connect(ctx.destination);

  scheduleChorus(ctx, gunkanMaster, ctx.currentTime);
}

export function stopGunkan() {
  isPlaying = false;

  // Fade out gracefully
  if (gunkanMaster && audioCtx) {
    const now = audioCtx.currentTime;
    gunkanMaster.gain.setValueAtTime(gunkanMaster.gain.value, now);
    gunkanMaster.gain.linearRampToValueAtTime(0.0, now + 0.5);
  }

  // Stop all oscillators after fade completes
  const nodes = scheduledNodes;
  scheduledNodes = [];
  setTimeout(() => {
    for (const n of nodes) {
      try { n.stop(); } catch (_) { /* already stopped */ }
    }
    gunkanMaster = null;
  }, 600);
}
