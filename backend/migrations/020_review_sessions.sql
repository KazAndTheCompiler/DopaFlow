ALTER TABLE review_session_log ADD COLUMN status TEXT NOT NULL DEFAULT 'closed';
ALTER TABLE review_session_log ADD COLUMN started_at TEXT;
ALTER TABLE review_session_log ADD COLUMN ended_at TEXT;
ALTER TABLE review_session_log ADD COLUMN cards_seen INTEGER NOT NULL DEFAULT 0;
ALTER TABLE review_session_log ADD COLUMN cards_again INTEGER NOT NULL DEFAULT 0;
ALTER TABLE review_session_log ADD COLUMN cards_hard INTEGER NOT NULL DEFAULT 0;
ALTER TABLE review_session_log ADD COLUMN cards_good INTEGER NOT NULL DEFAULT 0;
ALTER TABLE review_session_log ADD COLUMN cards_easy INTEGER NOT NULL DEFAULT 0;
