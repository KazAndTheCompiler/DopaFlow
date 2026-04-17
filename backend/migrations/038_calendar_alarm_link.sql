-- Link alarms to calendar events so reminders are wired to appointments.
-- Deleting an event cascade-deletes its linked alarms.

ALTER TABLE alarms ADD COLUMN event_id TEXT REFERENCES calendar_events(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_alarms_event_id ON alarms(event_id);