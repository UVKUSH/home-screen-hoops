import { TUNE } from './config.js';

const MOVE_CANCEL = 12; // px of finger drift before we assume it wasn't a hold

/** Press and hold the Spotlight pill. Nothing on iOS does this, so nobody finds it by accident. */
export function watchSpotlight(onFire) {
  const pill = document.getElementById('spotlight');
  let timer = null;
  let start = null;

  const cancel = () => {
    clearTimeout(timer);
    timer = null;
    start = null;
    pill.classList.remove('charging');
  };

  pill.addEventListener('pointerdown', (e) => {
    if (document.body.classList.contains('playing')) return;
    start = { x: e.clientX, y: e.clientY };
    pill.classList.add('charging');
    timer = setTimeout(() => {
      pill.classList.remove('charging');
      pill.classList.add('pop');
      navigator.vibrate?.([12, 40, 30]);
      onFire(start);
      start = null;
    }, TUNE.holdMs);
  });

  pill.addEventListener('pointermove', (e) => {
    if (!start) return;
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > MOVE_CANCEL) cancel();
  });

  pill.addEventListener('pointerup', cancel);
  pill.addEventListener('pointercancel', cancel);
  pill.addEventListener('lostpointercapture', cancel);
}

export function resetSpotlight() {
  document.getElementById('spotlight').classList.remove('pop', 'charging');
}
