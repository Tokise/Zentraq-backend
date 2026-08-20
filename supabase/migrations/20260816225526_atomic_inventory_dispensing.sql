-- Atomically validates, records, and applies one idempotent medicine dispense.
create or replace function public.dispense_medicine_v1(
  requested_by uuid,
  requested_prescription_id uuid,
  requested_stock_id uuid,
  requested_quantity integer,
  requested_idempotency_key uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing_log public.dispensing_logs%rowtype;
  prescription_medicine_id uuid;
  prescription_status text;
  stock_medicine_id uuid;
  stock_quantity integer;
  resulting_stock_quantity integer;
begin
  if requested_by is null
    or requested_prescription_id is null
    or requested_stock_id is null
    or requested_idempotency_key is null
    or requested_quantity is null
    or requested_quantity <= 0 then
    raise exception 'INVALID_DISPENSING_REQUEST';
  end if;

  -- Serialize retries that use the same idempotency key before checking state.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(requested_idempotency_key::text, 0)
  );

  select log.*
  into existing_log
  from public.dispensing_logs as log
  where log.id = requested_idempotency_key;

  if existing_log.id is not null then
    if existing_log.prescription_id = requested_prescription_id
      and existing_log.medicine_stock_id = requested_stock_id
      and existing_log.dispensed_by = requested_by
      and existing_log.quantity = requested_quantity then
      return existing_log.id;
    end if;

    raise exception 'DISPENSING_IDEMPOTENCY_CONFLICT';
  end if;

  if not exists (
    select 1
    from public.user_roles as assignment
    join public.roles as role on role.id = assignment.role_id
    join public.clinic_accounts as account
      on account.user_id = assignment.user_id
      and account.role = role.name
      and account.is_active = true
    where assignment.user_id = requested_by
      and role.name in ('admin', 'nurse')
  ) then
    raise exception 'INVENTORY_AUTHORIZATION_REQUIRED';
  end if;

  select prescription.medicine_id, prescription.status
  into prescription_medicine_id, prescription_status
  from public.prescriptions as prescription
  where prescription.id = requested_prescription_id
  for update;

  if prescription_medicine_id is null then
    raise exception 'PRESCRIPTION_NOT_FOUND';
  end if;

  if prescription_status <> 'pending' then
    raise exception 'INVALID_PRESCRIPTION_STATE';
  end if;

  select stock.medicine_id, stock.quantity
  into stock_medicine_id, stock_quantity
  from public.medicine_stock as stock
  where stock.id = requested_stock_id
  for update;

  if stock_medicine_id is null then
    raise exception 'STOCK_NOT_FOUND';
  end if;

  if stock_medicine_id <> prescription_medicine_id then
    raise exception 'STOCK_MEDICINE_MISMATCH';
  end if;

  if stock_quantity < requested_quantity then
    raise exception 'INSUFFICIENT_STOCK';
  end if;

  insert into public.dispensing_logs (
    id,
    prescription_id,
    medicine_stock_id,
    dispensed_by,
    quantity
  )
  values (
    requested_idempotency_key,
    requested_prescription_id,
    requested_stock_id,
    requested_by,
    requested_quantity
  );

  select stock.quantity
  into resulting_stock_quantity
  from public.medicine_stock as stock
  where stock.id = requested_stock_id;

  -- Preserve an existing decrement trigger, but fail safely if it is absent.
  if resulting_stock_quantity = stock_quantity then
    update public.medicine_stock
    set quantity = quantity - requested_quantity,
        updated_at = now()
    where id = requested_stock_id;
  elsif resulting_stock_quantity <> stock_quantity - requested_quantity then
    raise exception 'STOCK_MUTATION_INVARIANT_FAILED';
  end if;

  update public.prescriptions
  set status = 'dispensed',
      updated_at = now()
  where id = requested_prescription_id;

  return requested_idempotency_key;
end;
$$;

revoke all on function public.dispense_medicine_v1(
  uuid,
  uuid,
  uuid,
  integer,
  uuid
) from public, anon, authenticated;

grant execute on function public.dispense_medicine_v1(
  uuid,
  uuid,
  uuid,
  integer,
  uuid
) to service_role;

comment on function public.dispense_medicine_v1(
  uuid,
  uuid,
  uuid,
  integer,
  uuid
) is
  'Atomically performs one authorized idempotent medicine dispense for Inventory Service.';
