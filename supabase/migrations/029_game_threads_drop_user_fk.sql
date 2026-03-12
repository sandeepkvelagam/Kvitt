-- Drop FK constraint on game_threads.user_id so AI assistant can post messages
-- (group_messages.user_id has no FK, game_threads should match)
ALTER TABLE game_threads DROP CONSTRAINT IF EXISTS game_threads_user_id_fkey;
