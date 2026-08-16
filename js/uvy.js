import { COLS, ROWS, INDEX } from './sprite.js';
import * as sound from './sound.js';

/**
 * Tap the UVY icon.
 *
 * The card shows the actual app icon, taken from the same sprite cell the home
 * screen uses — so it's guaranteed to be the real artwork rather than a copy
 * that can drift out of step with it.
 */
let card = null;

export function showUvy() {
  card ??= build();
  card.hidden = false;
  // replay the entrance on every open, not just the first
  const inner = card.querySelector('.card');
  inner.style.animation = 'none';
  void inner.offsetWidth;
  inner.style.animation = '';
  sound.star();
}

function build() {
  const n = INDEX.uvy ?? 0;
  const col = n % COLS;
  const row = Math.floor(n / COLS);
  const x = COLS > 1 ? (col / (COLS - 1)) * 100 : 0;
  const y = ROWS > 1 ? (row / (ROWS - 1)) * 100 : 0;

  const el = document.createElement('div');
  el.id = 'uvy';
  el.hidden = true;
  el.innerHTML =
    `<div class="card">` +
      `<div class="uvy-icon" style="background-position:${x.toFixed(3)}% ${y.toFixed(3)}%;` +
      `background-size:${COLS * 100}% ${ROWS * 100}%"></div>` +
      `<h2 class="uvy-title">You finally became a star on UVY</h2>` +
      `<p class="uvy-sub">[ united voice of youth ]</p>` +
      `<button type="button" data-close>Let's go</button>` +
    `</div>`;

  const close = () => { el.hidden = true; };
  el.querySelector('[data-close]').addEventListener('click', close);
  el.addEventListener('click', (e) => { if (e.target === el) close(); });

  document.body.appendChild(el);
  return el;
}
