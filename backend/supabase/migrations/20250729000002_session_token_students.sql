-- Add session token support for student accounts

-- Add current_session_token to student_accounts for one-device-only enforcement
alter table public.student_accounts
  add column if not exists current_session_token text;

-- Add index for fast session lookups
create index if not exists idx_student_accounts_current_session_token
  on public.student_accounts(current_session_token);

-- Enable realtime for student_accounts so session invalidation is synced
alter publication supabase_realtime add table public.student_accounts;