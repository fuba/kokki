// National anthems for recognized countries (single voice, sine oscillator)
// PD melodies transcribed from public domain scores; others are original compositions

let audioCtx = null;
let scheduledNodes = [];
let anthemMaster = null;
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

// Anthem data: { bpm, melody: [[midi, beatStart, beatDuration], ...] }
const ANTHEMS = {

  // Amar Sonar Bangla (64 BPM, G major) — public domain
  Bangladesh: { bpm: 64, melody: [
    [67, 0.00, 0.36], [69, 0.47, 0.38], [66, 1.00, 0.43], [67, 1.49, 0.43],
    [66, 1.98, 0.42], [64, 2.47, 0.39], [62, 2.99, 0.39], [64, 3.47, 0.23],
    [62, 3.71, 0.18], [60, 3.95, 0.43], [59, 4.45, 1.35],
    [59, 6.01, 0.43], [60, 6.47, 0.39], [62, 7.01, 0.31],
    [62, 7.50, 0.24], [64, 7.72, 0.23], [66, 7.95, 0.26], [67, 8.20, 0.22],
    [66, 8.48, 0.55], [64, 8.99, 0.48], [62, 9.48, 0.26], [64, 9.73, 0.19],
    [60, 9.98, 0.40], [62, 10.46, 1.07],
    [64, 11.50, 0.45], [66, 11.98, 0.46], [64, 12.49, 0.44], [62, 12.97, 0.90],
    [62, 14.01, 0.36], [62, 14.54, 0.26], [62, 15.00, 0.91],
    [64, 16.06, 0.25], [67, 16.31, 0.12], [67, 16.55, 0.82],
    [69, 17.51, 0.33], [69, 17.97, 0.43], [67, 18.47, 0.28], [69, 18.98, 0.38],
    [69, 19.51, 0.44], [71, 19.97, 0.28], [72, 20.22, 0.23], [71, 20.48, 0.43],
    [67, 20.95, 0.93], [69, 22.00, 0.41], [69, 22.54, 0.36],
    [71, 22.93, 0.30], [72, 23.20, 0.19], [69, 23.41, 0.12],
  ]},

  // Original composition in Vietnamese music style (72 BPM, Bb pentatonic, march)
  Vietnam: { bpm: 72, melody: [
    [58, 0.00, 1.00], [62, 1.00, 0.50], [65, 1.50, 0.50], [67, 2.00, 1.50],
    [65, 3.50, 0.50], [62, 4.00, 1.00], [60, 5.00, 1.00], [58, 6.00, 2.00],
    [60, 8.00, 0.50], [62, 8.50, 0.50], [65, 9.00, 1.00], [67, 10.00, 1.50],
    [70, 11.50, 0.50], [72, 12.00, 1.00], [70, 13.00, 1.00], [67, 14.00, 2.00],
    [65, 16.00, 1.00], [67, 17.00, 0.50], [70, 17.50, 0.50], [72, 18.00, 1.50],
    [70, 19.50, 0.50], [67, 20.00, 1.00], [65, 21.00, 1.00], [62, 22.00, 2.00],
  ]},

  // Swiss Psalm (60 BPM, F major) — public domain
  Switzerland: { bpm: 60, melody: [
    [65, 0.00, 0.67], [65, 0.75, 0.17], [65, 1.00, 0.92], [70, 2.00, 0.92],
    [70, 3.00, 0.67], [69, 3.75, 0.17], [69, 4.00, 1.42], [65, 6.00, 0.67],
    [65, 6.75, 0.17], [65, 7.00, 0.92], [72, 8.00, 0.92], [72, 9.00, 0.67],
    [70, 9.75, 0.17], [70, 10.00, 1.00], [74, 12.00, 1.42], [74, 13.50, 0.42],
    [72, 14.00, 0.42], [72, 14.50, 0.42], [72, 15.00, 1.42], [70, 16.50, 0.42],
    [69, 17.00, 0.92], [67, 18.00, 1.92], [64, 20.00, 0.92], [58, 20.50, 0.42],
    [65, 21.00, 2.42],
  ]},

  // Original composition in Turkish music style (112 BPM, C harmonic minor, makam-like)
  Turkey: { bpm: 112, melody: [
    [72, 0.00, 1.50], [71, 1.50, 0.25], [72, 1.75, 0.25], [75, 2.00, 1.00],
    [74, 3.00, 0.50], [72, 3.50, 0.50], [71, 4.00, 1.00], [68, 5.00, 0.50],
    [71, 5.50, 0.50], [72, 6.00, 2.00],
    [67, 8.00, 1.00], [68, 9.00, 0.50], [67, 9.50, 0.25], [65, 9.75, 0.25],
    [63, 10.00, 1.00], [62, 11.00, 0.25], [63, 11.25, 0.25], [65, 11.50, 0.50],
    [67, 12.00, 1.50], [68, 13.50, 0.50], [71, 14.00, 1.00],
    [72, 15.00, 0.50], [71, 15.50, 0.25], [68, 15.75, 0.25], [67, 16.00, 1.50],
    [65, 17.50, 0.25], [63, 17.75, 0.25], [62, 18.00, 0.50], [63, 18.50, 0.50],
    [60, 19.00, 2.00],
    [63, 21.00, 0.50], [65, 21.50, 0.50], [67, 22.00, 1.00],
    [68, 23.00, 0.25], [71, 23.25, 0.75],
  ]},

  // Original composition in South Asian music style (72 BPM, Bb major, stately march)
  Pakistan: { bpm: 72, melody: [
    [58, 0.00, 1.50], [62, 1.50, 0.50], [65, 2.00, 1.00], [67, 3.00, 1.00],
    [70, 4.00, 2.00], [69, 6.00, 0.50], [67, 6.50, 0.50], [65, 7.00, 1.00],
    [63, 8.00, 0.50], [62, 8.50, 0.50], [60, 9.00, 1.00], [62, 10.00, 2.00],
    [65, 12.00, 1.00], [67, 13.00, 0.50], [70, 13.50, 0.50], [72, 14.00, 1.50],
    [70, 15.50, 0.50], [67, 16.00, 1.00], [65, 17.00, 1.00], [62, 18.00, 1.00],
    [60, 19.00, 0.50], [58, 19.50, 0.50], [58, 20.00, 2.00],
  ]},

  // Original composition in North African/Arab music style (104 BPM, Bb Hijaz)
  Tunisia: { bpm: 104, melody: [
    [70, 0.00, 0.25], [71, 0.25, 0.50], [74, 0.75, 0.75],
    [75, 1.50, 0.50], [74, 2.00, 0.50], [71, 2.50, 0.25], [74, 2.75, 0.25],
    [70, 3.00, 1.00],
    [65, 4.00, 0.50], [66, 4.50, 0.50], [68, 5.00, 0.50], [70, 5.50, 0.50],
    [71, 6.00, 0.50], [74, 6.50, 0.50], [75, 7.00, 1.00],
    [78, 8.00, 0.75], [77, 8.75, 0.25], [75, 9.00, 0.50], [74, 9.50, 0.50],
    [71, 10.00, 0.75], [74, 10.75, 0.25], [70, 11.00, 1.00],
    [68, 12.00, 0.50], [66, 12.50, 0.50], [65, 13.00, 0.50], [63, 13.50, 0.50],
    [62, 14.00, 0.50], [59, 14.50, 0.50], [58, 15.00, 1.00],
    [62, 16.00, 0.50], [59, 16.50, 0.25], [62, 16.75, 0.25], [65, 17.00, 0.50],
    [66, 17.50, 0.50], [68, 18.00, 0.75], [70, 18.75, 0.25],
    [71, 19.00, 0.50], [74, 19.50, 0.50], [70, 20.00, 1.00],
    [74, 21.00, 0.50], [71, 21.50, 0.25], [74, 21.75, 0.25], [70, 22.00, 1.00],
  ]},

  // Original composition in East African music style (110 BPM, Ab pentatonic, rhythmic)
  Somalia: { bpm: 110, melody: [
    [68, 0.00, 1.00], [70, 1.00, 0.50], [72, 1.50, 0.50], [68, 2.00, 1.50],
    [65, 3.50, 0.50], [63, 4.00, 1.00], [60, 5.00, 1.00], [63, 6.00, 2.00],
    [68, 8.00, 1.00], [70, 9.00, 0.50], [72, 9.50, 0.50], [75, 10.00, 1.00],
    [72, 11.00, 0.50], [70, 11.50, 0.50], [68, 12.00, 2.00],
    [72, 14.00, 0.50], [75, 14.50, 0.50], [77, 15.00, 1.00], [75, 16.00, 0.50],
    [72, 16.50, 0.50], [70, 17.00, 1.00], [68, 18.00, 1.00],
    [63, 19.00, 0.50], [65, 19.50, 0.50], [68, 20.00, 2.00],
  ]},
};

