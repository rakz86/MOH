-- ===========================================================================
-- D1 schema for the periodontic instrument register — centres and requests.
--
-- This mirrors the model in website/ledger.js and website/store.js:
--
--   allocation   per centre, falls back to the standard on the instrument set.
--   request      what a clinic asked for. Changes nothing on its own.
--   decision     an instrument admin's answer to one request. The ONLY thing
--                that writes the ledger.
--   ledger       append-only. Held is derived from it, never stored.
--
-- APPEND-ONLY, ENFORCED HERE AS WELL AS IN THE WORKER
--   `ledger`, `requests`, `request_lines`, `decisions` and `decision_lines`
--   are never updated or deleted. The triggers at the bottom make the
--   database refuse it, so the rule does not depend on every future change
--   to the Worker remembering it.
--
--   A request's status is not a column that gets overwritten: it is
--   'submitted' until a row exists in `decisions`, and then it is whatever
--   that row says. `decisions.request_id` is the primary key, so a request
--   cannot be decided twice — two admins confirming at once get one success
--   and one conflict, not two sets of stock movements.
--
-- `standards` and `allocations` are current values, not history.
-- Every allocation change is also written to the ledger as a 'standard' row,
-- so the ledger can always explain how the current figure was reached.
--
--   npx wrangler d1 execute moh-instruments --file=schema.sql --remote
--
-- An earlier version of this file used a per-clinic `ledger` table with a
-- `scope` column. If that one was ever created, start from a new database:
-- CREATE TABLE IF NOT EXISTS will not reshape it. /api/health reports it.
-- ===========================================================================

-- Item codes (DG01, SG20…) are not stored here: they are fixed in
-- website/data/periodontic-sets.json, and item_key ("surgical:11") is what
-- every table below refers to.

-- The ministry standard for an item, overriding the printed instrument set.
CREATE TABLE IF NOT EXISTS standards (
  item_key    TEXT PRIMARY KEY,          -- "surgical:11"
  qty         INTEGER NOT NULL CHECK (qty >= 0),
  updated_at  TEXT NOT NULL
);

-- What one centre is entitled to hold, where it differs from the standard.
-- Centres themselves live in website/data/centres.json, not here.
CREATE TABLE IF NOT EXISTS allocations (
  centre_id   TEXT NOT NULL,
  item_key    TEXT NOT NULL,
  qty         INTEGER NOT NULL CHECK (qty >= 0),
  updated_at  TEXT NOT NULL,
  updated_by  TEXT,
  PRIMARY KEY (centre_id, item_key)
);

CREATE TABLE IF NOT EXISTS requests (
  id          TEXT PRIMARY KEY,          -- "REQ-20260922-7731"
  centre_id   TEXT NOT NULL,
  centre_name TEXT NOT NULL,             -- as shown when submitted
  created_at  TEXT NOT NULL,             -- ISO 8601, UTC
  created_by  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS request_lines (
  request_id  TEXT NOT NULL REFERENCES requests (id),
  item_key    TEXT NOT NULL,
  ret         INTEGER NOT NULL DEFAULT 0 CHECK (ret >= 0),
  iss         INTEGER NOT NULL DEFAULT 0 CHECK (iss >= 0),
  note        TEXT,
  PRIMARY KEY (request_id, item_key)
);

CREATE TABLE IF NOT EXISTS decisions (
  request_id  TEXT PRIMARY KEY REFERENCES requests (id),
  status      TEXT NOT NULL CHECK (status IN ('confirmed', 'partial', 'rejected')),
  decided_at  TEXT NOT NULL,
  decided_by  TEXT NOT NULL,
  note        TEXT
);

-- What was actually accepted against each requested line.
CREATE TABLE IF NOT EXISTS decision_lines (
  request_id  TEXT NOT NULL REFERENCES decisions (request_id),
  item_key    TEXT NOT NULL,
  ret         INTEGER NOT NULL DEFAULT 0 CHECK (ret >= 0),
  iss         INTEGER NOT NULL DEFAULT 0 CHECK (iss >= 0),
  PRIMARY KEY (request_id, item_key)
);

CREATE TABLE IF NOT EXISTS ledger (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ts          TEXT NOT NULL,             -- ISO 8601, UTC
  item_key    TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('return', 'issue', 'standard')),
  centre_id   TEXT NOT NULL,

  qty         INTEGER,                   -- return / issue
  from_qty    INTEGER,                   -- standard (allocation) change
  to_qty      INTEGER,

  note        TEXT,
  recorded_by TEXT,
  request_id  TEXT REFERENCES requests (id),

  -- A movement carries a quantity and the request that authorised it.
  -- An allocation change carries the before and after instead.
  CHECK ((type IN ('return', 'issue') AND qty > 0 AND request_id IS NOT NULL)
      OR (type = 'standard' AND to_qty IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_ledger_centre   ON ledger (centre_id);
CREATE INDEX IF NOT EXISTS idx_ledger_request  ON ledger (request_id);
CREATE INDEX IF NOT EXISTS idx_requests_centre ON requests (centre_id);

-- ---------------------------------------------------------------------------
-- Append-only, enforced by the database.
-- ---------------------------------------------------------------------------

CREATE TRIGGER IF NOT EXISTS ledger_no_update BEFORE UPDATE ON ledger
BEGIN SELECT RAISE(ABORT, 'ledger is append-only: record a correction as a new entry'); END;
CREATE TRIGGER IF NOT EXISTS ledger_no_delete BEFORE DELETE ON ledger
BEGIN SELECT RAISE(ABORT, 'ledger is append-only: record a correction as a new entry'); END;

CREATE TRIGGER IF NOT EXISTS requests_no_update BEFORE UPDATE ON requests
BEGIN SELECT RAISE(ABORT, 'requests are append-only'); END;
CREATE TRIGGER IF NOT EXISTS requests_no_delete BEFORE DELETE ON requests
BEGIN SELECT RAISE(ABORT, 'requests are append-only'); END;

CREATE TRIGGER IF NOT EXISTS request_lines_no_update BEFORE UPDATE ON request_lines
BEGIN SELECT RAISE(ABORT, 'request lines are append-only'); END;
CREATE TRIGGER IF NOT EXISTS request_lines_no_delete BEFORE DELETE ON request_lines
BEGIN SELECT RAISE(ABORT, 'request lines are append-only'); END;

CREATE TRIGGER IF NOT EXISTS decisions_no_update BEFORE UPDATE ON decisions
BEGIN SELECT RAISE(ABORT, 'decisions are final'); END;
CREATE TRIGGER IF NOT EXISTS decisions_no_delete BEFORE DELETE ON decisions
BEGIN SELECT RAISE(ABORT, 'decisions are final'); END;

CREATE TRIGGER IF NOT EXISTS decision_lines_no_update BEFORE UPDATE ON decision_lines
BEGIN SELECT RAISE(ABORT, 'decisions are final'); END;
CREATE TRIGGER IF NOT EXISTS decision_lines_no_delete BEFORE DELETE ON decision_lines
BEGIN SELECT RAISE(ABORT, 'decisions are final'); END;
