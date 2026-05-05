# Gratuity Form F Dispatch — Design Spec (v1)

**Status:** Draft pending approval
**Date:** 2026-04-21
**Scope:** Form F (Nomination Form) dispatch only. Forms I, J, K deferred to a follow-up spec using the same pattern.

---

## 1. Problem

HyperVerge has 366+ active employees. Indian gratuity law (Payment of Gratuity Act, 1972) requires a signed Form F nomination from every employee after 1 year of service. Today HR Ops tracks anniversaries manually, chases signatures over email, and files the signed PDFs in Employee Personal Files (EPF). Things slip.

We're building a tool that lets HR Ops **send Form F dispatches via Slack DMs** (sent from the HR user's own Slack account, not a bot), **send up to three reminders**, and **mark dispatches complete** once the signed form is collected and filed. No employee-facing data collection; we're a workflow console for HR, not a form-submission platform.

## 2. Non-goals (v1)

- Automatic triggers / cron dispatching
- Employee-facing form submission UI
- Storage of signed PDFs or nominee data
- Bulk send (one employee at a time)
- Slack message scheduling, threading, or read receipts
- Forms I / J / K (separate follow-up)
- Analytics dashboards

## 3. Key decisions (with rationale)

| Decision | Choice | Why |
|---|---|---|
| Slack identity | **Per-user tokens, messages sent "as user"** | Preserves human relationship — employee sees DM from a real HR person. Each HR user manages their own Slack credentials. |
| Token storage | **`user_profiles.slack_bot_token` + `slack_user_token`, RLS-locked to owner + service_role** | Tokens are per-user secrets. Admins cannot read other users' tokens. |
| Token validation | **`auth.test` on save** | Catches typos before HR discovers them mid-dispatch. |
| Message composition | **Template with `{{first_name}}` placeholder, editable pre-send** | Consistency + personal-touch when needed. Sent text is persisted for audit. |
| Template storage | **DB table, UI-editable** | HR Ops owns the copy. No dev changes to tweak tone. |
| Template seed | **Empty strings** | HR Ops fills in their own copy on first use. |
| Attachments | **Slack `files.upload`** | Attachments live in HyperVerge's Slack workspace, employee sees native Slack UI, no separate file storage on our side. |
| Status model | **`pending` \| `completed`** | Binary. Reminders are additional messages, not status transitions. |
| Reminders | **Manual, sequential: R1 → R2 → R3** | No auto-cron in v1. Buttons enabled in sequence. |
| Trigger mode | **Informational only** | "Upcoming Triggers" list stays visible; no auto-send. HR picks and clicks. |
| Permissions (send/remind/complete/edit-templates) | **Anyone with gratuity automation access (or admin)** | HR Ops + HR leadership all participate. |
| Permissions (delete dispatch) | **Admin only** | Prevents cover-ups. |
| Per-automation isolation | **Gratuity gets its own tables (`gratuity_dispatches`, `gratuity_messages`, `gratuity_templates`)** | Future automations (onboarding, appraisal) follow the same pattern. Shared data (employees, audit_events, user_profiles) stays in common tables. |

## 4. Schema

### 4.1 `user_profiles` — two new columns

```sql
alter table user_profiles add column if not exists slack_bot_token  text;
alter table user_profiles add column if not exists slack_user_token text;
```

