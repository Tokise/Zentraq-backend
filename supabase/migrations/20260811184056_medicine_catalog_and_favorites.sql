-- Adds an approval-aware medicine catalog and doctor-owned prescribing favorites.

set lock_timeout = '5s';
set statement_timeout = '30s';

create schema if not exists private;

alter table public.medicines
  add column if not exists approval_status text not null default 'approved',
  add column if not exists created_by uuid
    references public.users(id) on delete set null,
  add column if not exists approved_by uuid
    references public.users(id) on delete set null,
  add column if not exists approved_at timestamptz;

alter table public.medicines
  drop constraint if exists medicines_approval_status_check;
alter table public.medicines
  add constraint medicines_approval_status_check check (
    approval_status in ('pending', 'approved', 'rejected')
  );

update public.medicines
set
  approval_status = 'approved',
  approved_at = coalesce(approved_at, created_at, now())
where approval_status is null or approval_status = 'approved';

create index if not exists medicines_catalog_status_idx
  on public.medicines (
    approval_status,
    is_active,
    lower(btrim(generic_name))
  );

-- Prevents new normalized duplicates without deleting legacy catalog rows.
create or replace function private.prevent_active_medicine_duplicate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_active and exists (
    select 1
    from public.medicines medicine
    where medicine.id <> coalesce(new.id, gen_random_uuid())
      and medicine.is_active
      and lower(btrim(medicine.generic_name)) = lower(btrim(new.generic_name))
      and lower(btrim(coalesce(medicine.brand_name, ''))) =
        lower(btrim(coalesce(new.brand_name, '')))
      and lower(btrim(medicine.unit)) = lower(btrim(new.unit))
  ) then
    raise exception 'An active medicine with the same name, brand, and unit exists';
  end if;

  return new;
end;
$$;

revoke all on function private.prevent_active_medicine_duplicate()
  from public, anon, authenticated, service_role;

drop trigger if exists prevent_active_medicine_duplicate
  on public.medicines;
create trigger prevent_active_medicine_duplicate
before insert or update of generic_name, brand_name, unit, is_active
on public.medicines
for each row
execute function private.prevent_active_medicine_duplicate();

create table if not exists public.doctor_prescription_favorites (
  id uuid primary key default gen_random_uuid(),
  doctor_clinic_account_id uuid not null
    references public.clinic_accounts(id) on delete cascade,
  medicine_id uuid not null
    references public.medicines(id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 80),
  dosage text check (dosage is null or char_length(dosage) <= 100),
  frequency text check (frequency is null or char_length(frequency) <= 100),
  duration_days integer check (duration_days between 1 and 365),
  quantity integer check (quantity between 1 and 1000),
  instructions text check (
    instructions is null or char_length(instructions) <= 1000
  ),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (doctor_clinic_account_id, label)
);

create index if not exists doctor_prescription_favorites_owner_idx
  on public.doctor_prescription_favorites (
    doctor_clinic_account_id,
    is_active,
    updated_at desc
  );

alter table public.doctor_prescription_favorites enable row level security;

revoke all on table public.doctor_prescription_favorites
  from public, anon, authenticated;
grant select, insert, update, delete
  on table public.doctor_prescription_favorites to authenticated;
grant all on table public.doctor_prescription_favorites to service_role;

drop policy if exists "Doctors manage their prescription favorites"
  on public.doctor_prescription_favorites;
create policy "Doctors manage their prescription favorites"
on public.doctor_prescription_favorites
for all
to authenticated
using (
  exists (
    select 1
    from public.clinic_accounts account
    join public.user_roles user_role
      on user_role.user_id = account.user_id
    join public.roles role
      on role.id = user_role.role_id
    where account.id = doctor_clinic_account_id
      and account.user_id = (select auth.uid())
      and account.is_active
      and account.role = 'doctor'
      and role.name = 'doctor'
  )
)
with check (
  exists (
    select 1
    from public.clinic_accounts account
    join public.user_roles user_role
      on user_role.user_id = account.user_id
    join public.roles role
      on role.id = user_role.role_id
    where account.id = doctor_clinic_account_id
      and account.user_id = (select auth.uid())
      and account.is_active
      and account.role = 'doctor'
      and role.name = 'doctor'
  )
);

