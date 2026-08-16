# Home Screen Hoops

A web page that looks exactly like an iPhone home screen. **Press and hold the
Search pill** and every app icon turns into a basketball, drops into a pile at
the bottom, and a hoop swings down from the top. Flick the balls in.

Swipe up from the very bottom edge at any time and everything flies back into
the grid, like nothing happened.

## Try it

**→ [uvkush.github.io/home-screen-hoops](https://uvkush.github.io/home-screen-hoops/)**

Open it on a phone, then **Share → Add to Home Screen**. It launches with no
browser bars at all, which is most of the joke.

To run it locally:

```bash
python3 -m http.server 8765
```

## How to play

- **Hold the Search pill** for about half a second to break the phone
- **Flick the glowing ball upward** toward the hoop — the direction and speed of
  your flick is the shot
- The hoop parks in the left corner for the first two shots, then sweeps corner
  to corner, getting faster as you go
- One shot per app icon on the page you broke (24 on page one, 20 on page two)
- **Tilt** the phone — gravity genuinely follows it. On iOS tap the pulsing
  **Enable tilt** chip first; Apple requires a permission prompt before a page
  can read motion, and firing that on load would give the gag away. Lean to
  curve a shot in the air (20 degrees moves it about 170px), lay the phone flat
  and the balls go nearly weightless, **turn it over and the whole pile pours to the
  top** — which, holding an upside-down phone, reads as it pouring to the
  bottom. Turn it back and everything returns; no balls are lost
  Note the resting pile barely shifts: 24 balls at 62px is 6 across a 375px
  screen, so it's wall-to-wall with nowhere to go. It loosens as you use balls up

## Tuning it

Every number that decides how the game *feels* lives in one place:
[`js/config.js`](js/config.js). Change a value, reload, see what happens.

| Dial | What it does |
| --- | --- |
| `power`, `maxSpeed` | how hard a flick throws |
| `gravity`, `air` | how heavy and floaty the ball is |
| `aimAssist` | 0 is brutally honest, 0.3 bends shots toward the rim |
| `hoopSpeed` | how fast the hoop sweeps — **the one to turn first** |
| `hoopRange` | 1.0 is corner to corner, lower keeps it away from the launch corner |
| `holdMs` | how long you hold Search before it breaks |

## How it works

The trick is that **an app icon and a basketball are the same DOM element.** It
doesn't get replaced — it just stops being a grid item and starts being a physics
body. That's what makes it read as "my phone broke" rather than "a game loaded".

```
index.html          the fake home screen, and the splash
js/config.js        all the tuning dials
js/apps.js          which apps are on which page
js/homescreen.js    builds the pages, dock, status bar, page swiping
js/liveicons.js     the ticking Clock and the real-date Calendar
js/longpress.js     the hold-to-break trigger
js/transform.js     icons -> balls and back again
js/physics.js       gravity, contacts, rim, scoring   (unit tested)
js/hoop.js          the hoop, and how it sweeps
js/game.js          shots, score, streaks, scorecard
js/sound.js         every noise, synthesised
js/fire.js          the ember trail
js/dials.js         the hidden tuning panel
js/uvy.js           the star card
js/leaderboard.js   the end screens, sharing, install help
js/main.js          input and the animation loop
worker/             the leaderboard API (Cloudflare + D1)
```

The whole pile is simulated the whole time, which is what lets you pick up any
ball and barge the others out of the way — and any number of shots can be in the
air at once, so you never wait for one to land before taking the next.

Making the pile live is harder than it sounds. A heap of near-frictionless
spheres creeps down its own slope forever, one separation pass can't resolve a
stack, and a ball resting on one that's anchored to the floor keeps a phantom
velocity that makes it look busy while sitting perfectly still. Hence the contact
friction, the solver iterations, and sleeping balls being judged on distance
actually moved rather than on what their velocity claims.

## Hidden bits

**Tap Settings seven times** (on the home screen, within a couple of seconds) and
you get the real tuning dials — gravity, shot power, aim help, hoop speed and the
rest, as live sliders. They write straight into `TUNE`, so the change lands
immediately, and there's a Reset. It's the one icon where a secret settings
panel isn't a joke at the game's expense: it *is* the Settings app.

**Three baskets in a row and the ball catches fire** — it trails embers, the rim
glows and the net warms up. Once you're lit you stay lit; it takes **three
misses in a row** to put it out, so one unlucky rim-out doesn't end a hot streak.
Both numbers are `fireAt` and `coolAfter` in [`config.js`](js/config.js).

**Tap the UVY icon** (it's on both pages): *"You finally became a star on UVY"*,
with the real app icon and a short rising chime. The icon is pulled from the same
sprite cell the home screen uses, so it can't drift out of step with it. The
card also points at the next secret — an easter egg nobody finds isn't much of a
reward, and one hidden thing hinting at the next is how people end up hunting
for the rest.

**The Clock and the Calendar tell the truth.** Real ticking hands, today's real
date — exactly like iOS. They're drawn as live SVG rather than taken from the
sprite, because hands baked into a picture can't move. It's the detail that
makes someone look twice and wonder whether the phone is actually fake.

## Sound

There are no audio files. Every sound is synthesised in
[`js/sound.js`](js/sound.js) with the Web Audio API — a filtered noise burst for
the net, inharmonic sine partials for the rim, a pitched thud for bounces.

That's not just to save bytes. **A synthesised impact can be shaped by the
physics.** `stepBall` records what the ball hit and how fast, so a graze off the
rim and a full-force clang come out genuinely different, and a ball dribbling to
a stop gets quieter and higher-pitched with each bounce the way a real one does.
A recorded sample can't do that.

What you hear: a dribble thud while you hold Search, a deep thump as the phone
breaks, the cascade of two dozen balls hitting the floor, a whoosh on release,
iron on the rim, and nylon through the net. No music, no crowd, and nothing at
all when you poke a fake icon — real phones don't beep at you.

Audio can only start from a real tap, so it unlocks on the Spotlight press. **On
iOS the ring/silent switch mutes all of it** and no web page can override that,
which is probably right for something you hand to someone across a quiet table.

## The leaderboard

When the last shot is gone you can **keep going**, or put your name up. Only the
name appears on the board — the email or phone is stored privately and no API
route ever reads it back out.

**It's switched off until you deploy the backend.** Until then the game plays
exactly the same, the "Get on the leaderboard" button simply isn't there.

To switch it on:

```bash
cd worker && ./setup.sh
```

That signs you into Cloudflare, creates the D1 database, applies the schema,
sets a rate-limit salt, deploys the Worker, and writes its URL into
`js/config.js`. Then commit and push and it's live.

To read the signups:

```bash
npx wrangler d1 execute hoops --remote --command "SELECT name, contact, score, at FROM scores ORDER BY at DESC LIMIT 50"
```

A few things worth knowing:

- **You're now holding other people's contact details.** They're in your
  Cloudflare account, not in this repo — but they're real personal data, so
  tell people what you'll use them for and delete them when you're done.
- Submissions are rate limited to 12/hour per IP, and IPs are stored only as a
  salted, truncated hash.
- Names are stripped of control, zero-width and bidi characters so nobody can
  make their entry render as something other than what's stored. There's no
  profanity filter — add one if this goes anywhere public.
- Only `https://uvkush.github.io` and localhost may call the API. Change
  `ALLOWED_ORIGINS` in `worker/wrangler.jsonc` if the site moves.

## Changing the icons

Drop a PNG into `assets/icons/`, add it to [`js/apps.js`](js/apps.js), then
repack the sprite:

```bash
npm run build
```

That regenerates `assets/sprite.webp` and `js/sprite.js`. Nothing else is built —
the page runs straight from source.

## Why it loads fast

It's ~130 KB over 15 requests, and everything starts downloading at once.

| | before | after |
| --- | --- | --- |
| requests | 54 | 15 |
| icons | 40 PNGs, 432 KB | 1 sprite, 96 KB |
| wallpaper | 160 KB JPEG | 30 KB WebP |

Three things did it:

- **One sprite instead of 40 icons.** Each icon is a cell of a single WebP, so
  it's one request rather than forty.
- **`modulepreload` on the whole module graph.** ES modules load in waves —
  `main.js` can't request what it imports until it has been fetched and parsed.
  That was three round trips before anything appeared; now the whole graph is
  fetched in parallel.
- **Preloading the images.** Both are referenced from CSS and JS, so they used to
  queue behind the stylesheet and the module graph. Now they start with the HTML.

WebP needs iOS 14+ (2020). Older phones would show a blank grid.

## Tests

```bash
npm test
```

The two parts with real logic are the parts with tests.

**Physics** — scoring must require a *downward* crossing between the posts, rim
clangs must deflect, balls must not tunnel through the floor or walls, and the
aim assist's predicted trajectory is checked against the actual integrator.

**Leaderboard input** — names are public and contact details are required, so
both validators are pinned down: control/zero-width/bidi stripping, email and
phone shapes, length caps, and the fact that `Number(null)` is `0` and must not
sneak through as a valid score.

## Credit

App icons and wallpaper are Apple's, used here for a joke. Everything else is in
this repo.
