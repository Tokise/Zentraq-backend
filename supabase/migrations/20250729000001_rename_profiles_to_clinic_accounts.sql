-- Rename profiles to clinic_accounts to separate clinic staff from students

-- 1. Rename the table
alter table if exists public.profiles rename to clinic_accounts;

-- 2. Rename the sequence if it exists
alter sequence if exists public.profiles_id_seq rename to clinic_accounts_id_seq;

-- 3. Update any foreign keys that reference profiles
-- (check for existing foreign keys and update them)
DO $$
BEGIN
  -- Update foreign key references in student_accounts if they exist
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'student_accounts'
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.student_accounts
      DROP CONSTRAINT IF EXISTS student_accounts_user_id_fkey;
    ALTER TABLE public.student_accounts
      ADD CONSTRAINT student_accounts_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE set null;
  END IF;
END $$;

-- 4. Rename policies
DO $$
BEGIN
  EXECUTE 'alter policy if exists "authenticated_select_profiles" on public.clinic_accounts rename to "authenticated_select_clinic_accounts"';
  EXECUTE 'alter policy if exists "authenticated_insert_profiles" on public.clinic_accounts rename to "authenticated_insert_clinic_accounts"';
  EXECUTE 'alter policy if exists "authenticated_update_profiles" on public.clinic_accounts rename to "authenticated_update_clinic_accounts"';
  EXECUTE 'alter policy if exists "authenticated_delete_profiles" on public.clinic_accounts rename to "authenticated_delete_clinic_accounts"';
  EXECUTE 'alter policy if exists "anon_select_profiles" on public.clinic_accounts rename to "anon_select_clinic_accounts"';
  EXECUTE 'alter policy if exists "anon_insert_profiles" on public.clinic_accounts rename to "anon_insert_clinic_accounts"';
EXCEPTION
  WHEN others THEN
    -- Policies might not exist, that's okay
    NULL;
END $$;