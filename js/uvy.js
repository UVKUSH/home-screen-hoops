import { UVY_LOGO } from './logo.js';
import * as sound from './sound.js';

/** Tap the UVY icon. Built the first time it's needed, then reused. */
let card = null;

export function showUvy() {
  card ??= build();
  card.hidden = false;
  // restart the entrance every time rather than only on the first open
  const inner = card.querySelector('.card');
  inner.style.animation = 'none';
  void inner.offsetWidth;
  inner.style.animation = '';
  sound.star();
}

function build() {
  const el = document.createElement('div');
  el.id = 'uvy';
  el.hidden = true;
  el.innerHTML =
    `<div class="card">` +
      `<div class="uvy-tile">${UVY_LOGO}</div>` +
      `<p class="eyebrow">Finally</p>` +
      `<h2 class="uvy-title">You became a star</h2>` +
      `<p class="uvy-sub">UVY &middot; United Voice of Youth</p>` +
      `<button type="button" data-close>Let's go</button>` +
    `</div>`;

  const close = () => { el.hidden = true; };
  el.querySelector('[data-close]').addEventListener('click', close);
  el.addEventListener('click', (e) => { if (e.target === el) close(); });

  document.body.appendChild(el);
  return el;
}
