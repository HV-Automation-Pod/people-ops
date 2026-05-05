-- ============================================================================
-- People Ops — Gratuity template attachments
--
-- Adds a default_attachments JSONB column to gratuity_templates so each
-- template (initial + reminder_1/2/3) can carry standard files that are
-- automatically included when that message_type is dispatched.
--
-- Files themselves are stored in a private Supabase Storage bucket.
-- Server reads via service-role key; never exposed to the client directly.
-- ============================================================================

-- 1. Column — list of { id, name, mime_type, size, storage_path, uploaded_by, uploaded_at }
alter table gratuity_templates
  add column if not exists default_attachments jsonb not null default '[]';

-- 2. Storage bucket (private — only service role reads/writes)
insert into storage.buckets (id, name, public)
values ('gratuity-template-attachments', 'gratuity-template-attachments', false)
on conflict (id) do nothing;

-- Note: we deliberately do not create storage RLS policies.
-- Service role bypasses RLS, and only our API routes (which run with
-- service-role key) ever read or write this bucket. Client-side code never
-- touches Storage directly.
