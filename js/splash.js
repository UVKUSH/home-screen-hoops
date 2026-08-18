import { TUNE } from './config.js';

// The two images the home screen can't look right without.
const NEEDED = ['assets/sprite.webp', 'assets/wallpaper.webp'];

// Deliberately not in NEEDED. The splash waits on artwork because the home
// screen is wrong without it; nobody should ever be kept waiting on a sound.
const INTRO = 'assets/intro.mp3';
let intro = null;

/**
 * The intro sting.
 *
 * Browsers are allowed to refuse audio that starts before the visitor has
 * touched anything, and mobile Safari always does. That refusal arrives as a
 * rejected promise rather than a thrown error, and it is not a fault worth
 * reporting: the sound is a flourish, so where it is not allowed it simply
 * doesn't happen and everything else carries on exactly as before.
 */
function playIntro() {
  try {
    intro = new Audio(INTRO);
    intro.volume = 0.55;
    intro.play().catch(() => { intro = null; });
  } catch {
    intro = null;                     // no Audio at all; not worth a second thought
  }
}

/**
 * Fade it out and drop it.
 *
 * The sting outlives the splash — three seconds against about one — so without
 * this it would still be going when the phone breaks, over the top of the
 * game's own noises. Faded rather than cut, because stopping a sound dead is
 * audible in a way that stopping a picture dead is not.
 */
export function stopIntro(ms = 260) {
  const sound = intro;
  if (!sound) return;
  intro = null;
  const from = sound.volume;
  const started = performance.now();
  (function fade(now = started) {
    const done = (now - started) / ms;
    if (done >= 1) { sound.pause(); return; }
    sound.volume = from * (1 - done);
    requestAnimationFrame(fade);
  })();
}

/**
 * Hold the loading screen until the artwork is actually decoded, so the phone
 * appears fully formed instead of assembling itself in front of you. That
 * matters more than usual here: the whole joke depends on the first frame
 * looking like a real home screen.
 *
 * Both images are already <link rel="preload">ed, so these resolve from cache.
 */
export function runSplash() {
  const el = document.getElementById('splash');
  if (!el) return;

  const started = performance.now();
  playIntro();

  const artwork = Promise.all(NEEDED.map((src) => new Promise((done) => {
    const img = new Image();
    // a failed image shouldn't strand anyone on the splash forever
    img.onload = img.onerror = done;
    img.src = src;
  })));

  const giveUp = new Promise((r) => setTimeout(r, TUNE.splashMaxMs));

  Promise.race([artwork, giveUp]).then(() => {
    // Everything usually lands in a few hundred ms, which would make the logo
    // flash past. Hold it long enough to actually be seen.
    const held = performance.now() - started;
    setTimeout(dismiss, Math.max(0, TUNE.splashMs - held));
  });

  function dismiss() {
    el.classList.add('done');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 900);   // in case the transition never fires
  }
}
