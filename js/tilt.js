import { TUNE } from './config.js';

/**
 * Leaning the phone leans gravity, so the loose balls roll around the pile
 * and a shot in the air curves.
 *
 * iOS 13+ will not hand over motion data until the page asks for it from a
 * real tap, and the browser shows an "Allow Motion & Orientation Access?"
 * popup. That popup would give the whole gag away if it fired on load, so
 * we only ask when the player taps the Tilt chip. Everywhere else (Android,
 * desktop) it just starts working on its own.
 */
export function createTilt() {
  const chip = document.getElementById('tilt');
  const mustAsk = typeof DeviceOrientationEvent !== 'undefined'
    && typeof DeviceOrientationEvent.requestPermission === 'function';

  let gamma = 0;    // sideways lean in degrees, -90..90
  let live = false; // true once real orientation data actually arrives

  function listen() {
    addEventListener('deviceorientation', (e) => {
      if (e.gamma == null) return;
      gamma = e.gamma;
      live = true;
      chip.classList.remove('show');
    });
  }

  async function enable() {
    if (!mustAsk) { listen(); return true; }
    try {
      if (await DeviceOrientationEvent.requestPermission() === 'granted') {
        listen();
        return true;
      }
    } catch { /* dismissed, or not served over https */ }
    chip.textContent = 'No tilt';
    setTimeout(() => chip.classList.remove('show'), 1600);
    return false;
  }

  chip.addEventListener('click', enable);

  // Devices that don't gate it get tilt for free. Desktops fire no events,
  // so `live` stays false and the pile is never simulated — no wasted work.
  if (!mustAsk) listen();

  return {
    get live() { return live; },

    /** Show the opt-in chip, but only on the devices that need one. */
    offer() { if (mustAsk && !live) chip.classList.add('show'); },
    hide()  { chip.classList.remove('show'); },

    /** Sideways gravity, in px/s². Full lean at 40°. */
    gx(world) {
      if (!live) return 0;
      const lean = Math.max(-1, Math.min(1, gamma / 40));
      return lean * world.g * TUNE.tiltStrength;
    },

    /** Used by tests to fake a lean without a phone. */
    fake(deg) { gamma = deg; live = true; },
  };
}
