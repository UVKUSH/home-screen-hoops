import { TUNE } from './config.js';

/**
 * Gravity follows the phone.
 *
 * Not a sideways nudge — the actual gravity vector is rotated into screen
 * space, so leaning rolls the pile, laying the phone flat leaves the balls
 * nearly weightless, and turning it over drops them UP off the top.
 *
 * iOS 13+ will not hand over motion data until the page asks for it from a
 * real tap, and shows an "Allow Motion & Orientation Access?" popup. That popup
 * would give the whole gag away if it fired on load, so we only ask when the
 * player taps the Tilt chip. Everywhere else it just starts working.
 */
export function createTilt() {
  const chip = document.getElementById('tilt');
  const mustAsk = typeof DeviceOrientationEvent !== 'undefined'
    && typeof DeviceOrientationEvent.requestPermission === 'function';

  let gamma = 0;    // roll: left-right lean, -90..90
  let beta = 90;    // pitch: 90 upright, 0 flat on a table, -90 turned over
  let live = false;

  function listen() {
    addEventListener('deviceorientation', (e) => {
      if (e.gamma == null || e.beta == null) return;
      gamma = e.gamma;
      beta = e.beta;
      if (!live) {
        live = true;
        // say so, rather than just silently vanishing — otherwise there's no
        // way to tell whether the permission actually took
        chip.textContent = 'Tilt on';
        chip.classList.add('on');
        setTimeout(() => chip.classList.remove('show'), 1500);
      }
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
    chip.textContent = 'Tilt blocked';
    chip.classList.add('on');
    setTimeout(() => chip.classList.remove('show'), 2200);
    return false;
  }

  chip.addEventListener('click', enable);

  // Devices that don't gate it get tilt for free. Desktops fire no events, so
  // `live` stays false and none of this costs anything.
  if (!mustAsk) listen();

  const rad = (deg) => (deg * Math.PI) / 180;

  return {
    get live() { return live; },

    /** Show the opt-in chip, but only on the devices that need one. */
    offer() {
      if (!mustAsk || live) return;
      chip.textContent = 'Enable tilt';
      chip.classList.remove('on');
      chip.classList.add('show');
    },
    hide()  { chip.classList.remove('show'); },

    /** Sideways gravity: the real component of g along the screen's x axis. */
    gx(world) {
      return live ? Math.sin(rad(gamma)) * world.g * TUNE.tiltStrength : 0;
    },

    /**
     * Vertical gravity. Upright this is normal; flat it falls away to nothing;
     * turned over it goes negative and everything falls up.
     */
    gy(world) {
      return live ? Math.sin(rad(beta)) * world.g : world.g;
    },

    /** True once the phone is tipped enough that the pile shouldn't settle. */
    get leaning() {
      return live && (Math.abs(gamma) > 4 || beta < 75);
    },

    /** Turned over far enough that gravity is pointing up the screen. */
    get upsideDown() {
      return live && beta < -25;
    },

    /** Used by tests to fake a phone without one. */
    fake(g, b = 90) { gamma = g; beta = b; live = true; },
  };
}
