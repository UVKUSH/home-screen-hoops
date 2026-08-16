/**
 * Two icons that tell the truth.
 *
 * iOS draws a real ticking Clock and a real date on Calendar, and that detail
 * is doing a lot of work here: it's the thing that makes someone look twice and
 * wonder whether the phone is actually fake. A frozen 10:10 and a permanent
 * SAT 20 give the game away instantly.
 *
 * These two are drawn as inline SVG rather than taken from the sprite sheet,
 * because you can't move hands that are baked into a picture.
 */

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export const LIVE_ICONS = new Set(['clock', 'calendar']);

export function liveArt(id) {
  return id === 'clock' ? clockFace() : calendarFace();
}

function clockFace() {
  // ticks every 5 minutes, longer on the hours
  const ticks = Array.from({ length: 60 }, (_, i) => {
    const long = i % 5 === 0;
    const a = (i / 60) * Math.PI * 2;
    const r1 = long ? 38 : 41;
    const r2 = 44;
    return `<line x1="${50 + Math.sin(a) * r1}" y1="${50 - Math.cos(a) * r1}"
                  x2="${50 + Math.sin(a) * r2}" y2="${50 - Math.cos(a) * r2}"
                  stroke="#1c1c1e" stroke-width="${long ? 2.4 : 1}" stroke-linecap="round"/>`;
  }).join('');

  return `
<svg viewBox="0 0 100 100" class="live-clock">
  <circle cx="50" cy="50" r="50" fill="#fff"/>
  ${ticks}
  <g class="hand-h"><line x1="50" y1="50" x2="50" y2="24" stroke="#1c1c1e" stroke-width="4.6" stroke-linecap="round"/></g>
  <g class="hand-m"><line x1="50" y1="50" x2="50" y2="12" stroke="#1c1c1e" stroke-width="3.4" stroke-linecap="round"/></g>
  <g class="hand-s"><line x1="50" y1="58" x2="50" y2="10" stroke="#ff9f0a" stroke-width="1.8" stroke-linecap="round"/></g>
  <circle cx="50" cy="50" r="3.2" fill="#1c1c1e"/>
  <circle cx="50" cy="50" r="1.4" fill="#ff9f0a"/>
</svg>`;
}

function calendarFace() {
  return `
<svg viewBox="0 0 100 100" class="live-cal">
  <rect width="100" height="100" fill="#fff"/>
  <text class="cal-day" x="50" y="26" text-anchor="middle"
        font-family="-apple-system, system-ui, sans-serif" font-size="17" font-weight="600" fill="#ff3b30">SAT</text>
  <text class="cal-date" x="50" y="82" text-anchor="middle"
        font-family="-apple-system, system-ui, sans-serif" font-size="58" font-weight="300" fill="#1c1c1e">20</text>
</svg>`;
}

/** Keep them honest. One timer for every copy of the icons on every page. */
export function startLiveIcons() {
  const tick = () => {
    const now = new Date();
    const s = now.getSeconds() + now.getMilliseconds() / 1000;
    const m = now.getMinutes() + s / 60;
    const h = (now.getHours() % 12) + m / 60;

    for (const el of document.querySelectorAll('.live-clock')) {
      el.querySelector('.hand-h').style.transform = `rotate(${h * 30}deg)`;
      el.querySelector('.hand-m').style.transform = `rotate(${m * 6}deg)`;
      el.querySelector('.hand-s').style.transform = `rotate(${s * 6}deg)`;
    }
    for (const el of document.querySelectorAll('.live-cal')) {
      el.querySelector('.cal-day').textContent = DAYS[now.getDay()];
      el.querySelector('.cal-date').textContent = String(now.getDate());
    }
  };

  tick();
  setInterval(tick, 1000);
}
