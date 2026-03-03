-- Migration 014: Auth user trigger
-- Auto-create public.users when a new auth.users record is inserted.
-- This eliminates the race condition where the frontend makes an API call
-- before the backend has auto-created the user record.
--
-- NOTE: This migration must be applied via the Supabase Dashboard SQL editor
-- (using the postgres/superuser connection) because it touches auth.users
-- which is outside the kvitt_backend role's scope.

CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.users (
    user_id,
    supabase_id,
    email,
    name,
    picture,
    created_at,
    updated_at
  )
  VALUES (
    'user_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
    NEW.id::text,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    NOW(),
    NOW()
  )
  ON CONFLICT (supabase_id) DO NOTHING; -- idempotent: safe to re-run
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();
