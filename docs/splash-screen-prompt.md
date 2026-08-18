# Prompt: the bouncing splash screen

Copy everything below the line into a fresh AI session, in the repo you want the
splash added to. It is written to be pasted whole.

Two things you must supply, and one you must measure:

| | |
| --- | --- |
| **Logo** | An inline `<svg>` with a square `viewBox`. Goes directly inside `<div class="tile">`. Not an `<img>` — it has to be inline so it paints on the first frame with no extra request. |
| **Sound** | An mp3 of roughly 2–4s at `assets/intro.mp3`. Re-encode to 128 kbps; 256 is a music bitrate and doubles the page for no audible gain. |
| **Timings** | Measured from *your* sound, not copied from here. Step 1 does this. |

---

## The prompt

Build me a loading screen that behaves like a bouncing ball, with its bounce
timed to an audio sting.

### What it does

A logo falls in from above, lands, and dribbles in place like a basketball —
squashing on contact and stretching as it falls. A trail streaks behind it on the
way in. Sparks fly out sideways each time it lands. A byline sits at the foot of
the screen. When loading finishes the whole screen scales up slightly and fades,
the way an iOS app opens.

**The bounce lands on the beat of the sound.** That is the point of the thing —
do not skip step 1 and use my numbers.

### Step 1 — measure the audio, do not guess

Put the sting at `assets/intro.mp3`, then find where its attacks actually are:

```bash
ffmpeg -v error -i assets/intro.mp3 -ac 1 -ar 22050 -f s16le - 2>/dev/null | python3 -c "
import sys, array, math
raw = sys.stdin.buffer.read()
a = array.array('h'); a.frombytes(raw[:len(raw)//2*2])
W = 110
env = []
for i in range(0, len(a)-W, W):
    w = a[i:i+W]; env.append(math.sqrt(sum(s*s for s in w)/len(w)))
pk = max(env) or 1; env = [e/pk for e in env]; hop = W/22050
print('silence ends: %.3fs' % next(i*hop for i,e in enumerate(env) if e>0.02))
last = -1
for i in range(4, len(env)-2):
    prev = sum(env[i-4:i])/4
    if env[i]>0.18 and env[i]>prev*1.55 and env[i]>=env[i+1] and env[i]>=env[i-1]:
        t = i*hop
        if t-last > 0.055: print('  onset %.3fs  strength %.2f' % (t, env[i])); last = t
"
```

Take the **first two onsets**. Then:

- `FALL` = the first onset. The logo falls through the opening silence and hits
  the floor exactly as the first sound arrives.
- `PERIOD` = the gap between the first and second onset. That is the bounce
  period, and everything else on the screen runs on it.

Sanity-check `PERIOD`: 0.35–0.6s is a real dribble tempo. Outside that, use the
gap between two *other* strong onsets instead, or a multiple of it — a 0.2s
bounce reads as a vibration, and a 1.2s one as a dropped ball.

In this project those came out as `FALL = .339s` and `PERIOD = .389s`. **Yours
will differ.** Substitute them everywhere the CSS below says `.339s` and `.389s`.

### Step 2 — the markup

Inline in `index.html`, as the first thing in `<body>`:

```html
<div id="splash">
  <div class="tile">
    <!-- YOUR LOGO HERE: inline <svg>, square viewBox, width/height 100% -->
  </div>
  <div class="shadow"></div>
  <!-- A zero-size point on the contact line. Not inside .tile or .shadow —
       both are being scaled, and sparks that squash with the ball are wrong. -->
  <div class="sparks" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
  <p class="by">made by uv kush</p>
```

### Step 3 — the CSS

**Inline in a `<style>` block in `<head>`, not in your stylesheet.** The splash
has to paint on the very first frame; a linked file costs a round trip before the
loading screen itself can appear.

