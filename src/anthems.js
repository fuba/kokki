// National anthems for recognized countries (single voice, sine oscillator)
// Melody data extracted from official MIDI transcriptions

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

  // Amar Sonar Bangla (64 BPM, G major)
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

  // Tien Quan Ca (72 BPM, Bb major)
  Vietnam: { bpm: 72, melody: [
    [58, 0.00, 0.84], [60, 1.01, 0.19], [60, 1.32, 0.21], [60, 1.63, 0.39],
    [62, 2.00, 0.86], [62, 3.05, 0.75], [65, 4.00, 0.87], [67, 4.96, 1.83],
    [66, 6.90, 0.82], [70, 7.91, 0.90], [66, 8.90, 0.75], [70, 9.87, 0.95],
    [69, 10.97, 0.45], [68, 11.43, 0.53], [63, 11.96, 0.80], [63, 12.91, 0.89],
    [63, 13.94, 0.80], [63, 14.91, 0.49], [60, 15.41, 0.36], [63, 15.92, 2.64],
    [65, 18.95, 0.40], [65, 19.47, 0.31], [70, 19.97, 0.87], [66, 20.96, 0.94],
  ]},

  // Swiss Psalm (60 BPM, F major)
  Switzerland: { bpm: 60, melody: [
    [65, 0.00, 0.67], [65, 0.75, 0.17], [65, 1.00, 0.92], [70, 2.00, 0.92],
    [70, 3.00, 0.67], [69, 3.75, 0.17], [69, 4.00, 1.42], [65, 6.00, 0.67],
    [65, 6.75, 0.17], [65, 7.00, 0.92], [72, 8.00, 0.92], [72, 9.00, 0.67],
    [70, 9.75, 0.17], [70, 10.00, 1.00], [74, 12.00, 1.42], [74, 13.50, 0.42],
    [72, 14.00, 0.42], [72, 14.50, 0.42], [72, 15.00, 1.42], [70, 16.50, 0.42],
    [69, 17.00, 0.92], [67, 18.00, 1.92], [64, 20.00, 0.92], [58, 20.50, 0.42],
    [65, 21.00, 2.42],
  ]},

  // Istiklal Marsi (112 BPM, C minor)
  Turkey: { bpm: 112, melody: [
    [72, 0.00, 1.42], [72, 1.50, 0.17], [72, 1.75, 0.17], [72, 2.00, 1.42],
    [72, 3.50, 0.17], [72, 3.75, 0.17], [72, 4.00, 0.42], [72, 4.50, 0.42],
    [72, 5.00, 0.42], [72, 5.50, 0.42], [72, 6.00, 0.92],
    [60, 7.00, 0.25], [59, 7.33, 0.25], [60, 7.67, 0.25],
    [65, 8.00, 0.92], [67, 9.00, 0.92], [68, 10.00, 0.92],
    [64, 11.00, 0.67], [67, 11.75, 0.17], [65, 12.00, 2.42],
    [56, 13.00, 0.25], [55, 13.33, 0.25], [56, 13.67, 0.25], [53, 14.00, 0.42],
    [65, 15.00, 0.25], [64, 15.33, 0.25], [65, 15.67, 0.25],
    [70, 16.00, 0.92], [72, 17.00, 0.92], [73, 18.00, 0.67], [72, 18.75, 0.17],
    [69, 19.00, 0.67], [72, 19.75, 0.17], [70, 20.00, 2.42],
    [61, 21.00, 0.25], [60, 21.33, 0.25], [61, 21.67, 0.25], [58, 22.00, 0.42],
    [72, 23.00, 0.25], [71, 23.33, 0.25], [72, 23.67, 0.25],
  ]},

  // Qaumi Taranah (72 BPM, Bb major) — transposed -12 from upper voice
  Pakistan: { bpm: 72, melody: [
    [58, 0.00, 1.04], [62, 1.00, 0.41], [63, 1.65, 0.28], [65, 1.97, 0.97],
    [67, 2.94, 0.29], [63, 3.56, 0.31], [65, 3.86, 3.34],
    [70, 7.91, 0.55], [70, 8.61, 0.30], [65, 8.93, 0.24], [65, 9.61, 0.35],
    [67, 9.93, 1.00], [63, 10.91, 0.63], [62, 11.59, 0.26], [63, 11.89, 0.10],
    [60, 12.08, 3.37],
    [62, 15.95, 0.35], [62, 16.47, 0.45], [63, 16.96, 0.46], [60, 17.47, 0.53],
    [62, 17.96, 0.43], [65, 18.43, 0.48], [67, 18.93, 0.41], [69, 19.38, 0.49],
    [70, 19.89, 1.01], [69, 20.88, 0.50],
  ]},

  // Humat al-Hima (104 BPM, Bb major)
  Tunisia: { bpm: 104, melody: [
    [65, 0.00, 0.14], [70, 0.25, 0.78], [70, 1.25, 0.65], [72, 2.00, 0.23],
    [70, 2.25, 0.78], [70, 3.25, 0.65], [72, 4.00, 0.14], [74, 4.25, 0.78],
    [72, 5.25, 0.29], [74, 5.58, 0.24], [72, 5.92, 0.28], [70, 6.25, 0.78],
    [70, 8.00, 0.24], [74, 8.25, 0.89], [74, 9.25, 0.52], [74, 10.00, 0.14],
    [74, 10.25, 0.91], [67, 11.25, 0.35], [67, 12.00, 0.16], [72, 12.25, 0.78],
    [72, 13.25, 0.46], [72, 14.00, 0.19], [70, 14.25, 0.78], [57, 14.75, 0.35],
    [55, 15.25, 0.34], [53, 15.75, 0.49], [70, 16.00, 0.17], [70, 16.25, 0.78],
    [70, 17.25, 0.65], [72, 18.00, 0.29], [70, 18.25, 0.78], [70, 19.25, 0.78],
    [72, 20.00, 0.21], [74, 20.25, 0.65], [74, 21.00, 0.21],
    [72, 21.25, 0.28], [74, 21.58, 0.24], [72, 21.92, 0.26],
    [70, 22.25, 0.67],
  ]},

  // Qolobaa Calankeed (110 BPM, Ab major)
  Somalia: { bpm: 110, melody: [
    [60, 0.00, 1.82], [60, 1.96, 1.42], [60, 3.51, 0.46],
    [63, 4.04, 2.40], [63, 6.93, 1.12], [65, 8.01, 0.98],
    [61, 8.92, 1.15], [67, 9.94, 1.01], [63, 10.90, 1.12],
    [68, 11.93, 3.23], [68, 16.02, 1.33],
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
