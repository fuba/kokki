// Kimigayo (Japanese national anthem) opening melody using Web Audio API

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

// Opening melody of Kimigayo (first 3 seconds)
// Notes: D4, D4, E4, G4, A4, G4
const NOTES = [
  { freq: 293.66, start: 0.0,  dur: 0.45 },  // き D4
  { freq: 293.66, start: 0.5,  dur: 0.45 },  // み D4
  { freq: 329.63, start: 1.0,  dur: 0.55 },  // が E4
  { freq: 392.00, start: 1.6,  dur: 0.50 },  // よ G4
  { freq: 440.00, start: 2.1,  dur: 0.70 },  // は A4
  { freq: 392.00, start: 2.5,  dur: 0.50 },  // (sustain/transition)
];

export function playKimigayo() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  // Master gain with fade-out at the end
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.35, now);
  master.gain.setValueAtTime(0.35, now + 2.5);
  master.gain.linearRampToValueAtTime(0.0, now + 3.0);
  master.connect(ctx.destination);

  for (const note of NOTES) {
    // Main tone (sine, warm)
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = note.freq;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0, now + note.start);
    gain.gain.linearRampToValueAtTime(0.6, now + note.start + 0.05);
    gain.gain.setValueAtTime(0.6, now + note.start + note.dur - 0.05);
    gain.gain.linearRampToValueAtTime(0.0, now + note.start + note.dur);

    osc.connect(gain);
    gain.connect(master);
    osc.start(now + note.start);
    osc.stop(now + note.start + note.dur + 0.01);

    // Subtle octave harmonic for richness
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = note.freq * 2;

    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0.0, now + note.start);
    gain2.gain.linearRampToValueAtTime(0.08, now + note.start + 0.05);
    gain2.gain.setValueAtTime(0.08, now + note.start + note.dur - 0.05);
    gain2.gain.linearRampToValueAtTime(0.0, now + note.start + note.dur);

    osc2.connect(gain2);
    gain2.connect(master);
    osc2.start(now + note.start);
    osc2.stop(now + note.start + note.dur + 0.01);
  }
}