```html
<style>
  /* ── the loading screen ──────────────────────────────────────
     Roughly a second on screen, so everything here has to read at a glance.
     The tile is the app icon behaving like a basketball, which is the trick the
     whole game is built on — so the splash is a small promise of it. */
  #splash {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    /* Brand yellow, and the manifest's background_color matches it, so the
       launch screen iOS paints before the page exists is the same colour as the
       page — nothing flashes between the two. */
    background: linear-gradient(#ffe55c 0%, #ffc800 100%);
    /* The exit: the whole screen lifts away and fades, the way an app opens.
       Scaled here rather than on the tile so it composes with the dribble —
       stopping that animation mid-flight would snap the transform and jump. */
    transition: opacity .4s ease, transform .4s cubic-bezier(.32, .72, 0, 1);
    /* failsafe: if the scripts never run, don't trap anyone on a blank screen */
    animation: splash-bail 1ms linear 6s forwards;
  }
  #splash.done {
    opacity: 0;
    transform: scale(1.14);
    pointer-events: none;
  }
  @keyframes splash-bail { to { opacity: 0; visibility: hidden; } }

  /* No tile. The white one existed only because a black-on-yellow logo needs a
     light surface to sit on, and on yellow it already has one — the dark disc
     drawn behind the face is what keeps it from melting into the background.
     This element is now just the thing that bounces. */
  #splash .tile {
    width: 200px;
    height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
    /* Squash from the base, not the middle. A ball flattening against the floor
       keeps its contact point still; scaling about the centre makes it sink
       into the ground instead. */
    transform-origin: 50% 100%;
    will-change: transform;
    position: relative;
    /* Timed off intro.mp3, measured rather than guessed. The track opens with
       294ms of silence; its first and hardest attack is at 339ms and the next
       at 728ms. So the ball falls through the silence and lands ON the first
       hit, and the bounce period is the 389ms between the two — which is about
       154 a minute, a real dribble tempo, so nothing had to be bent to fit.
       drop-in ends on the floor squashed, which is exactly the pose dribble
       now opens on, so the handover is invisible. */
    animation: drop-in .339s cubic-bezier(.4, 0, .8, .55) both,
               dribble .389s .339s infinite;
  }
  /* The trail. A child of the tile, so it travels WITH the logo — anchored to
     the thing that's moving and stretching back toward where it came from,
     then catching up as it lands. Entrance only: the drop covers 156px and is
     the one genuinely fast move, and streaking every bounce would be noise
     inside a screen that lasts a second. */
  #splash .tile::before {
    content: '';
    position: absolute;
    left: 50%;
    bottom: 44%;
    width: 38px;
    margin-left: -19px;
    height: 260px;
    border-radius: 19px;
    background: linear-gradient(rgba(92, 54, 0, 0), rgba(92, 54, 0, .20));
    transform-origin: 50% 100%;
    animation: streak .339s cubic-bezier(.4, 0, .8, .55) both;
    pointer-events: none;
  }

  #splash .tile svg {
    width: 100%;
    height: 100%;
    display: block;
    /* it used to borrow the tile's box-shadow; now it needs its own lift */
    filter: drop-shadow(0 12px 18px rgba(92, 54, 0, .46));
    /* A lean into the bounce rather than a spin. A full rotation on a face
       reads as tumbling — this just gives it weight. */
    animation: lean .389s .339s ease-in-out infinite;
  }

  #splash .shadow {
    width: 136px;
    height: 18px;
    /* Pulled up under the artwork rather than under the box. The face stops
       about three quarters of the way down its viewBox, so the svg's lower
       quarter is empty — measured from the box, the ball lands a clear 50px
       above its own shadow. */
    margin-top: -45px;
    border-radius: 50%;
    background: #5c3600;
    filter: blur(6px);
    will-change: transform, opacity;
    /* Hidden until the tile has landed — a shadow with nothing above it is a
       smudge. The delay leaves it at this opacity until dribble takes over. */
    opacity: 0;
    animation: squash .389s .339s infinite;
  }

  /* Zero-size and in normal flow, so it lands on the contact line at any screen
     size without a measured offset to drift out of date. */
  #splash .sparks {
    position: relative;
    width: 0;
    height: 0;
    margin-top: -18px;
  }
  #splash .sparks i {
    position: absolute;
    left: 0;
    top: 0;
    width: 10px;
    height: 10px;
    margin: -5px 0 0 -5px;
    border-radius: 50%;
    background: #5c3600;
    opacity: 0;
    /* Same period and delay as the bounce, so the burst is pinned to the 46%
       impact keyframe rather than drifting on a clock of its own. */
    animation: spark .389s .339s infinite;
    will-change: transform, opacity;
  }
  /* rotate-then-translate sends each one out along its own angle, which lets a
     single keyframe block serve all six */
  #splash .sparks i:nth-child(1) { --a: -114deg; --d: 68px; }
  #splash .sparks i:nth-child(2) { --a:  -88deg; --d: 92px; }
  #splash .sparks i:nth-child(3) { --a:  -63deg; --d: 74px; }
  #splash .sparks i:nth-child(4) { --a:   63deg; --d: 76px; }
  #splash .sparks i:nth-child(5) { --a:   88deg; --d: 94px; }
  #splash .sparks i:nth-child(6) { --a:  114deg; --d: 66px; }

  /* Down at the foot of the screen rather than tucked under the ball, so the
     logo owns the middle. Absolute, so it also stops counting toward the
     centring of the flex column above it.
     env() rather than the --safe-b custom property: this stylesheet is inline
     and paints before styles.css arrives, and a var() that isn't defined yet
     would take the whole declaration down with it. */
  #splash .by {
    position: absolute;
    left: 0;
    right: 0;
    bottom: calc(env(safe-area-inset-bottom, 0px) + 46px);
    margin: 0;
    text-align: center;
    font: 800 13px/1 -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
    letter-spacing: .22em;
    text-transform: uppercase;
    color: #000;
    text-shadow: 0 1px 1px rgba(255, 255, 255, .4);
    opacity: 0;
    animation: sign-in .4s ease .38s forwards;
  }

  /* Falls through the track's opening silence and hits the floor on the beat. */
  @keyframes drop-in {
    0%   { transform: translateY(-250px) scale(.9, 1.14); opacity: 0; }
    45%  { opacity: 1; }
    86%  { transform: translateY(-24px) scale(.92, 1.11); opacity: 1;
           animation-timing-function: cubic-bezier(.5, 0, .75, .6); }
    100% { transform: translateY(0) scale(1.14, .85); opacity: 1; }
  }

  /* A dribble, not a drop: the height holds because a hand keeps putting the
     energy back. What sells it is the stretch on the way down and the fact that
     contact is nearly instant — most of the cycle is spent in the air. */
  @keyframes dribble {
    0%   { transform: translateY(0) scale(1.14, .85);
           animation-timing-function: cubic-bezier(.05, .8, .3, 1); }
    14%  { transform: translateY(-21px) scale(.95, 1.06); }
    50%  { transform: translateY(-42px) scale(1, 1);
           animation-timing-function: cubic-bezier(.4, 0, .8, .5); }
    86%  { transform: translateY(-18px) scale(.94, 1.08); }
    100% { transform: translateY(0) scale(1.14, .85); }
  }

  @keyframes streak {
    0%   { transform: scaleY(1); opacity: .85; }
    70%  { opacity: .5; }
    100% { transform: scaleY(0); opacity: 0; }
  }

  /* Nothing until contact, then out and gone well before the next bounce. */
  @keyframes spark {
    0%   { transform: rotate(var(--a)) translateY(-6px) scale(1); opacity: .95; }
    45%  { transform: rotate(var(--a)) translateY(calc(var(--d) * -1)) scale(.25);
           opacity: 0; }
    100% { transform: rotate(var(--a)) translateY(calc(var(--d) * -1)) scale(.25);
           opacity: 0; }
  }

  @keyframes lean {
    0%, 100% { transform: rotate(0deg); }
    30%      { transform: rotate(3deg); }
    70%      { transform: rotate(-4deg); }
  }

  /* Tight and dark under the ball, wide and faint when it's up. */
  @keyframes squash {
    0%, 100% { transform: scale(1.06, 1);   opacity: .62; }
    50%      { transform: scale(.58, .72); opacity: .24; }
  }

  @keyframes sign-in {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: none; }
  }

  @keyframes settle-in { from { opacity: 0; } to { opacity: 1; } }

  /* Reduced motion asks for a gentler, non-vestibular equivalent — not for
     nothing to happen. The bouncing, leaning and travelling all go; a plain
     cross-fade stays, so the screen still reads as arriving rather than as a
     still someone forgot to animate. The exit keeps its fade and drops its
     scale, since the zoom is the vestibular half of it.
     The two elements that fade themselves IN also need their end opacity
     restored by hand, or they would never appear at all. */
  @media (prefers-reduced-motion: reduce) {
    #splash .tile svg,
    #splash .shadow,
    #splash .by { animation: none; transform: none; }
    /* decoration with nothing to say, so it simply doesn't happen */
    #splash .tile::before,
    #splash .sparks { display: none; }
    #splash .tile { animation: settle-in .32s ease both; transform: none; }
    #splash .shadow { opacity: .42; }
    #splash .by { opacity: 1; }
    #splash.done { transform: none; }
  }
</style>
```

