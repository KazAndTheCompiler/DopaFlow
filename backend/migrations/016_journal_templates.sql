CREATE TABLE IF NOT EXISTS journal_templates (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    body       TEXT NOT NULL DEFAULT '',
    tags       TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO journal_templates (id, name, body, tags) VALUES
  ('tpl_morning', 'Morning Pages',
   '## How I feel today\n\n## One thing I am grateful for\n\n## Today''s intention\n',
   '["morning","reflection"]'),
  ('tpl_evening', 'Evening Review',
   '## What went well\n\n## What I would do differently\n\n## Tomorrow''s priority\n',
   '["evening","review"]'),
  ('tpl_adhd', 'ADHD Reset',
   '## Current body state\n\n## Brain dump (unfiltered)\n\n## One small next step\n',
   '["adhd","reset"]');