/**
 * Play national anthem for a given country.
 * @param {string} countryEn — English country name (must match KNOWN_FLAGS.countryEn)
 * @returns {number} duration in seconds, or 0 if no anthem available
 */
export function playAnthem(countryEn) {
  stopAnthem();

  const data = ANTHEMS[countryEn];
  if (!data) return 0;

  const ctx = getAudioContext();
  isPlaying = true;

  anthemMaster = ctx.createGain();
  anthemMaster.gain.value = 0.25;
  anthemMaster.connect(ctx.destination);

  const beatSec = 60 / data.bpm;
  const now = ctx.currentTime;
  let lastEnd = 0;

  for (const [midi, beat, dur] of data.melody) {
    const t = now + beat * beatSec;
    const d = dur * beatSec;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = midiFreq(midi);

    const g = ctx.createGain();
    const attack = Math.min(0.03, d * 0.15);
    const release = Math.min(0.06, d * 0.25);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.25, t + attack);
    g.gain.setValueAtTime(0.25, t + d - release);
    g.gain.linearRampToValueAtTime(0, t + d);

    osc.connect(g);
    g.connect(anthemMaster);
    osc.start(t);
    osc.stop(t + d + 0.01);
    scheduledNodes.push(osc);

    const noteEnd = (beat + dur) * beatSec;
    if (noteEnd > lastEnd) lastEnd = noteEnd;
  }

  return lastEnd;
}

export function stopAnthem() {
  isPlaying = false;

  if (anthemMaster && audioCtx) {
    const now = audioCtx.currentTime;
    anthemMaster.gain.setValueAtTime(anthemMaster.gain.value, now);
    anthemMaster.gain.linearRampToValueAtTime(0, now + 0.3);
  }

  const nodes = scheduledNodes;
  scheduledNodes = [];
  setTimeout(() => {
    for (const n of nodes) {
      try { n.stop(); } catch (_) { /* already stopped */ }
    }
    anthemMaster = null;
  }, 400);
}
