import { TUNE } from './config.js';

const RIM_RY   = 11;   // how "open" the rim ellipse looks, in px
const BRACKET  = 30;   // gap between backboard bottom and the rim
const NET_H    = 54;

/**
 * Builds the hoop across two layers so a ball can pass *through* it:
 * backboard + the back half of the rim sit behind the balls, the front
 * half of the rim and the net sit in front.
 */
export function createHoop(world, ballR) {
  const rimHalf = Math.round(ballR * 2.15);
  const boardW  = Math.round(rimHalf * 2.5);
  const boardH  = Math.round(rimHalf * 1.65);

  const top  = boardH + BRACKET + 16;
  const svgW = rimHalf * 4;
  const svgH = top + NET_H + 40;
  const box  = `${-svgW / 2} ${-top} ${svgW} ${svgH}`;

  const back = svgEl(box, svgW, svgH);
  back.innerHTML = `
    <rect x="${-boardW / 2}" y="${-BRACKET - boardH}" width="${boardW}" height="${boardH}" rx="7"
          fill="rgba(255,255,255,.14)" stroke="rgba(255,255,255,.75)" stroke-width="3"/>
    <rect x="${-rimHalf * 0.82}" y="${-BRACKET - boardH * 0.62}" width="${rimHalf * 1.64}" height="${boardH * 0.5}" rx="2"
          fill="none" stroke="rgba(255,255,255,.75)" stroke-width="3"/>
    <path d="M0 ${-BRACKET} L0 0" stroke="rgba(255,255,255,.55)" stroke-width="4"/>
    <path d="M${-rimHalf} 0 A ${rimHalf} ${RIM_RY} 0 0 1 ${rimHalf} 0"
          fill="none" stroke="#c8410f" stroke-width="6" stroke-linecap="round"/>`;

  const front = svgEl(box, svgW, svgH);
  front.innerHTML =
    net(rimHalf) +
    `<path d="M${-rimHalf} 0 A ${rimHalf} ${RIM_RY} 0 0 0 ${rimHalf} 0"
           fill="none" stroke="#ff6a1f" stroke-width="6" stroke-linecap="round"/>`;

  document.getElementById('hoop-back').appendChild(back);
  document.getElementById('hoop-front').appendChild(front);

  const hoop = {
    x: rimHalf + 8,          // parked in the left corner
    y: Math.round(world.h * 0.30),
    rimHalf,
    postR: 4,
    halfBoard: boardW / 2,
    t: 0,
    els: [back, front],
    netEl: front.querySelector('.net'),
    offX: svgW / 2,
    offY: top,

    /**
     * Parks in the left corner, then sweeps the full width of the screen once
     * you're past the free shots. Driven by shots TAKEN, not baskets made, so
     * it starts moving on the shot the player expects.
     *
     * (1-cos)/2 starts at zero speed, so it eases out of the corner instead of
     * jerking sideways, and eases again at each end of the sweep.
     */
    update(dt, shotsTaken, w) {
      // Keep the RIM fully on screen. Clamping the backboard instead would stop
      // the hoop well short of the edges — the board is much wider than the rim,
      // and letting it overhang looks fine.
      const minX = this.rimHalf + 8;
      const maxX = w.w - this.rimHalf - 8;
      const over = shotsTaken - TUNE.freeShots;

      if (over > 0) {
        const ramp = Math.min(1 + over * TUNE.hoopRamp, TUNE.hoopRampMax);
        this.t += dt * TUNE.hoopSpeed * ramp;

        // The sweep widens as the game goes on: a short wobble at first, the
        // full width later. Both how FAR it goes and how FAST it goes ramp up.
        const grow = Math.min(TUNE.hoopGrowFrom + (over - 1) * TUNE.hoopGrow, 1);
        const span = (maxX - minX) * TUNE.hoopRange * grow;
        this.x = minX + ((1 - Math.cos(this.t)) / 2) * span;
      } else {
        this.x = minX;
      }

      this.x = Math.max(minX, Math.min(maxX, this.x));
      this.draw();
    },

    draw() {
      const tf = `translate3d(${(this.x - this.offX).toFixed(1)}px, ${(this.y - this.offY).toFixed(1)}px, 0)`;
      this.els[0].style.transform = tf;
      this.els[1].style.transform = tf;
    },

    swish() {
      this.netEl.classList.remove('swish');
      void this.netEl.offsetWidth;
      this.netEl.classList.add('swish');
    },
  };

  return hoop;
}

function svgEl(viewBox, w, h) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('class', 'hoop-svg');
  s.setAttribute('viewBox', viewBox);
  s.setAttribute('width', w);
  s.setAttribute('height', h);
  return s;
}

/** Strands hanging from the rim down to a smaller ring, plus two cross rings. */
function net(rimHalf) {
  const botRx = rimHalf * 0.58;
  const botRy = 7;
  const strands = [];

  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2;
    const x1 = Math.cos(a) * rimHalf;
    const y1 = Math.sin(a) * RIM_RY;
    const x2 = Math.cos(a) * botRx;
    const y2 = NET_H + Math.sin(a) * botRy;
    strands.push(`<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} Q ${((x1 + x2) / 2).toFixed(1)} ${(NET_H * 0.55).toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}"/>`);
  }

  const rings = [0.38, 0.72].map((k) => {
    const rx = rimHalf + (botRx - rimHalf) * k;
    const ry = RIM_RY + (botRy - RIM_RY) * k;
    return `<ellipse cx="0" cy="${(NET_H * k).toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}"/>`;
  });

  return `<g class="net" fill="none" stroke="rgba(255,255,255,.82)" stroke-width="1.6">
    ${strands.join('')}${rings.join('')}
    <ellipse cx="0" cy="${NET_H}" rx="${botRx.toFixed(1)}" ry="${botRy}"/>
  </g>`;
}
