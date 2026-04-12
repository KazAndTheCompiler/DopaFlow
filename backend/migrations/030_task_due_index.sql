CREATE INDEX IF NOT EXISTS idx_tasks_due_active ON tasks(due_at) WHERE done = 0;
