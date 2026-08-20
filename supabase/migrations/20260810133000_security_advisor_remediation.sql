-- Removes permissive browser-write policies and hides RLS helper functions.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- Resolves the caller's clinic role without exposing underlying account rows.
create or replace function private.is_clinic_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.clinic_accounts account
    where account.user_id = (select auth.uid())
      and account.role in ('admin', 'doctor', 'nurse')
      and account.is_active = true
  );
$$;

-- Resolves whether the caller has the Admin clinic role.
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.clinic_accounts account
    where account.user_id = (select auth.uid())
      and account.role = 'admin'
      and account.is_active = true
  );
$$;

-- Resolves whether the caller has the Doctor clinic role.
create or replace function private.is_doctor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.clinic_accounts account
    where account.user_id = (select auth.uid())
      and account.role = 'doctor'
      and account.is_active = true
  );
$$;

-- Resolves whether the caller has the Nurse clinic role.
create or replace function private.is_nurse()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.clinic_accounts account
    where account.user_id = (select auth.uid())
      and account.role = 'nurse'
      and account.is_active = true
  );
$$;

-- Resolves the caller's Student profile without exposing other profiles.
create or replace function private.current_student_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select student.id
  from public.students student
  where student.user_id = (select auth.uid())
  limit 1;
$$;

-- Resolves the caller's Faculty profile without exposing other profiles.
create or replace function private.current_faculty_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select faculty.id
  from public.faculty faculty
  where faculty.user_id = (select auth.uid())
  limit 1;
$$;

-- Preserves the role-table Admin check used by announcement policies.
create or replace function private.is_current_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles user_role
    join public.roles role
      on role.id = user_role.role_id
    where user_role.user_id = (select auth.uid())
      and role.name = 'admin'
  );
$$;

revoke all on function private.is_clinic_staff() from public, anon;
revoke all on function private.is_admin() from public, anon;
revoke all on function private.is_doctor() from public, anon;
revoke all on function private.is_nurse() from public, anon;
revoke all on function private.current_student_id() from public, anon;
revoke all on function private.current_faculty_id() from public, anon;
revoke all on function private.is_current_admin() from public, anon;

grant execute on function private.is_clinic_staff() to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_doctor() to authenticated;
grant execute on function private.is_nurse() to authenticated;
grant execute on function private.current_student_id() to authenticated;
grant execute on function private.current_faculty_id() to authenticated;
grant execute on function private.is_current_admin() to authenticated;

-- Rewrites legacy public helper calls while preserving each policy expression.
create or replace function private.rewrite_policy_helper_calls(source text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  helper_name text;
  rewritten text := source;
begin
  if source is null then
    return null;
  end if;

  foreach helper_name in array array[
    'is_clinic_staff',
    'is_admin',
    'is_doctor',
    'is_nurse',
    'current_student_id',
    'current_faculty_id',
    'is_current_admin'
  ]
  loop
    rewritten := replace(
      rewritten,
      'private.' || helper_name || '()',
      '__zentraq_' || helper_name || '__'
    );
    rewritten := replace(
      rewritten,
      'public.' || helper_name || '()',
      '__zentraq_' || helper_name || '__'
    );
    rewritten := replace(
      rewritten,
      helper_name || '()',
      '(select private.' || helper_name || '())'
    );
    rewritten := replace(
      rewritten,
      '__zentraq_' || helper_name || '__',
      'private.' || helper_name || '()'
    );
  end loop;

  return rewritten;
end;
$$;

do $$
declare
  policy_row record;
  using_expression text;
  check_expression text;
  statement text;
begin
  for policy_row in
    select schemaname, tablename, policyname, qual, with_check
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and (
        coalesce(qual, '') ~
          '(is_clinic_staff|is_admin|is_doctor|is_nurse|current_student_id|current_faculty_id|is_current_admin)\(\)'
        or coalesce(with_check, '') ~
          '(is_clinic_staff|is_admin|is_doctor|is_nurse|current_student_id|current_faculty_id|is_current_admin)\(\)'
      )
  loop
    using_expression := private.rewrite_policy_helper_calls(policy_row.qual);
    check_expression := private.rewrite_policy_helper_calls(
      policy_row.with_check
    );
    statement := format(
      'alter policy %I on %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
    if using_expression is not null then
      statement := statement || format(' using (%s)', using_expression);
    end if;
    if check_expression is not null then
      statement := statement || format(' with check (%s)', check_expression);
    end if;
    execute statement;
  end loop;
end;
$$;

drop function private.rewrite_policy_helper_calls(text);

-- Server-only writes use the service role and do not need browser policies.
drop policy if exists "system_insert_ai_evaluations"
  on public.appointment_ai_evaluations;
drop policy if exists "system_insert_reminders"
  on public.appointment_reminders;
drop policy if exists "system_insert_checkins"
  on public.appointment_checkins;
drop policy if exists "system_insert_notifications"
  on public.notifications;
drop policy if exists "system_insert_audit_logs"
  on public.audit_logs;
drop policy if exists "system_insert_ai_logs"
  on public.ai_logs;
drop policy if exists "system_manage_sessions"
  on public.user_sessions;

revoke insert on public.appointment_ai_evaluations from anon, authenticated;
revoke insert on public.appointment_reminders from anon, authenticated;
revoke insert on public.appointment_checkins from anon, authenticated;
revoke insert on public.notifications from anon, authenticated;
revoke insert on public.audit_logs from anon, authenticated;
revoke insert on public.ai_logs from anon, authenticated;
revoke insert, update, delete on public.user_sessions from anon, authenticated;

-- Removes public RPC access after all policies reference private helpers.
do $$
declare
  function_signature text;
begin
  foreach function_signature in array array[
    'public.is_clinic_staff()',
    'public.is_admin()',
    'public.is_doctor()',
    'public.is_nurse()',
    'public.current_student_id()',
    'public.current_faculty_id()',
    'public.is_current_admin()'
  ]
  loop
    if pg_catalog.to_regprocedure(function_signature) is not null then
      execute format(
        'alter function %s set search_path = pg_catalog, public',
        function_signature
      );
      execute format(
        'revoke all on function %s from public, anon, authenticated',
        function_signature
      );
    end if;
  end loop;
end;
$$;

-- Trigger functions never need direct Data API execution privileges.
do $$
declare
  function_signature text;
begin
  foreach function_signature in array array[
    'public.trigger_notifications_updated_at()',
    'public.trigger_settings_updated_at()',
    'public.trigger_roles_updated_at()',
    'public.trigger_faculty_accounts_updated_at()',
    'public.trigger_services_updated_at()',
    'public.trigger_set_timestamp()',
    'public.decrement_stock()'
  ]
  loop
    if pg_catalog.to_regprocedure(function_signature) is not null then
      execute format(
        'alter function %s set search_path = pg_catalog, public',
        function_signature
      );
      execute format(
        'revoke all on function %s from public, anon, authenticated',
        function_signature
      );
    end if;
  end loop;
end;
$$;

-- The replaced legacy completion RPC is no longer part of the application API.
do $$
begin
  if pg_catalog.to_regprocedure(
    'public.complete_consultation(uuid)'
  ) is not null then
    revoke all on function public.complete_consultation(uuid)
      from public, anon, authenticated;
  end if;
end;
$$;
