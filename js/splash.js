import { TUNE } from './config.js';

// The two images the home screen can't look right without.
const NEEDED = ['assets/sprite.webp', 'assets/wallpaper.webp'];

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
