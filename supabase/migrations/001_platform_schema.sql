-- ============================================================================
-- People Ops — Platform Schema (consolidated)
--
-- Idempotent: safe to run against a fresh Supabase OR one that already has
-- the RBAC tables (user_profiles, automations, access_requests).
--
-- Design notes:
--   * `automations` = per-user grants (user_id, automation_id, granted_by,
--      granted_at). `automation_id` is free-form text matching the hardcoded
--      automation keys in the frontend ("gratuity", "onboarding", …).
--   * PII-free employees table — Aadhaar / PAN / UAN / addresses / DOB /
--      personal contact are NOT stored. The sync code strips these before
--      writing to `zoho_raw`.
--   * `audit_events` is cross-automation so every workflow appends to a
--      single unified timeline.
--   * Employee exits are detected by diffing each Zoho sync against DB state.
-- ============================================================================

create extension if not exists "pgcrypto";

-- Safety rename for environments that still have the old `automation_access`
-- table name. No-op once already renamed.
do $$ begin
  if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'automation_access'
    ) and not exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'automations'
    ) then
    execute 'alter table automation_access rename to automations';
  end if;
end $$;

-- ============================================================================
-- HELPERS
-- ============================================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================================
-- 1. RBAC — user_profiles, automations, access_requests
--    (preserved if the tables already exist)
-- ============================================================================
create table if not exists user_profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  name        text not null default '',
  role        text not null default 'member'
                check (role in ('admin', 'hr_manager', 'hr_ops', 'member')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint uq_user_profiles_email unique (email)
);
create index if not exists idx_user_profiles_role  on user_profiles (role);
create index if not exists idx_user_profiles_email on user_profiles (email);

-- Per-user automation grants. (Was `automation_access` in earlier migrations.)
create table if not exists automations (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references user_profiles(id) on delete cascade,
  automation_id  text not null,
  granted_by     uuid references user_profiles(id) on delete set null,
  granted_at     timestamptz not null default now(),
  constraint uq_automation_access unique (user_id, automation_id)
);
create index if not exists idx_auto_access_user       on automations (user_id);
create index if not exists idx_auto_access_automation on automations (automation_id);