### Step 4 — the JavaScript

```js
// Hold the screen until the artwork it needs is decoded, so the app appears
// fully formed rather than assembling itself in front of the user.
const NEEDED = ['assets/your-image.webp'];   // whatever must be ready
const MIN_MS = 1100;    // shortest time the logo stays up
const MAX_MS = 4000;    // give up waiting and show the app anyway

const INTRO = 'assets/intro.mp3';
let intro = null;

/**
 * iOS is excluded before anything is constructed, not after play() fails.
 * Creating the element claims the audio session, which silences any
 * AudioContext the app opens later — so by the time the promise rejects, the
 * damage is done. An iPad sends a Mac's user agent, hence the touch points.
 */
function introAllowed(nav = navigator) {
  const iPadOS = nav.platform === 'MacIntel' && nav.maxTouchPoints > 1;
  return !(/iPhone|iPad|iPod/.test(nav.userAgent) || iPadOS);
}

function playIntro() {
  if (!introAllowed()) return;
  try {
    intro = new Audio(INTRO);
    intro.volume = 0.55;
    intro.play().catch(() => { intro = null; });   // refused elsewhere; fine
  } catch { intro = null; }
}

/** Fade and drop it — the sting outlives the screen it belongs to. */
export function stopIntro(ms = 260) {
  const sound = intro;
  if (!sound) return;
  intro = null;
  const from = sound.volume, started = performance.now();
  (function fade(now = started) {
    const done = (now - started) / ms;
    if (done >= 1) { sound.pause(); return; }
    sound.volume = from * (1 - done);
    requestAnimationFrame(fade);
  })();
}

export function runSplash() {
  const el = document.getElementById('splash');
  if (!el) return;
  const started = performance.now();
  playIntro();

  const ready = Promise.all(NEEDED.map((src) => new Promise((done) => {
    const img = new Image();
    img.onload = img.onerror = done;      // a failed image must not strand anyone
    img.src = src;
  })));

  Promise.race([ready, new Promise((r) => setTimeout(r, MAX_MS))]).then(() => {
    const held = performance.now() - started;
    setTimeout(dismiss, Math.max(0, MIN_MS - held));
  });

  function dismiss() {
    el.classList.add('done');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 900);   // in case the transition never fires
  }
}
```