-- Saves one catalog item and derives approval state from the canonical role.
create or replace function public.save_medicine_catalog_item(
  requested_id uuid,
  requested_generic_name text,
  requested_brand_name text,
  requested_category text,
  requested_unit text,
  requested_min_stock_level integer,
  requested_is_controlled boolean,
  requested_is_active boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role text;
  v_existing_is_controlled boolean;
  v_medicine_id uuid;
  v_approval_status text;
begin
  select role.name
  into v_actor_role
  from public.user_roles user_role
  join public.roles role on role.id = user_role.role_id
  join public.clinic_accounts account
    on account.user_id = user_role.user_id
   and account.role = role.name
   and account.is_active
  where user_role.user_id = v_actor_id
    and role.name in ('admin', 'nurse')
  limit 1;

  if v_actor_id is null or v_actor_role is null then
    raise exception 'Active Admin or Nurse account is required';
  end if;

  if nullif(btrim(requested_generic_name), '') is null
    or char_length(btrim(requested_generic_name)) > 200
    or nullif(btrim(requested_unit), '') is null
    or char_length(btrim(requested_unit)) > 50
    or char_length(btrim(coalesce(requested_brand_name, ''))) > 200
    or char_length(btrim(coalesce(requested_category, ''))) > 100
    or requested_min_stock_level not between 0 and 100000 then
    raise exception 'Invalid medicine catalog values';
  end if;

  v_approval_status := case
    when v_actor_role = 'admin' then 'approved'
    when requested_is_controlled then 'pending'
    else 'approved'
  end;

  if requested_id is null then
    insert into public.medicines (
      generic_name,
      brand_name,
      category,
      unit,
      min_stock_level,
      is_controlled,
      is_active,
      approval_status,
      created_by,
      approved_by,
      approved_at
    )
    values (
      btrim(requested_generic_name),
      nullif(btrim(requested_brand_name), ''),
      nullif(btrim(requested_category), ''),
      btrim(requested_unit),
      requested_min_stock_level,
      requested_is_controlled,
      requested_is_active,
      v_approval_status,
      v_actor_id,
      case when v_approval_status = 'approved' then v_actor_id end,
      case when v_approval_status = 'approved' then now() end
    )
    returning id into v_medicine_id;
  else
    select medicine.is_controlled
    into v_existing_is_controlled
    from public.medicines medicine
    where medicine.id = requested_id
    for update;

    if v_existing_is_controlled is null then
      raise exception 'Medicine not found';
    end if;

    if v_actor_role = 'nurse'
      and v_existing_is_controlled
      and not requested_is_controlled then
      raise exception 'Admin approval is required to change controlled status';
    end if;

    update public.medicines
    set
      generic_name = btrim(requested_generic_name),
      brand_name = nullif(btrim(requested_brand_name), ''),
      category = nullif(btrim(requested_category), ''),
      unit = btrim(requested_unit),
      min_stock_level = requested_min_stock_level,
      is_controlled = requested_is_controlled,
      is_active = requested_is_active,
      approval_status = v_approval_status,
      approved_by = case
        when v_approval_status = 'approved' then v_actor_id
        else null
      end,
      approved_at = case
        when v_approval_status = 'approved' then now()
        else null
      end,
      updated_at = now()
    where id = requested_id
    returning id into v_medicine_id;
  end if;

  insert into public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_id,
    'inventory.medicine_catalog_saved',
    'medicine',
    v_medicine_id,
    jsonb_build_object(
      'approval_status', v_approval_status,
      'controlled', requested_is_controlled,
      'clinician_role', v_actor_role
    )
  );

  return v_medicine_id;
end;
$$;

-- Approves or rejects a controlled medicine submission as an Admin.
create or replace function public.review_medicine_catalog_item(
  requested_id uuid,
  requested_approved boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
begin
  if not exists (
    select 1
    from public.user_roles user_role
    join public.roles role on role.id = user_role.role_id
    join public.clinic_accounts account
      on account.user_id = user_role.user_id
     and account.role = role.name
     and account.is_active
    where user_role.user_id = v_actor_id
      and role.name = 'admin'
  ) then
    raise exception 'Active Admin account is required';
  end if;

  update public.medicines
  set
    approval_status = case
      when requested_approved then 'approved'
      else 'rejected'
    end,
    is_active = case when requested_approved then is_active else false end,
    approved_by = v_actor_id,
    approved_at = now(),
    updated_at = now()
  where id = requested_id
    and is_controlled
    and approval_status = 'pending';

  if not found then
    raise exception 'Pending controlled medicine not found';
  end if;

  insert into public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_actor_id,
    'inventory.medicine_catalog_reviewed',
    'medicine',
    requested_id,
    jsonb_build_object('approved', requested_approved)
  );
end;
$$;

revoke all on function public.save_medicine_catalog_item(
  uuid, text, text, text, text, integer, boolean, boolean
) from public, anon, service_role;
grant execute on function public.save_medicine_catalog_item(
  uuid, text, text, text, text, integer, boolean, boolean
) to authenticated;

revoke all on function public.review_medicine_catalog_item(uuid, boolean)
  from public, anon, service_role;
grant execute on function public.review_medicine_catalog_item(uuid, boolean)
  to authenticated;
