// ─────────────────────────────────────────────────────────────
//  YOUR DIALS
//  Everything that decides how the game *feels* lives here.
//  Change a number, reload, see what happens. Nothing else to touch.
// ─────────────────────────────────────────────────────────────
export const TUNE = {
  // -- shooting --------------------------------------------------
  power:      1.05,  // how hard a flick throws. bigger = shots fly further
  maxSpeed:   2.05,  // speed cap, in screen-heights per second
  minSpeed:   0.30,  // flick softer than this doesn't count as a shot
  aimAssist:  0.10,  // 0 = brutally honest, 0.3 = bends shots toward the rim

  // -- world -----------------------------------------------------
  gravity:    3.10,  // screen-heights per second². bigger = heavier ball
  air:        0.97,  // fraction of speed a ball keeps per second in the air.
                     // 1 = no drag at all. Don't go far below ~0.9 or shots
                     // stop matching where the aim assist thinks they'll land
  rimBounce:  0.52,  // bounciness off the rim. 0 = dead thud, 1 = superball
  wallBounce: 0.58,  // bounciness off the left/right screen edges
  floorBounce:0.46,  // bounciness off the bottom
  roll:       0.12,  // how quickly balls rolling on the floor slow down.
                     // raise it and tilting stops moving them at all

  // -- tilt ------------------------------------------------------
  tiltStrength: 0.55, // how hard leaning the phone drags the balls sideways.
                      // 0 turns tilt off completely, 1 is comically slidey.

  // -- loading screen --------------------------------------------
  splashMs:    1100, // shortest time the logo stays up. The page loads in a few
                     // hundred ms, so without this the splash just flashes by
  splashMaxMs: 4000, // give up waiting for artwork after this and show the phone

  // -- the gag ---------------------------------------------------
  holdMs:     550,   // how long you hold Spotlight before it breaks
  dropMs:     1900,  // how long the icons tumble before the pile freezes

  // -- the match -------------------------------------------------
  totalShots: 24,    // one per app icon
  freeShots:  2,     // SHOTS TAKEN before the hoop starts moving, so it kicks in
                     // on shot 3 whether or not the first two went in
  hoopSpeed:  0.85,  // how fast it sweeps once it starts. THIS is the dial to
                     // turn if the hoop feels too fast or too slow
  hoopRamp:   0.12,  // extra speed per shot after that
  hoopRampMax: 2.5,  // ...but never more than this multiple of hoopSpeed.
                     // Without a ceiling the ramp compounds over 24 shots and
                     // the hoop ends up crossing the screen in a blink
  hoopRange:  1.00,  // widest it ever sweeps. 1 = corner to corner. Note that
                     // when the hoop passes over the launch corner, a straight-up
                     // flick will drop back through it — lower this to about 0.7
                     // if that feels too cheap
  hoopGrowFrom: 0.30, // how wide the sweep is on the very first moving shot.
                      // Starting near 0 is technically progressive but reads as
                      // "the hoop isn't moving", so it opens at a visible third
  hoopGrow:   0.09,   // extra width unlocked per shot after that, reaching the
                      // full corner-to-corner sweep around shot 11
};

// Where the leaderboard backend lives. Leave it empty and the leaderboard is
// simply off — the game plays exactly the same, the "Get on the leaderboard"
// button just doesn't appear. `worker/setup.sh` fills this in after deploying.
export const API = {
  apiBase: 'https://hoops-leaderboard.uv2647.workers.dev',
};

// Ranks shown on the scorecard, checked from the top down. Kept as fractions
// of the shots taken, because a page with 16 apps gives you fewer than 24.
export const RANKS = [
  { min: 1.00, name: 'Perfect Game'  },
  { min: 0.90, name: 'Hall of Famer' },
  { min: 0.72, name: 'All-Star'      },
  { min: 0.50, name: 'Sixth Man'     },
  { min: 0.25, name: 'Benchwarmer'   },
  { min: 0,    name: 'Airball'       },
];

export const rankFor = (score, total) =>
  RANKS.find((r) => score / Math.max(1, total) >= r.min).name;
