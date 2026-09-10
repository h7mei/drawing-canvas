-- drawing-canvas schema: agent workflow runs persisted in Postgres.
-- DB: drawing_canvas on 127.0.0.1:5433 (role: ai). Created 2026-09-06.
-- updated_at added 2026-09-07 for the render-gate sweep (stale 'rendering').
CREATE TABLE IF NOT EXISTS runs (
  id           TEXT PRIMARY KEY,              -- e.g. mby2q3f4a1b2c3d4e5f6
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  status       TEXT NOT NULL DEFAULT 'queued', -- queued | running | rendering | done | error
  note         TEXT NOT NULL DEFAULT '',       -- user's prompt for the run
  image_png    BYTEA NOT NULL,                 -- the drawing (agent-rendered once uploaded)
  error        TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS stages (
  run_id     TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  seq        INT  NOT NULL,                   -- 1-based order in the pipeline
  key        TEXT NOT NULL,                   -- draw | describe | critique | title | custom
  label      TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'queued',
  output     TEXT NOT NULL DEFAULT '',        -- draw: {"subject","count","strokes":[...]}
  ms         INT  NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  PRIMARY KEY (run_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_runs_created ON runs (created_at DESC);
