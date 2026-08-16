/**
 * Every sound here is synthesised — there are no audio files.
 *
 * Two reasons. It costs nothing to download, on a page that's currently 155 KB
 * total. And more importantly, a synthesised impact can be shaped by the
 * physics: a graze off the rim and a full-force clang come out different,
 * which a recorded sample can never do.
 *
 * On iOS the ring/silent switch mutes all of this and there's no way around
 * that from a web page — which is arguably right for a gag you hand to someone
 * across a quiet table.
 */

let ctx = null;
let master = null;
let noiseBuf = null;

/** Must be called from a real user gesture or the browser won't allow audio. */
export function unlock() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    ctx = new AudioCtx();

    // 24 balls landing within a second and a half will clip without this
    const squash = ctx.createDynamicsCompressor();
    squash.threshold.value = -18;
    squash.ratio.value = 8;
    squash.attack.value = 0.003;
    squash.release.value = 0.18;

    master = ctx.createGain();
    master.gain.value = 0.34;
    master.connect(squash).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
}

/** Whether audio is actually alive. Used by ?debug to check the gesture took. */
export const ready = () => Boolean(ctx) && ctx.state === 'running';

const now = () => ctx.currentTime;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function noise() {
  if (!noiseBuf) {
    const len = Math.floor(ctx.sampleRate * 0.5);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  return src;
}

/** exponentialRampTo hates zero, so decays land on a whisper instead. */
function envelope(peak, attack, decay, t) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  return g;
}

// ── the ball hitting something solid ──────────────────────────
export function bounce(strength) {
  if (!ctx) return;
  const s = clamp01(strength);
  if (s < 0.03) return;                    // below this it's just mud
  const t = now();

  // the body of the thud. Harder impacts sit lower, the way a real ball does
  // as it dribbles down to nothing.
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  const f0 = 215 - 95 * s;
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(f0 * 0.55, t + 0.09);
  const body = envelope(0.5 * s + 0.04, 0.006, 0.12 + 0.1 * s, t);
  osc.connect(body).connect(master);
  osc.start(t);
  osc.stop(t + 0.32);

  // the slap of rubber on a hard floor
  const slap = noise();
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1500;
  bp.Q.value = 0.8;
  const slapGain = envelope(0.26 * s, 0.003, 0.045, t);
  slap.connect(bp).connect(slapGain).connect(master);
  slap.start(t);
  slap.stop(t + 0.09);
}

// ── iron ──────────────────────────────────────────────────────
export function clang(strength) {
  if (!ctx) return;
  const s = clamp01(strength);
  if (s < 0.04) return;
  const t = now();

  // inharmonic partials are what makes it read as metal rather than a note
  [523, 787, 1174, 1607].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq * (1 + (Math.random() - 0.5) * 0.012);
    const g = envelope((0.2 * s) / (i + 1), 0.004, 0.34 - i * 0.06, t);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + 0.42);
  });
}

// ── nylon ─────────────────────────────────────────────────────
export function swish() {
  if (!ctx) return;
  const t = now();

  const src = noise();
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 1.5;
  bp.frequency.setValueAtTime(4400, t);
  bp.frequency.exponentialRampToValueAtTime(1150, t + 0.3);

  const g = envelope(0.4, 0.018, 0.3, t);
  src.connect(bp).connect(g).connect(master);
  src.start(t);
  src.stop(t + 0.45);
}

// ── the moment the phone breaks ───────────────────────────────
export function thump() {
  if (!ctx) return;
  const t = now();

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(125, t);
  osc.frequency.exponentialRampToValueAtTime(36, t + 0.5);
  const g = envelope(0.75, 0.008, 0.5, t);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + 0.62);
}

// ── throwing it ───────────────────────────────────────────────
export function whoosh(strength) {
  if (!ctx) return;
  const s = clamp01(strength);
  const t = now();

  const src = noise();
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 2.2;
  bp.frequency.setValueAtTime(500, t);
  bp.frequency.exponentialRampToValueAtTime(1900 + 900 * s, t + 0.16);

  const g = envelope(0.14 * s, 0.05, 0.13, t);
  src.connect(bp).connect(g).connect(master);
  src.start(t);
  src.stop(t + 0.3);
}

// ── catching fire ─────────────────────────────────────────────
export function ignite() {
  if (!ctx) return;
  const t = now();

  // a rising roar: noise swept upward, with a low swell underneath
  const src = noise();
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 1.1;
  bp.frequency.setValueAtTime(320, t);
  bp.frequency.exponentialRampToValueAtTime(2600, t + 0.42);
  const g = envelope(0.38, 0.08, 0.4, t);
  src.connect(bp).connect(g).connect(master);
  src.start(t);
  src.stop(t + 0.55);

  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(70, t);
  osc.frequency.exponentialRampToValueAtTime(210, t + 0.4);
  const lo = envelope(0.18, 0.06, 0.38, t);
  osc.connect(lo).connect(master);
  osc.start(t);
  osc.stop(t + 0.5);
}

/** Routes a physics impact to the right noise. */
export function impact(type, strength) {
  if (type === 'rim') clang(strength);
  else bounce(strength);
}
