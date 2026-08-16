# Home Screen Hoops

A web page that looks exactly like an iPhone home screen. **Press and hold the
Search pill** and every app icon turns into a basketball, drops into a pile at
the bottom, and a hoop swings down from the top. Flick the balls in.

Swipe up from the very bottom edge at any time and everything flies back into
the grid, like nothing happened.

## Try it

```bash
python3 -m http.server 8765
```

Then open `http://localhost:8765`. On a phone, use **Share → Add to Home Screen**
— it launches with no browser bars at all, which is most of the joke.

## How to play

- **Hold the Search pill** for about half a second to break the phone
- **Flick the glowing ball upward** toward the hoop — the direction and speed of
  your flick is the shot
- The hoop parks in the left corner for the first two shots, then sweeps corner
  to corner, getting faster as you go
- One shot per app icon on the page you broke (24 on page one, 20 on page two)
- **Tilt** the phone to roll the loose balls around. On iOS you have to tap the
  Tilt chip first — Apple requires a permission prompt before a web page can read
  motion, and firing that prompt on load would give the gag away

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
index.html          the fake home screen
js/config.js        all the tuning dials
js/apps.js          which apps are on which page
js/homescreen.js    builds the pages, dock, clock, page swiping
js/longpress.js     the hold-to-break trigger
js/transform.js     icons -> balls and back again
js/physics.js       gravity, rim, walls, scoring   (unit tested)
js/hoop.js          the hoop, and how it sweeps
js/game.js          shots, score, scorecard
js/main.js          input and the animation loop
```

Only **one ball is ever in flight**, which is the decision the whole thing rests
on — it removes the hard part of physics (two dozen balls resting on each other
without jittering or sinking) and reduces the engine to about a hundred lines.
The resting pile is only simulated when tilt is switched on.

## Tests

```bash
node --test test/physics.test.js
```

Physics is the only part with real logic, so it's the part with tests: scoring
must require a *downward* crossing between the posts, rim clangs must deflect,
balls must not tunnel through the floor or walls, and the aim assist's predicted
trajectory is checked against the actual integrator.

## Credit

App icons and wallpaper are Apple's, used here for a joke. Everything else is in
this repo.