create table if not exists access_requests (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references user_profiles(id) on delete cascade,
  automation_id  text not null,
  reason         text not null default '',
  status         text not null default 'pending'
                   check (status in ('pending', 'approved', 'declined')),
  reviewed_by    uuid references user_profiles(id) on delete set null,
  reviewed_at    timestamptz,
  review_note    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_access_req_status on access_requests (status) where status = 'pending';
create index if not exists idx_access_req_user   on access_requests (user_id);

-- ============================================================================
-- 2. EMPLOYEES — core, PII-free, shared across all automations
-- ============================================================================
create table if not exists employees (
  id                       uuid primary key default gen_random_uuid(),

  -- Identity (from Zoho — emp_id is alphanumeric: "497", "INT380", "340C")
  emp_id                   text not null,
  email                    text not null,

  -- Name
  first_name               text not null,
  last_name                text not null default '',
  nick_name                text,

  -- Org
  department               text not null default '',
  business_unit            text not null default '',
  designation              text not null default '',
  employment_type          text not null default 'FT'
                              check (employment_type in ('FT','Contract','Intern')),
  location                 text not null default '',
  seating_location         text,

  -- Reporting
  reporting_manager_email  text,
  manager_id               uuid references employees(id) on delete set null,

  -- Lifecycle
  date_of_joining          date not null,
  date_of_exit             date,
  onboarding_status        text,
  status                   text not null default 'active'
                              check (status in ('active','exited','deceased')),

  -- Integrations
  slack_user_id            text,

  -- Non-sensitive raw payload. Sync code strips PII before writing here.
  zoho_raw                 jsonb not null default '{}',

  -- Sync
  last_synced_at           timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  constraint uq_employees_emp_id unique (emp_id),
  constraint uq_employees_email  unique (email)
);

create index if not exists idx_employees_status      on employees (status);
create index if not exists idx_employees_active_doj  on employees (status, date_of_joining)
  where status = 'active';
create index if not exists idx_employees_department  on employees (department);
create index if not exists idx_employees_manager     on employees (manager_id)
  where manager_id is not null;
create index if not exists idx_employees_emp_type    on employees (employment_type);
create index if not exists idx_employees_email       on employees (email);
create index if not exists idx_employees_emp_id      on employees (emp_id);
create index if not exists idx_employees_slack       on employees (slack_user_id)
  where slack_user_id is not null;

-- ============================================================================
-- 3. FORM DISPATCHES — gratuity workflow
-- ============================================================================
create table if not exists form_dispatches (
  id                 uuid primary key default gen_random_uuid(),
  employee_id        uuid not null references employees(id) on delete cascade,
  automation_id      text not null default 'gratuity',
  form_type          text not null check (form_type in ('F','I','J','K')),

  triggered_by       text not null default 'auto' check (triggered_by in ('auto','manual')),
  trigger_reason     text not null default '',

  sent_via           text not null default 'slack' check (sent_via in ('slack','email','manual')),
  slack_message_ts   text,
  form_response_url  text,

  status             text not null default 'pending'
                        check (status in ('pending','sent','acknowledged','submitted','filed','overdue')),

  sent_at            timestamptz,
  acknowledged_at    timestamptz,
  submitted_at       timestamptz,
  filed_at           timestamptz,
  filed_by           uuid references user_profiles(id) on delete set null,

  reminder_count     int not null default 0,
  last_reminder_at   timestamptz,
  next_reminder_at   timestamptz,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_dispatches_employee   on form_dispatches (employee_id);
create index if not exists idx_dispatches_status     on form_dispatches (status, form_type)
  where status in ('pending','sent','acknowledged','overdue');
create index if not exists idx_dispatches_reminders  on form_dispatches (next_reminder_at)
  where next_reminder_at is not null and status in ('sent','acknowledged');
create index if not exists idx_dispatches_created    on form_dispatches (created_at desc);

-- ============================================================================
-- 4. NOMINATIONS — Form F
-- ============================================================================
create table if not exists nominations (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid not null references employees(id) on delete cascade,
  is_active      boolean not null default true,
  nominees       jsonb not null default '[]',
  submitted_at   timestamptz not null default now(),
  form_file_url  text,
  created_at     timestamptz not null default now()
);

create unique index if not exists uq_nominations_active
  on nominations (employee_id) where is_active = true;
create index if not exists idx_nominations_employee on nominations (employee_id);

-- ============================================================================
-- 5. AUDIT EVENTS — cross-automation timeline
-- ============================================================================
create table if not exists audit_events (
  id              uuid primary key default gen_random_uuid(),
  automation_id   text,
  action          text not null,
  actor_id        uuid references user_profiles(id) on delete set null,
  employee_id     uuid references employees(id) on delete set null,
  dispatch_id     uuid references form_dispatches(id) on delete set null,
  details         jsonb not null default '{}',
  created_at      timestamptz not null default now()
);

create index if not exists idx_audit_created    on audit_events (created_at desc);
create index if not exists idx_audit_automation on audit_events (automation_id, created_at desc)
  where automation_id is not null;
create index if not exists idx_audit_employee   on audit_events (employee_id)
  where employee_id is not null;
create index if not exists idx_audit_action     on audit_events (action);

-- ============================================================================
-- 6. TRIGGERS — updated_at maintenance
-- ============================================================================
drop trigger if exists trg_user_profiles_updated    on user_profiles;
create trigger trg_user_profiles_updated
  before update on user_profiles
  for each row execute function update_updated_at();

drop trigger if exists trg_access_requests_updated  on access_requests;
create trigger trg_access_requests_updated
  before update on access_requests
  for each row execute function update_updated_at();

drop trigger if exists trg_employees_updated        on employees;
create trigger trg_employees_updated
  before update on employees
  for each row execute function update_updated_at();

drop trigger if exists trg_dispatches_updated       on form_dispatches;
create trigger trg_dispatches_updated
  before update on form_dispatches
  for each row execute function update_updated_at();

-- ============================================================================
-- 7. ROW LEVEL SECURITY
-- ============================================================================
alter table user_profiles     enable row level security;
alter table automations       enable row level security;
alter table access_requests   enable row level security;
alter table employees         enable row level security;
alter table form_dispatches   enable row level security;
alter table nominations       enable row level security;
alter table audit_events      enable row level security;

-- Drop any pre-existing policies on these tables so re-running is clean
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'user_profiles','automations','access_requests',
        'employees','form_dispatches','nominations','audit_events'
      )
  loop
    execute format('drop policy if exists %I on %I.%I',
                   r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- Shared reference data readable by all authenticated users
create policy "auth_read_employees"   on employees       for select to authenticated using (true);
create policy "auth_read_dispatches"  on form_dispatches for select to authenticated using (true);
create policy "auth_read_nominations" on nominations     for select to authenticated using (true);
create policy "auth_read_audit"       on audit_events    for select to authenticated using (true);

-- Self-read on RBAC
create policy "users_read_own_profile"  on user_profiles
  for select to authenticated using (id = auth.uid());
create policy "users_read_own_access"   on automations
  for select to authenticated using (user_id = auth.uid());
create policy "users_read_own_requests" on access_requests
  for select to authenticated using (user_id = auth.uid());

-- Admin-read on RBAC
create policy "admins_read_all_profiles" on user_profiles
  for select to authenticated using (
    exists (select 1 from user_profiles p where p.id = auth.uid() and p.role = 'admin')
  );
create policy "admins_read_all_access"   on automations
  for select to authenticated using (
    exists (select 1 from user_profiles p where p.id = auth.uid() and p.role = 'admin')
  );
create policy "admins_read_all_requests" on access_requests
  for select to authenticated using (
    exists (select 1 from user_profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Service role has full access everywhere
create policy "service_all_profiles"     on user_profiles     for all to service_role using (true);
create policy "service_all_automations"  on automations       for all to service_role using (true);
create policy "service_all_requests"     on access_requests   for all to service_role using (true);
create policy "service_all_employees"    on employees         for all to service_role using (true);
create policy "service_all_dispatches"   on form_dispatches   for all to service_role using (true);
create policy "service_all_nominations"  on nominations       for all to service_role using (true);
create policy "service_all_audit"        on audit_events      for all to service_role using (true);
