-- ===========================================================================
-- D1 schema for the periodontic instrument register.
--
-- The ledger is APPEND-ONLY. There is no UPDATE and no DELETE anywhere in
-- the Worker, and none should be added: this is a procurement record, and a
-- correction is a new row, not an edit to an old one.
--
-- `codes` and `standards` are the two places a current value is kept rather
-- than derived, and both are mirrors of the ledger, not the source of truth:
-- the ledger can always rebuild them. They exist so the register loads in
-- one query instead of replaying every event.
--
--   wrangler d1 execute moh-instruments --file=server/schema.sql --remote
-- ===========================================================================

CREATE TABLE IF NOT EXISTS codes (
  item_key    TEXT PRIMARY KEY,          -- "surgical:11"
  code        TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  updated_by  TEXT
);

CREATE TABLE IF NOT EXISTS standards (
  item_key    TEXT PRIMARY KEY,
  qty         INTEGER NOT NULL,
  updated_at  TEXT NOT NULL,
  updated_by  TEXT
);

CREATE TABLE IF NOT EXISTS ledger (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ts          TEXT NOT NULL,             -- ISO 8601, UTC
  item_key    TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('return', 'issue', 'standard')),

  qty         INTEGER,                   -- return / issue
  from_qty    INTEGER,                   -- standard change
  to_qty      INTEGER,                   -- standard change

  note        TEXT,
  recorded_by TEXT,

  -- 'global' events apply to every clinic; 'clinic' events belong to one.
  scope       TEXT NOT NULL CHECK (scope IN ('global', 'clinic')),
  clinic_key  TEXT,                      -- "al-amiri dental centre|04"
  centre_name TEXT,                      -- as typed, for display
  clinic_no   TEXT,

  -- A clinic event must name its clinic; a global one must not.
  CHECK ((scope = 'clinic' AND clinic_key IS NOT NULL)
      OR (scope = 'global' AND clinic_key IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_ledger_item   ON ledger (item_key);
CREATE INDEX IF NOT EXISTS idx_ledger_clinic ON ledger (clinic_key);
CREATE INDEX IF NOT EXISTS idx_ledger_ts     ON ledger (ts DESC);

-- Clinics are not a table of their own on purpose: a clinic exists exactly
-- when it has recorded something. This view keeps the display name from the
-- most recent entry, so renaming a centre does not orphan its history.
CREATE VIEW IF NOT EXISTS clinics AS
SELECT
  clinic_key                      AS key,
  MAX(ts)                         AS last_seen,
  COUNT(*)                        AS entries
FROM ledger
WHERE scope = 'clinic'
GROUP BY clinic_key;