**Token protection — API-level (Postgres RLS can't do column-level exclusion cleanly):**

- API routes that return *any user's* profile data (e.g., `/api/admin/users`, `/api/auth/me` for self) MUST NOT `select('*')` on `user_profiles`. Use an explicit column list that excludes `slack_bot_token` / `slack_user_token`.
- Only two code paths read the raw tokens:
  1. `/api/profile` GET for the owner — returns them masked.
  2. `/api/gratuity/send` (and `/remind`) service-role reads for `user_id = auth.uid()`.
- Row-level RLS on `user_profiles` stays as-is (authenticated read-self, admin read-all). Column protection is enforced at the API boundary. A code-review checklist item will enforce this.

### 4.2 New table — `gratuity_dispatches`

One row per `(employee_id, form_type)`. Represents the ongoing workflow.

```sql
create table gratuity_dispatches (
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

create index idx_gratuity_status   on gratuity_dispatches (status);
create index idx_gratuity_employee on gratuity_dispatches (employee_id);
create index idx_gratuity_created  on gratuity_dispatches (created_at desc);
```

### 4.3 New table — `gratuity_messages`

One row per Slack send (initial + up to three reminders).

```sql
create table gratuity_messages (
  id             uuid primary key default gen_random_uuid(),
  dispatch_id    uuid not null references gratuity_dispatches(id) on delete cascade,
  message_type   text not null check (message_type in ('initial','reminder_1','reminder_2','reminder_3')),
  sent_by        uuid references user_profiles(id) on delete set null,
  slack_channel  text,   -- DM channel id from conversations.open
  slack_ts       text,   -- message timestamp from chat.postMessage
  message_text   text not null,
  attachments    jsonb not null default '[]',  -- [{slack_file_id, name, size, mime_type}]
  error          text,
  sent_at        timestamptz not null default now(),
  constraint uq_message_type unique (dispatch_id, message_type)
);

create index idx_messages_dispatch on gratuity_messages (dispatch_id);
create index idx_messages_sent_at  on gratuity_messages (sent_at desc);
```

The `unique (dispatch_id, message_type)` constraint is the deduplication primitive — can't accidentally double-send the initial message or the same reminder twice.

### 4.4 New table — `gratuity_templates`

```sql
create table gratuity_templates (
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
```

### 4.5 RLS

All three new tables get RLS enabled. Policies:

- `authenticated` → select-only if user has `automations.automation_id='gratuity'` granted OR role=admin.
- `service_role` → all.
- Mutations only through API routes, which enforce the same permission check.

## 5. Templates

### 5.1 Substitution

Placeholders supported in v1:

| Placeholder | Replacement |
|---|---|
| `{{first_name}}` | `employee.first_name` |
| `{{last_name}}` | `employee.last_name` |
| `{{emp_id}}` | `employee.emp_id` |
| `{{joining_date}}` | `employee.date_of_joining` formatted `DD Mon YYYY` |
| `{{service_years}}` | floor years since joining |

Substitution happens server-side right before send, so the persisted `gratuity_messages.message_text` is the *final* text (including the HR user's edits and the variable values). Template body is NOT re-substituted on display — what was sent is what's recorded.

### 5.2 Editing

New tab on `/admin` → "Templates":
- List of four form-type×template-key rows (v1 only F rows are populated)
- Each row: read-only `form_type` + `template_key` (e.g., `F · initial`), editable textarea, `updated_by`/`updated_at` stamp, Save button
- Editing permission: anyone with gratuity access OR admin
- Last-write-wins on concurrent edits (conflict detection deferred).

## 6. Slack integration

### 6.1 Token scopes required

**User token** (`xoxp-...`) — scopes needed for `chat:write` (send DM as user), `files:write` (upload attachments as user).
**Bot token** (`xoxb-...`) — scopes needed for `conversations:write` (open DMs with employees), `users:read.email` (resolve employee email → Slack user id). May not be strictly needed if the user token has `users:read.email` too; bot token is kept as a fallback/admin convenience.

(Actual scope list verified against Slack docs during implementation.)

### 6.2 Send flow (server)

Input: `{employee_id, form_type, message_text, attachments: [FileBlob]}`, actor = clicking user.

1. Fetch actor's `slack_user_token`. If missing → 400 with pointer to `/profile`.
2. Resolve employee's Slack user id: lookup `employees.slack_user_id`. If empty, call `users.lookupByEmail` via bot token, cache back to `employees.slack_user_id`.
3. `conversations.open` → DM channel id.
4. `files.upload` (per attachment) → collect file ids.
5. `chat.postMessage` with resolved text and file attachments. Uses user token.
6. On success:
   - Upsert `gratuity_dispatches` (status=pending unless existing).
   - Insert `gratuity_messages` row with slack_channel/ts, message_text, attachments metadata.
   - Insert `audit_events` row.
7. On Slack API failure:
   - Insert `gratuity_messages` row with `error` field populated, no slack_ts.
   - Return 500 with Slack error message.

### 6.3 Token validation on save

On `POST /api/profile/slack`:
1. Call Slack `auth.test` with the submitted user token → verify 200 and capture `user_id` / `team_id`.
2. Call Slack `auth.test` with the submitted bot token → same.
3. Reject save if either fails, with the Slack error in the response.
4. On success, persist both tokens. Return masked versions only.

### 6.4 Token masking

`GET /api/profile` returns:
```json
{ "slack_bot_token_preview": "xoxb-****-****...abcd", "slack_user_token_preview": "xoxp-****-****...wxyz" }
```
Full tokens are never sent to the client after save.

## 7. API routes

| Route | Method | Permission | Purpose |
|---|---|---|---|
| `/api/profile` | GET | authenticated | Own profile + masked tokens |
| `/api/profile/slack` | POST | authenticated, own profile | Save bot+user tokens; runs `auth.test` first |
| `/api/gratuity/dispatches` | GET | gratuity access | List all dispatches w/ employee + message history |
| `/api/gratuity/eligible` | GET | gratuity access | Employees eligible for Form F (1+ year, status=active) + current dispatch status |
| `/api/gratuity/send` | POST | gratuity access | Create dispatch (if new) + send initial Slack DM |
| `/api/gratuity/remind` | POST | gratuity access | Send reminder_N (N = next unsent in sequence) |
| `/api/gratuity/complete` | POST | gratuity access | Mark dispatch completed with optional note |
| `/api/gratuity/dispatches/:id` | DELETE | admin only | Hard delete |
| `/api/gratuity/templates` | GET | gratuity access | List templates |
| `/api/gratuity/templates/:id` | PUT | gratuity access | Update template body |

All mutations write an `audit_events` row with `automation_id='gratuity'`.

## 8. UI

### 8.1 `/profile` (new page)

- Header + Back (with Esc shortcut)
- Name, email, role — read-only
- Slack integration card:
  - "Bot token" input (type=password)
  - "User token" input (type=password)
  - Save button
  - Status chip: "Not connected" / "Connected as @username (workspace: HyperVerge)"
  - On save: calls `auth.test`, shows inline error or success toast
- After save, inputs become masked (`xoxb-****...`); clicking "Edit" clears and shows empty inputs.

### 8.2 `/gratuity` (existing page, extended)

Additions to the existing dashboard:

- **Upcoming Triggers** section (already exists): each row gets a "Send Form F" button.
- **New section — "Send Manually"**: employee combobox (filtered to eligible), "Compose" opens the composer.
- **Recent Dispatches** table: click a row to open the detail side-panel.

### 8.3 Composer (slide-over panel)

Opens from "Send Form F" / "Compose" / reminder buttons.

- Target employee card (name, emp_id, department, joining date)
- Message textarea pre-filled with the template (with variables substituted)
- Attachments list — drag/drop or click to upload. Shown as chips with remove buttons.
- If actor has no Slack tokens: textarea disabled, banner with link to `/profile`.
- Cancel / Send buttons. Send shows a spinner; on failure shows inline error.

### 8.4 Dispatch detail side-panel

Opens from Recent Dispatches row click.

- Employee card + dispatch status badge
- Message history timeline (initial + reminders), each with text, attachments, sent-by, sent-at
- Action buttons (enabled/disabled based on state):
  - "Send Reminder 1" — enabled if initial sent, reminder_1 not sent
  - "Send Reminder 2" — enabled if reminder_1 sent, reminder_2 not sent
  - "Send Reminder 3" — enabled if reminder_2 sent, reminder_3 not sent
  - "Mark Completed" — enabled if status=pending
  - "Delete" — admin only, with confirmation
- "Mark Completed" opens a small modal with optional note.

### 8.5 `/admin` — "Templates" tab

Alongside existing "Access Requests" and "All Users" tabs.
- Table of templates (form_type, template_key, updated_by, updated_at, Edit button)
- Edit opens an inline textarea + Save / Cancel
- Save writes via `PUT /api/gratuity/templates/:id`, updates `updated_by`/`updated_at`

## 9. Loading & error states

- All pages use the existing `LoadingScreen` pattern — render only after all data fetches resolve
- Composer "Send" shows inline spinner; success closes the panel, failure keeps it open with inline error
- Slack API failures surface human-readable errors (not raw `invalid_auth` etc.) — a small mapping table of known Slack error codes

## 10. Audit trail

Every mutation writes `audit_events`:

| Action | Details captured |
|---|---|
| `gratuity.message_sent` | dispatch_id, message_type, employee_id, recipient_slack_user_id, attachment_count |
| `gratuity.completed` | dispatch_id, employee_id, note |
| `gratuity.deleted` | dispatch_id, employee_id, reason (if provided) |
| `gratuity.template_updated` | template_id, form_type, template_key, diff (body_before hash / body_after hash) |
| `profile.slack_tokens_updated` | slack_user_id, slack_team_id |

`actor_id = auth.uid()` on all rows.

## 11. Testing strategy

- **Unit**: template substitution, Slack error mapping, permission checks
- **Integration**: full send flow with Slack API mocked at HTTP layer (msw or similar)
- **Manual**: end-to-end on a test Slack workspace with DEV_TEST_USER_EMAIL routing. Dev-mode redirect (see `docs/AUTOMATION_GUIDELINES.md`) routes all DMs to `satish.d@hyperverge.co`.

## 12. Dev-mode recipient override

Every send MUST route through `resolveRecipientEmail(employee.email)` from `src/lib/env.ts`:

1. Before `users.lookupByEmail`, replace `employee.email` with `resolveRecipientEmail(employee.email)`.
2. `gratuity_messages.attachments.note` field (or `audit_events.details`) records the dev redirect so the audit log is truthful.
3. UI shows a subtle "dev-redirect to satish.d@hyperverge.co" indicator in the composer when APP_ENV=development.

## 13. Open questions for spec review

None at the time of writing — all earlier questions resolved.

## 14. Implementation milestones

1. **Schema migration** — add columns + new tables + RLS
2. **`/profile` page + token save/validate** (foundational — nothing else works without this)
3. **Templates CRUD** (admin Templates tab + API)
4. **Send flow** (composer + `/api/gratuity/send`)
5. **Dispatch list + detail panel** (read + Mark Completed)
6. **Reminders** (3 sequential buttons + templates)
7. **Delete (admin)**
8. **Polish**: loading states, error surfaces, dev-redirect indicator
