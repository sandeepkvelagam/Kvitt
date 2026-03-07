-- Fix: group_members table missing 'status' column
-- websocket_manager.py checks membership.get('status') != 'active'
-- but the column never existed, causing ALL websocket joins to fail

ALTER TABLE group_members ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
