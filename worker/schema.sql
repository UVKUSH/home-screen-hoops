-- Home Screen Hoops leaderboard.
--
-- `contact` is personal data. Nothing in the Worker ever selects it, and the
-- public queries name their columns explicitly so it can't leak by accident.
--
-- It also expires. A daily cron runs sweep() in src/index.js, which empties
-- `contact` after 90 days and `ip_hash` after 7 — the row, its name and its
-- score stay, because that is what a leaderboard is for. Personal data is the
-- only part with an end date.
--
-- ./privacy.sh is the way in for anything by hand:
--   ./privacy.sh sweep            apply the retention rules now
--   ./privacy.sh show   <contact> what is held on one person
--   ./privacy.sh forget <contact> drop their details, keep their score
--   ./privacy.sh erase  <contact> remove them from the board entirely

CREATE TABLE IF NOT EXISTS scores (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  name     TEXT    NOT NULL,          -- shown publicly
  contact  TEXT    NOT NULL,          -- private: email or phone
  score    INTEGER NOT NULL,
  total    INTEGER NOT NULL,
  at       INTEGER NOT NULL,          -- epoch ms
  ip_hash  TEXT                       -- salted + truncated, for rate limiting
);

-- the leaderboard read: best score first, earliest wins a tie
CREATE INDEX IF NOT EXISTS idx_scores_board ON scores (score DESC, at ASC);

-- the rate-limit read
CREATE INDEX IF NOT EXISTS idx_scores_ip ON scores (ip_hash, at);
