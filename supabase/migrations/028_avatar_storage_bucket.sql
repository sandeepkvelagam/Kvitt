-- 028_avatar_storage_bucket.sql
-- Create a public storage bucket for user avatar images.
-- Backend uploads via service role key; images are publicly readable.

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;
