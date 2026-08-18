# Home Screen Hoops

A web page that looks exactly like an iPhone home screen. **Press and hold the
Search pill** and every app icon turns into a basketball, drops into a pile at
the bottom, and a hoop swings down from the top. Flick the balls in.

Swipe up from the very bottom edge at any time and everything flies back into
the grid, like nothing happened.

## Try it

**→ [uvkush.github.io/home-screen-hoops](https://uvkush.github.io/home-screen-hoops/)**

Open it on a phone, then **Share → Add to Home Screen**. It launches with no
browser bars at all, which is most of the joke — so on a first visit the app
offers to walk you through it, with instructions matched to the browser you're
actually in (iOS Safari, iOS Chrome, Android Chrome, Samsung Internet, Firefox,
or desktop). Where the browser supports it, that becomes a single **Install**
button instead. Shown once, never again.

To run it locally:

```bash
npm start
```

That's `tools/serve.py`, which serves with `no-store`. Plain
`python -m http.server` sends no cache headers at all, so browsers apply
heuristic freshness and quietly reuse an ES module you edited seconds ago —
you reload, see no change, and go hunting for a bug that isn't there.

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
js/homescreen.js    builds the pages, dock, page swiping
js/liveicons.js     the ticking Clock and the real-date Calendar
js/splash.js        the loading screen, and when to let go of it
js/longpress.js     the hold-to-break trigger
js/transform.js     icons -> balls and back again
js/physics.js       gravity, contacts, rim, scoring   (unit tested)
js/hoop.js          the hoop, and how it sweeps
js/tilt.js          gravity follows the phone   (iOS only)
js/game.js          shots, score, streaks, scorecard
js/sound.js         every noise, synthesised
js/fire.js          the ember trail
js/dials.js         the hidden tuning panel
js/uvy.js           the star card
js/scorecard.js     the end screens: result, sign-up, board
js/board.js         one ranked list, shared by the card and the screen   (unit tested)
js/boardscreen.js   the leaderboard as its own app   (tap Reminders)
js/share.js         the share sheet, X, and the toast   (unit tested)
js/install.js       add-to-home-screen, per browser   (unit tested)
js/api.js           talking to the worker
js/analytics.js     the Cloudflare beacon, off unless configured   (unit tested)
js/main.js          input and the animation loop
worker/             the leaderboard API (Cloudflare + D1)
worker/privacy.sh   what's held on people, and how to stop holding it
```

The status bar lives outside `#home`, as a direct child of `<body>`. It's phone
chrome rather than part of the home screen, which is what lets it stay put when
an app screen slides over the top — the way a real one does.

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

**Tap Reminders** and the leaderboard opens as its own app — sliding up over the
home screen, below the home bar, so the bar stays put as chrome and as the way
out. Leaving is the same swipe, and the same two numbers, as quitting a game;
`Done` and `Esc` are there for anyone on a desktop, where a drag up from the
bottom edge is a gesture nothing hints at. If you've put your name up before, it
finds your row.

**The Clock and the Calendar tell the truth.** Real ticking hands, today's real
date — exactly like iOS. They're drawn as live SVG rather than taken from the
sprite, because hands baked into a picture can't move. It's the detail that
makes someone look twice and wonder whether the phone is actually fake.

## Sound

**The intro sting does not play on an iPhone, and cannot be made to.** Tested on
a real device: silent. iOS refuses audio that starts without a user gesture, and
a loading screen has not had one yet — there is no flag, no trick, and no
muted-autoplay path of the sort video gets. Anything that fixed it would mean
putting a tap on the loading screen, which costs more than the sound is worth.

Worse than silent, in fact. Creating the audio element at all claims the iOS
audio session, and that leaves the `AudioContext` every sound in the *game* runs
through producing nothing — so a sting that could never play was costing all the
audio that could. On iOS the element is therefore never created.

Elsewhere it plays as normal, and a refusal is caught so nothing else notices. Worth knowing if
you test it in an automated browser and everything looks fine — those usually run
with the autoplay policy switched off and will tell you it works.

The bounce is timed to that audio regardless (see the splash section of
[`index.html`](index.html)); the sync is what shapes the animation whether or not
anyone hears it.

Every sound in the *game* is synthesised — there are no audio files behind any
of it. The one exception is that intro sting
(`assets/intro.mp3`, 51 KB), which is a recording. Everything else is made in
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

When the last shot is gone you can **keep going**, share the score, or put your
name up. Sharing offers two destinations for the same post: **Share on X** goes
straight into the X app's composer via its own `twitter://` scheme, and
**Share…** opens the system sheet for Messages, WhatsApp, Notes and the rest.
The second only appears where the browser has a share sheet to open. Only the
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

### Whose data you're now holding

The form asks for an email or phone and promises to keep it private, which makes
it your problem to keep. [`worker/privacy.sh`](worker/privacy.sh) is how:

```bash
cd worker
./privacy.sh list                  # everyone whose details are still held
./privacy.sh show   <contact>      # what's held on one person
./privacy.sh forget <contact>      # drop their details, keep their score
./privacy.sh erase  <contact>      # remove them from the board entirely
./privacy.sh sweep                 # apply the retention rules now
```

Start with `list` — it prints the values the other commands take.

**Details expire on their own.** A daily cron runs `sweep()` in the Worker, which
empties `contact` after 90 days and the IP hash after 7. The row, its name and
its score all stay: a leaderboard that forgets its scores isn't a leaderboard, so
only the private half has a lifetime. Keeping something private forever is not
the same as keeping it forever, and the reason it was collected — reaching
whoever is at the top — stops applying long before the score stops being
interesting. Change the windows in
[`worker/src/index.js`](worker/src/index.js) and keep `privacy.sh` in step.

`forget` is usually the one you want: it clears the private half and leaves the
name and score standing, so the board doesn't develop a hole where someone used
to be.

A few other things worth knowing:

- Submissions are rate limited to 12/hour per IP, and IPs are stored only as a
  salted, truncated hash — which is itself cleared after a week, the limiter only
  ever looking back an hour.
- No route reads `contact` back out. The public queries name their columns
  explicitly rather than using `SELECT *`, so a new column can't quietly start
  being published.
- Names are stripped of control, zero-width and bidi characters so nobody can
  make their entry render as something other than what's stored. There's no
  profanity filter — add one if this goes anywhere public.
- `ALLOWED_ORIGINS` in [`worker/wrangler.jsonc`](worker/wrangler.jsonc) lists the
  sites that may call the API; change it if yours moves. Any localhost origin is
  allowed on top of that, whatever port the dev server picked, so the check is
  done by parsing the origin rather than matching how it starts —
  `localhost.example.com` is not your machine.

## Changing the icons

Drop a PNG into `assets/icons/`, add it to [`js/apps.js`](js/apps.js), then
repack the sprite:

```bash
npm run build
```

That regenerates `assets/sprite.webp` and `js/sprite.js`, and redraws the
home-screen icons from [`tools/make-icon.py`](tools/make-icon.py). Nothing else
is built — the page runs straight from source.

The icon is the UVY mark drawn with Pillow rather than exported from the SVG:
there's no SVG rasteriser on this machine, and it's drawn at 8x then shrunk,
because Pillow has no antialiasing of its own. On a white background, since iOS
composites any transparency onto black.

## Why it loads fast

It's ~130 KB over 15 requests for the page itself, and everything starts
downloading at once. The intro sting adds a 51 KB request on top, deliberately
outside that set: the splash waits on artwork, because the home screen looks
wrong without it, and never on a sound.

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

Nothing on the page comes from anywhere else, with one optional exception: the
Cloudflare Web Analytics beacon, if you switch it on. It's one deferred request
and only loads when a token is set — see below.

## Analytics

Off by default. Set a token in [`js/config.js`](js/config.js) and the Cloudflare
Web Analytics beacon loads:

```js
export const ANALYTICS = { token: 'your-token' };
```

Get one from the Cloudflare dashboard under **Analytics & Logs → Web Analytics →
Add a site**. You then read browser and device breakdowns there; nothing is
stored in this project or in D1.

**Enter a hostname, not a URL** — `uvkush.github.io`, with no `https://` and no
path. Cloudflare matches hostnames by postfix, so one entry covers every path on
it. That also means it covers every *other* project published to the same
`github.io` hostname, so if you add the beacon to one of those too, both land in
the same bucket.

That token belongs in the page. It says which site a pageview counts towards, it
grants nothing and reads nothing back — it's public by design, and committing it
isn't a leak.

Two things it deliberately doesn't do:

- **No request at all when the token is empty**, which is why it lives in
  `config.js` rather than being pasted into `index.html`. A placeholder token in
  the markup would fail on every visit until it was filled in.
- **Never loads on localhost**, so your own development isn't in your numbers.

It sets no cookies and identifies nobody, so unlike the contact details there's
nothing here to disclose, retain or delete. If you want per-visitor detail
instead, that's a tracking log and it inherits all three of those obligations —
worth being deliberate about rather than drifting into.

Two things to expect before you read anything into the numbers:

- **Ad blockers block it.** uBlock, Brave and DuckDuckGo all stop the beacon, and
  Cloudflare says so plainly. Treat the counts as a floor, not a census — and
  expect the undercount to skew by browser, which is awkward given browsers are
  the thing being measured.
- **Detail fades.** Unsampled for 7 days, then aggregated to roughly 10%.

The beacon is loaded as `type="module"`, which is how Cloudflare ships and
documents it. The older `<script defer>` form may not run at all — and a beacon
that silently doesn't fire is indistinguishable from a site with no visitors.

## Tests

```bash
npm test
```

No dependencies and nothing to install — it's `node --test` and the standard
library. They also run on every push, via
[`.github/workflows/test.yml`](.github/workflows/test.yml).

The parts with real logic are the parts with tests.

**Physics** — scoring must require a *downward* crossing between the posts, rim
clangs must deflect, balls must not tunnel through the floor or walls, and the
aim assist's predicted trajectory is checked against the actual integrator.

**Leaderboard input** — names are public and contact details are required, so
both validators are pinned down: control/zero-width/bidi stripping, email and
phone shapes, length caps, and the fact that `Number(null)` is `0` and must not
sneak through as a valid score.

**CORS and retention** — that any localhost port is allowed but
`localhost.example.com` is not, and that the retention sweep binds the right
cutoffs, never says `DELETE`, and never assigns to a name or a score.

**The install walkthrough** — which of the six sets of instructions each browser
gets, over real user agent strings. It's regex-and-string logic, the kind that
rots without failing: tighten one pattern and Samsung users quietly start being
told to look for Chrome's three dots. Two cases earn their own tests — an iPad
and a Mac send byte-identical user agents, so touch points are the only thing
telling them apart, and a real install prompt has to beat all six branches.

**Stylesheets for panels built at runtime** — `#uvy`, `#dials`, `#install` and
`#board-screen` exist only once JavaScript makes them, so nothing in
`index.html` mentions them and no amount of reading the markup tells you their
styles went missing. That is not hypothetical: a commit once rewrote
`styles.css` and took the UVY card and the hidden dials with it. Both kept
"working" — handlers ran, elements landed in the DOM — while rendering as
unstyled blocks behind the fixed home screen. The test reads the class names
straight out of the modules, so a panel that grows an element is covered without
anyone remembering to come back.

## Credit

App icons and wallpaper are Apple's, used here for a joke. Everything else is in
this repo.
