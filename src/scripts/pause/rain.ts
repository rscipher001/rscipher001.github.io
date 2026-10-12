// Soft rain, made from filtered noise with the Web Audio API. No audio file, so it works offline.
// It only starts when asked, and fades in and out instead of starting abruptly.

let context: AudioContext | undefined;
let master: GainNode | undefined;
let playing = false;

function noise(ctx: AudioContext, brown: boolean): AudioBufferSourceNode {
  const length = ctx.sampleRate * 4;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    // Brown noise is a random walk: a deep, even rumble, like water falling at a distance.
    data[i] = brown ? (last = (last + 0.02 * white) / 1.02) * 3.5 : white;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  return source;
}

function build(ctx: AudioContext): GainNode {
  const out = ctx.createGain();
  out.gain.value = 0;
  out.connect(ctx.destination);

  // The body of the rain: low and steady.
  const body = noise(ctx, true);
  const bodyFilter = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 700 });
  const bodyGain = new GainNode(ctx, { gain: 0.55 });
  body.connect(bodyFilter).connect(bodyGain).connect(out);

  // The patter: high, quiet, slowly swelling and easing like passing showers.
  const patter = noise(ctx, false);
  const high = new BiquadFilterNode(ctx, { type: 'highpass', frequency: 1800 });
  const soft = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 7000 });
  const patterGain = new GainNode(ctx, { gain: 0.045 });
  const swell = new OscillatorNode(ctx, { frequency: 0.07 });
  const swellDepth = new GainNode(ctx, { gain: 0.02 });
  swell.connect(swellDepth).connect(patterGain.gain);
  patter.connect(high).connect(soft).connect(patterGain).connect(out);

  body.start();
  patter.start();
  swell.start();
  return out;
}

/** Starts or stops the rain. Returns whether it's playing afterwards. */
export async function toggleRain(): Promise<boolean> {
  context ??= new AudioContext();
  master ??= build(context);
  const now = context.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setValueAtTime(master.gain.value, now);

  if (!playing) {
    await context.resume();
    master.gain.linearRampToValueAtTime(0.5, now + 3);
    playing = true;
  } else {
    master.gain.linearRampToValueAtTime(0, now + 1.5);
    playing = false;
    const ctx = context;
    setTimeout(() => !playing && ctx.suspend(), 1600);
  }
  return playing;
}
