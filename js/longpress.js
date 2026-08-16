import { TUNE } from './config.js';
import * as sound from './sound.js';

const MOVE_CANCEL = 12; // px of finger drift before we assume it wasn't a hold

// The pill's CSS dribble runs 420ms and touches down 45% of the way through.
// Landing the thud on that beat is what makes the two read as one thing.
const DRIBBLE_MS = 420;
const CONTACT_MS = 189;

/** Press and hold the Spotlight pill. Nothing on iOS does this, so nobody finds it by accident. */
export function watchSpotlight(onFire) {
  const pill = document.getElementById('spotlight');
  let timer = null;
  let thuds = [];
  let start = null;

  const cancel = () => {
    clearTimeout(timer);
    thuds.forEach(clearTimeout);
    thuds = [];
    timer = null;
    start = null;
    pill.classList.remove('charging');
  };

  pill.addEventListener('pointerdown', (e) => {
    if (document.body.classList.contains('playing')) return;
    start = { x: e.clientX, y: e.clientY };
    pill.classList.add('charging');

    // A press is a real user gesture, which is the only moment a browser will
    // let us start audio at all.
    sound.unlock();
    for (let at = CONTACT_MS; at < TUNE.holdMs; at += DRIBBLE_MS) {
      thuds.push(setTimeout(() => sound.bounce(0.45), at));
    }
    timer = setTimeout(() => {
      thuds.forEach(clearTimeout);
      thuds = [];
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
