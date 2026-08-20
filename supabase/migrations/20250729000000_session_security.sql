-- Session security: one-device-only and session tracking

-- 1. Add current_session_token to profiles for one-device-only enforcement
alter table public.profiles
  add column if not exists current_session_token text;

-- 2. Add index for fast session lookups
create index if not exists idx_profiles_current_session_token
  on public.profiles(current_session_token);

-- 3. Enable realtime for profiles so session invalidation is synced
alter publication supabase_realtime add table public.profiles;