Call `stopIntro()` when the user starts doing something with sound of its own.

### Things that will bite you

1. **Put the sound somewhere that actually ships.** Check it is not inside a
   gitignored folder. It will work locally and 404 in production.

2. **On iOS the sound will not play at all. Confirmed on a real device.**
   iOS refuses audio that starts without a user gesture, and a loading screen has
   not had one. There is no flag and no trick; the only fix is putting a tap on
   the loading screen, which usually costs more than the sound is worth. Catch
   the rejected promise, carry on, and treat the sound as a bonus for the
   platforms that allow it. Do not trust an automated browser here — they
   normally run with the policy switched off and will report success.

   **Do not even construct the audio element on iOS.** Creating it claims the
   audio session, which silences any `AudioContext` your app later opens — so a
   sting that can never play will take the rest of your sound with it. Gate it
   on a platform check, not on the play() rejection: by the time the promise
   rejects, the damage is done.

   Time the animation to the audio anyway. The sync is what gives the motion its
   shape, and that survives whether or not anyone hears the track.

3. **Match the platform launch colour to the splash background.** In
   `manifest.json` set `background_color` to the splash's colour. That is what
   the OS paints before your page exists, and a mismatch flashes on every launch
   of an installed app. Leave `theme_color` matching the *app*, not the splash.

4. **Position the shadow under the artwork, not under the box.** An svg's drawing
   rarely fills its viewBox. Measure where it actually ends
   (`svg.getBBox()`) and pull the shadow up with a negative margin, or the ball
   will land a visible gap above its own shadow.

5. **Sparks must ease outward, not travel linearly.** With linear motion they
   reach full distance exactly as they fade out, so every visible frame is a
   clump at the ball's feet. Shoot them out fast and decelerating.

6. **Keep sparks out of anything that scales.** They cannot be children of the
   squashing logo or the scaling shadow. A zero-size element in the centred
   column puts them on the contact line at any screen size.

7. **Inline CSS needs a full page reload to re-test.** Injecting fresh markup
   into a live page reuses the stylesheet the page loaded with, so your edits
   silently will not appear.

8. **Reduced motion means gentler, not absent.** Strip the bounce, the lean, the
   trail and the sparks — but keep a short cross-fade, and restore an explicit
   opacity on anything whose only route to visible was an animation, or it will
   never appear at all.

### Checking it

Freeze the animation and assert the poses, rather than trusting your eyes:

```js
const s = document.getElementById('splash');
const anims = s.getAnimations({ subtree: true });
anims.forEach(a => a.pause());
const tile = s.querySelector('.tile');
// at FALL and every FALL + n*PERIOD the ball must be on the floor and squashed
anims.forEach(a => a.currentTime = 339);          // your FALL, in ms
console.log(getComputedStyle(tile).transform);    // expect translateY 0, scaleY < 1
```
