// Sound generators for destruction effects using Web Audio API

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

export function playExplosionSound() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  // Layer 1: Low-frequency boom
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, now);
  osc.frequency.exponentialRampToValueAtTime(30, now + 0.4);

  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.8, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

  osc.connect(oscGain);
  oscGain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.5);

  // Layer 2: Noise burst (crackle)
  const bufferSize = Math.floor(ctx.sampleRate * 0.6);
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    const t = i / ctx.sampleRate;
    data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 8);
  }

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;

  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.setValueAtTime(2000, now);
  noiseFilter.frequency.exponentialRampToValueAtTime(200, now + 0.3);
  noiseFilter.Q.value = 1.0;

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.6, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(now);

  // Layer 3: Mid-frequency punch
  const osc2 = ctx.createOscillator();
  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(300, now);
  osc2.frequency.exponentialRampToValueAtTime(50, now + 0.2);

  const osc2Gain = ctx.createGain();
  osc2Gain.gain.setValueAtTime(0.4, now);
  osc2Gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

  osc2.connect(osc2Gain);
  osc2Gain.connect(ctx.destination);
  osc2.start(now);
  osc2.stop(now + 0.3);
}

export function playBurnSound() {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  // Sustained crackling fire noise
  const bufferSize = Math.floor(ctx.sampleRate * 2.0);
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    const t = i / ctx.sampleRate;
    const pop = Math.random() < 0.02 ? (Math.random() - 0.5) * 2.0 : 0;
    data[i] = ((Math.random() * 2 - 1) * 0.3 + pop) * Math.min(1, t * 4) * Math.exp(-t * 1.5);
  }

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(800, now);
  filter.frequency.linearRampToValueAtTime(400, now + 1.5);
  filter.Q.value = 0.8;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.5, now);
  gain.gain.linearRampToValueAtTime(0.7, now + 0.5);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  noise.start(now);

  // Low whoosh undertone
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(80, now);
  osc.frequency.linearRampToValueAtTime(50, now + 1.5);

  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.15, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

  osc.connect(oscGain);
  oscGain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 1.5);
}

// Dispatch sound by effect type
export function playEffectSound(effectType) {
  switch (effectType) {
    case 'explosion': playExplosionSound(); break;
    case 'burn':      playBurnSound(); break;
  }
}
