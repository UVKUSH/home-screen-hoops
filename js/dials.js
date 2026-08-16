import { TUNE } from './config.js';

/**
 * Tap the Settings icon seven times.
 *
 * It's the one icon where a hidden settings panel isn't a joke at the game's
 * expense — it IS the Settings app. Everything here writes straight into TUNE,
 * which the physics reads every frame, so changes land immediately.
 */

const TAPS_NEEDED = 7;
const TAP_WINDOW  = 2500;   // ms; the run of taps has to be deliberate

const DIALS = [
  { key: 'gravity',      label: 'Gravity',      min: 1.5,  max: 5,    step: 0.05 },
  { key: 'power',        label: 'Shot power',   min: 0.5,  max: 2,    step: 0.05 },
  { key: 'aimAssist',    label: 'Aim help',     min: 0,    max: 0.5,  step: 0.01 },
  { key: 'hoopSpeed',    label: 'Hoop speed',   min: 0,    max: 2.5,  step: 0.05 },
  { key: 'hoopRange',    label: 'Hoop travel',  min: 0,    max: 1,    step: 0.05 },
  { key: 'rimBounce',    label: 'Rim bounce',   min: 0,    max: 1,    step: 0.02 },
  { key: 'tiltStrength', label: 'Tilt',         min: 0,    max: 1,    step: 0.05 },
  { key: 'fireAt',       label: 'On fire after',min: 2,    max: 10,   step: 1    },
];

// what everything started as, so Reset means something
const DEFAULTS = Object.fromEntries(DIALS.map((d) => [d.key, TUNE[d.key]]));

let taps = 0;
let tapTimer = null;
let panel = null;

/** Call on every Settings tap. Returns true once the run is complete. */
export function countSettingsTap() {
  taps += 1;
  clearTimeout(tapTimer);
  tapTimer = setTimeout(() => { taps = 0; }, TAP_WINDOW);

  if (taps < TAPS_NEEDED) return false;
  taps = 0;
  open();
  return true;
}

function open() {
  panel ??= build();
  sync();
  panel.hidden = false;
}

function close() {
  if (panel) panel.hidden = true;
}

function build() {
  const el = document.createElement('div');
  el.id = 'dials';
  el.hidden = true;
  el.innerHTML =
    `<div class="card">` +
      `<p class="eyebrow">You found it</p>` +
      `<h2 class="ttl">The actual dials</h2>` +
      `<div class="rows"></div>` +
      `<button type="button" data-done>Done</button>` +
      `<button type="button" class="ghost" data-reset>Reset everything</button>` +
    `</div>`;

  const rows = el.querySelector('.rows');
  for (const d of DIALS) {
    const row = document.createElement('label');
    row.className = 'dial';
    row.innerHTML =
      `<span class="dial-name">${d.label}</span>` +
      `<span class="dial-val" data-val="${d.key}"></span>` +
      `<input type="range" min="${d.min}" max="${d.max}" step="${d.step}" data-key="${d.key}">`;

    const input = row.querySelector('input');
    input.addEventListener('input', () => {
      TUNE[d.key] = Number(input.value);
      row.querySelector('.dial-val').textContent = format(input.value, d.step);
      // gravity and the speed caps are baked into the world when it's made,
      // so the game has to recompute them rather than read TUNE each frame
      dispatchEvent(new CustomEvent('dials-changed'));
    });
    rows.appendChild(row);
  }

  el.querySelector('[data-done]').addEventListener('click', close);
  el.querySelector('[data-reset]').addEventListener('click', () => {
    Object.assign(TUNE, DEFAULTS);
    sync();
    dispatchEvent(new CustomEvent('dials-changed'));
  });
  el.addEventListener('click', (e) => { if (e.target === el) close(); });

  document.body.appendChild(el);
  return el;
}

function sync() {
  for (const d of DIALS) {
    panel.querySelector(`input[data-key="${d.key}"]`).value = TUNE[d.key];
    panel.querySelector(`[data-val="${d.key}"]`).textContent = format(TUNE[d.key], d.step);
  }
}

const format = (v, step) => (step >= 1 ? String(Math.round(v)) : Number(v).toFixed(2));
