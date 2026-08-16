import { activeIcons } from './homescreen.js';
import { makeBall } from './physics.js';

/**
 * The gag itself. Each icon keeps being the *same DOM element* — it just
 * stops being a grid item and starts being a physics body. That is what
 * makes it read as "my phone broke" instead of "a game loaded".
 */
export function toBalls(world, origin) {
  const layer = document.getElementById('balls');
  const balls = [];
  const icons = activeIcons();

  // Measure EVERY icon before moving ANY of them. Pulling one out of the grid
  // reflows the rest, so measuring and moving in the same pass makes every
  // icon report the position of the one before it.
  const boxes = icons.map((el) => el.querySelector('.art').getBoundingClientRect());

  for (let i = 0; i < icons.length; i++) {
    const el = icons[i];
    const box = boxes[i];
    const r = box.width / 2;

    // remember exactly where this icon lived so we can put it back.
    // Every icon leaves, so re-appending in this same order rebuilds the
    // grid exactly — no need to track siblings.
    const home = { parent: el.parentNode, x: box.left, y: box.top };

    el.classList.add('ball');
    layer.appendChild(el);

    const b = makeBall(el, box.left + r, box.top + r, r);
    b.home = home;
    b.shot = false;

    // ripple outward from wherever the thumb was
    const dist = Math.hypot(b.x - origin.x, b.y - origin.y);
    b.hold = 0.06 + (dist / world.h) * 0.5;

    // a nudge so the pile doesn't land in a perfect column
    b.vx = (Math.random() - 0.5) * world.w * 0.35;
    b.vy = -world.h * 0.10 * Math.random();
    b.vrot = (Math.random() - 0.5) * 6;

    el.style.transform = `translate3d(${home.x}px, ${home.y}px, 0)`;
    balls.push(b);
  }

  return balls;
}

/** Reverse it: everything flies back to the grid and the phone looks normal. */
export function homeAgain(balls) {
  return new Promise((resolve) => {
    balls.forEach((b, i) => {
      const el = b.el;
      el.classList.add('unmorph');
      el.style.transition = `transform .55s cubic-bezier(.34,1.25,.5,1) ${i * 8}ms`;
      el.style.transform = `translate3d(${b.home.x}px, ${b.home.y}px, 0)`;
    });

    setTimeout(() => {
      for (const b of balls) {
        const el = b.el;
        el.style.transition = '';
        el.style.transform = '';
        el.classList.remove('ball', 'unmorph', 'loaded');
        b.home.parent.appendChild(el);
      }
      resolve();
    }, 560 + balls.length * 8);
  });
}
