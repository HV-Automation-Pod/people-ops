-- ============================================================================
-- People Ops — Gratuity Form F Dispatch (v1)
--
-- Additive migration on top of 001_platform_schema.sql. Idempotent.
-- See: docs/superpowers/specs/2026-04-21-gratuity-form-f-design.md
-- ============================================================================

-- ============================================================================
-- 1. USER_PROFILES — per-user Slack tokens
-- ============================================================================
-- Tokens are per-user secrets. They are NEVER returned in a list query.
-- API routes must not `select('*')` on user_profiles — use an explicit
-- column list that excludes these two columns, except:
--   - /api/profile GET for the owner (returns them masked)
--   - /api/gratuity/send, /remind service-role reads for auth.uid()
alter table user_profiles add column if not exists slack_bot_token  text;
alter table user_profiles add column if not exists slack_user_token text;

-- ============================================================================
-- 2. GRATUITY_DISPATCHES — one row per (employee, form_type)
-- ============================================================================
create table if not exists gratuity_dispatches (
  id              uuid primary key default gen_random_uuid(),
  employee_id     uuid not null references employees(id) on delete cascade,
  form_type       text not null default 'F' check (form_type in ('F','I','J','K')),
  status          text not null default 'pending' check (status in ('pending','completed')),
  completed_at    timestamptz,
  completed_by    uuid references user_profiles(id) on delete set null,
  completed_note  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint uq_gratuity_employee_form unique (employee_id, form_type)
);

create index if not exists idx_gratuity_dispatches_status
  on gratuity_dispatches (status);
create index if not exists idx_gratuity_dispatches_employee
  on gratuity_dispatches (employee_id);
create index if not exists idx_gratuity_dispatches_created
  on gratuity_dispatches (created_at desc);

-- ============================================================================
-- 3. GRATUITY_MESSAGES — one row per Slack send (initial + up to 3 reminders)
-- ============================================================================
create table if not exists gratuity_messages (
  id             uuid primary key default gen_random_uuid(),
  dispatch_id    uuid not null references gratuity_dispatches(id) on delete cascade,
  message_type   text not null check (message_type in ('initial','reminder_1','reminder_2','reminder_3')),
  sent_by        uuid references user_profiles(id) on delete set null,
  slack_channel  text,   -- DM channel id from conversations.open
  slack_ts       text,   -- Slack message timestamp from chat.postMessage
  message_text   text not null,
  attachments    jsonb not null default '[]',
  error          text,
  sent_at        timestamptz not null default now(),
  constraint uq_gratuity_message_type unique (dispatch_id, message_type)
);

create index if not exists idx_gratuity_messages_dispatch
  on gratuity_messages (dispatch_id);
create index if not exists idx_gratuity_messages_sent_at
  on gratuity_messages (sent_at desc);

-- ============================================================================
-- 4. GRATUITY_TEMPLATES — editable message templates
-- ============================================================================
create table if not exists gratuity_templates (
  id             uuid primary key default gen_random_uuid(),
  form_type      text not null check (form_type in ('F','I','J','K')),
  template_key   text not null check (template_key in ('initial','reminder_1','reminder_2','reminder_3')),
  body           text not null default '',
  updated_by     uuid references user_profiles(id) on delete set null,
  updated_at     timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  constraint uq_gratuity_template unique (form_type, template_key)
);

-- Seed empty templates for Form F (HR fills on first use)
insert into gratuity_templates (form_type, template_key, body) values
  ('F', 'initial',    ''),
  ('F', 'reminder_1', ''),
  ('F', 'reminder_2', ''),
  ('F', 'reminder_3', '')
on conflict (form_type, template_key) do nothing;

-- ============================================================================
-- 5. TRIGGERS
-- ============================================================================
drop trigger if exists trg_gratuity_dispatches_updated on gratuity_dispatches;
create trigger trg_gratuity_dispatches_updated
  before update on gratuity_dispatches
  for each row execute function update_updated_at();

drop trigger if exists trg_gratuity_templates_updated on gratuity_templates;
create trigger trg_gratuity_templates_updated
  before update on gratuity_templates
  for each row execute function update_updated_at();

-- ============================================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================================
alter table gratuity_dispatches  enable row level security;
alter table gratuity_messages    enable row level security;
alter table gratuity_templates   enable row level security;

do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('gratuity_dispatches','gratuity_messages','gratuity_templates')
  loop
    execute format('drop policy if exists %I on %I.%I',
                   r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- Read: authenticated users (API enforces gratuity-access filter on top)
create policy "auth_read_gratuity_dispatches" on gratuity_dispatches
  for select to authenticated using (true);
create policy "auth_read_gratuity_messages"   on gratuity_messages
  for select to authenticated using (true);
create policy "auth_read_gratuity_templates"  on gratuity_templates
  for select to authenticated using (true);

-- Service role: full access
create policy "service_all_gratuity_dispatches" on gratuity_dispatches
  for all to service_role using (true);
create policy "service_all_gratuity_messages"   on gratuity_messages
  for all to service_role using (true);
create policy "service_all_gratuity_templates"  on gratuity_templates
  for all to service_role using (true);
