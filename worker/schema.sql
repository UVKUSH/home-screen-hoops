-- Home Screen Hoops leaderboard.
--
-- `contact` is personal data. Nothing in the Worker ever selects it, and the
-- public queries name their columns explicitly so it can't leak by accident.
-- To read it, query the database directly:
--   npx wrangler d1 execute hoops --remote \
--     --command "SELECT name, contact, score, at FROM scores ORDER BY at DESC"

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
