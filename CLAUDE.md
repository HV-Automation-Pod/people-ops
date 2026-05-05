# People Ops — HR Automation Platform

## Project Overview
A Next.js application that automates HR compliance workflows, starting with gratuity form dispatch (Forms F, I, J, K) triggered by employee lifecycle events. The platform syncs employee data from Zoho People, communicates via Slack, and uses Supabase for auth and persistence. Includes role-based access control with admin approval flow.

## Tech Stack
- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript (strict)
- **Styling**: Tailwind CSS v4
- **Database**: Supabase (PostgreSQL + Auth + RLS)
- **Auth**: Google OAuth via Supabase
- **External APIs**: Zoho People, Slack Web API
- **Icons**: lucide-react
- **Theming**: next-themes (light/dark/system toggle)
- **Utilities**: clsx, tailwind-merge, date-fns

## Project Structure
```
src/
├── components/
│   ├── theme-provider.tsx              # next-themes wrapper
│   └── ui/
│       ├── avatar.tsx                  # Avatar with gradient initials fallback
│       ├── badge.tsx                   # Status/label badges (7 color variants)
│       ├── button.tsx                  # Button (primary/secondary/ghost/danger)
│       ├── card.tsx                    # Card container with hover lift
│       ├── dropdown.tsx               # Click-outside-aware dropdown select
│       ├── empty-state.tsx            # Empty state placeholder
│       ├── stat-card.tsx              # Metric card with icon + trend
│       └── theme-toggle.tsx           # Light/dark/system toggle
├── app/
│   ├── page.tsx                        # Home — automation selector with RBAC
│   ├── layout.tsx                      # Root layout (Geist font)
│   ├── globals.css                     # Tailwind + custom utilities
│   ├── login/page.tsx                  # Google OAuth login
│   ├── auth/callback/route.ts          # OAuth callback
│   ├── gratuity/page.tsx               # Gratuity dashboard (real data)
│   ├── admin/page.tsx                  # Admin panel (users + access requests)
│   └── api/
│       ├── auth/me/route.ts            # GET — user profile + access list + pending requests
│       ├── access/request/route.ts     # POST — request access to an automation
│       ├── admin/
│       │   ├── requests/route.ts       # GET/PATCH — list & approve/decline access requests
│       │   └── users/route.ts          # GET/PATCH — list users, change roles, toggle access
│       ├── dashboard/route.ts          # GET — stats + form breakdown
│       ├── dispatches/route.ts         # GET — recent form dispatches
│       ├── employees/upcoming/route.ts # GET — upcoming anniversary triggers
│       └── sync/zoho/route.ts          # POST — sync employees from Zoho, GET — last sync status
├── lib/
│   ├── types.ts                        # Domain types, FORM_CONFIGS, ZohoEmployee
│   ├── supabase.ts                     # Server client (anon + service role)
│   ├── supabase-browser.ts             # Browser client
│   ├── zoho.ts                         # Zoho OAuth + employee fetch
│   └── slack.ts                        # Slack user fetch + DM
supabase/migrations/
├── 001_platform_schema.sql             # RBAC + employees + audit_events
└── 002_gratuity_form_f.sql             # Gratuity Form F: dispatches, messages, templates + Slack token columns on user_profiles
```

Pages/API not listed above:
- `/profile` — user's own profile + Slack token management
- `/api/profile` — GET own profile (masked tokens)
- `/api/profile/slack` — POST save + verify via auth.test, DELETE to disconnect
- `/api/gratuity/templates` + `/api/gratuity/templates/:id` — templates CRUD
- `/api/gratuity/eligible` — employees with 1+ year service
- `/api/gratuity/dispatches` + `/api/gratuity/dispatches/:id` (DELETE admin)
- `/api/gratuity/send` — multipart, dispatch or reminder (message_type body field)
- `/api/gratuity/complete` — mark a dispatch complete with optional note

## Database Schema

Single consolidated migration (`001_platform_schema.sql`). Idempotent — uses `create table if not exists` throughout, so re-running against an existing Supabase preserves data in the RBAC tables. Includes a safety rename from the old `automation_access` name to `automations`.

### Core (shared across automations)
- **employees** — **PII-FREE by design.** Promoted columns: `emp_id` (alphanumeric), `email`, `first_name`, `last_name`, `nick_name`, `department`, `business_unit`, `designation`, `employment_type` (FT/Contract/Intern), `location`, `seating_location`, `reporting_manager_email`, `manager_id` (self-FK, resolved during sync), `date_of_joining`, `date_of_exit`, `onboarding_status`, `status` (active/exited/deceased), `slack_user_id`, `zoho_raw` (stripped), `last_synced_at`. **Stripped from `zoho_raw`:** `date_of_birth`, `pan`, `aadhaar`, `uan`, `personal_mobile`, `personal_email`, `present_address`, `permanent_address`, `work_phone`. See `ZOHO_PII_KEYS` in `src/lib/types.ts`.

### Gratuity workflow
- **form_dispatches** — lifecycle: pending → sent → acknowledged → submitted → filed | overdue. Timestamps per transition (`sent_at`, `acknowledged_at`, `submitted_at`, `filed_at`). Reminder scheduling via `next_reminder_at`.
- **nominations** — Form F. `nominees` as JSONB array `[{name, relation, share_pct, contact?, address?}]`. Partial unique index on `(employee_id) where is_active = true`.

### Cross-cutting
- **audit_events** — single timeline for all automations. `automation_id` nullable for cross-automation events.
- Sync status is derived from `employees.last_synced_at` (no separate run-history table). Per-run counts are returned in the POST response and surfaced in the admin UI for the current session only.

### RBAC
- **user_profiles** — created on first login via upsert. Avatar comes from `auth.users` metadata (Google OAuth), not stored here. Roles: `admin`, `hr_manager`, `hr_ops`, `member`.
- **automations** — per-user automation grants. Columns: `id, user_id, automation_id (text), granted_by, granted_at`. `automation_id` is free-form text matching the hardcoded automation keys in the frontend. Unique on `(user_id, automation_id)`.
- **access_requests** — status: `pending` → `approved` | `declined`. Reviewed by admin.

All tables: RLS enabled. `updated_at` auto-trigger on mutable tables. Authenticated = read-only for shared data + own RBAC rows; admin = read all RBAC; service_role = full.

## Auth + RBAC Flow
1. User visits any page → checks `supabase.auth.getSession()`
2. No session → redirect `/login` → Google OAuth → `/auth/callback`
3. On login, `/api/auth/me` upserts `user_profiles` and returns access list
4. Home page shows automations — locked/unlocked based on `automations` grants
5. Users can "Request Access" → creates `access_requests` row
6. Admins see `/admin` link → can approve/decline requests, change roles, grant/revoke per-automation access

## Roles
| Role | Access |
|------|--------|
| admin | Everything + admin panel + all automations |
| hr_manager | Automations they have access to |
| hr_ops | Automations they have access to |
| member | Automations they have access to (must request) |

## Key Patterns
- **AuthProvider context** — centralized auth in `src/components/auth-provider.tsx`. Checks session once, provides `user`, `token`, `accessList`, `isAdmin`, `hasAccess()`, `logout()`, `requestAccess()`, `authFetch()` to all pages via `useAuth()` hook. Handles redirects for unauthenticated users. Public paths (`/login`, `/auth/callback`) skip auth check.
- **API routes use service role** — `createServiceClient()` for full DB access
- **Auth header pattern** — `authFetch()` from context auto-attaches `Authorization: Bearer <token>` to API calls
- **Admin guard** — API routes check `user_profiles.role = 'admin'` before allowing admin operations
- **Upsert on login** — user profile auto-created on first `/api/auth/me` call
- **Dev-mode recipient override (MANDATORY)** — every automation that messages an employee (Slack DM, email, form link) MUST route through `resolveRecipientEmail()` from `src/lib/env.ts`. Behavior is gated by `APP_ENV`:
  - `APP_ENV=development` → all sends are redirected to `DEV_TEST_USER_EMAIL` (testing-only; prevents spamming real employees).
  - `APP_ENV=production` → sends go to the actual `employee.email`.
  Never use `employee.email` directly for sending — always go through `resolveRecipientEmail()` so the env gate is honored. Full pattern + audit-logging convention in `docs/AUTOMATION_GUIDELINES.md` — read before building any new automation.

## Dev Server
```bash
npm run dev  # runs on port 3001
```

## Setup
1. Run `001_platform_schema.sql` in Supabase SQL Editor (RBAC + employees + audit_events)
2. Run `002_gratuity_form_f.sql` (gratuity workflow tables + Slack token columns on user_profiles)
3. Enable Google OAuth in Supabase Dashboard → Authentication → Providers
4. Set redirect URL to `http://localhost:3001/auth/callback`
5. Copy `.env.example` to `.env` and fill in values
6. After first login, manually set your user's role to `admin` in `user_profiles` table
7. Click "Sync Employees" on `/admin` to load employees from Zoho (manual, admin-only)
8. Each HR user who will send dispatches goes to `/profile` → pastes their Bot + User OAuth tokens (tokens verified via Slack `auth.test` before save)
9. Admin opens `/admin → Templates` and fills in the Form F initial + reminder_1/2/3 copy

## Zoho Sync
- Source: Supabase edge function at `ZOHO_EDGE_FUNCTION_URL` env var (returns `{total_active, fetched_at, employees:[…]}`). No direct Zoho OAuth — the edge function handles that upstream.
- Trigger: manual button on `/admin` → `POST /api/sync/zoho`
- PII stripped from `zoho_raw` before write (see `ZOHO_PII_KEYS` in types)
- Exit detection: after upsert, any `status='active'` row whose `emp_id` is missing from the latest payload gets `status='exited'`, `date_of_exit = sync_date`
- Manager resolution: second pass after upsert — matches `reporting_manager_email` to `employees.email` and fills `manager_id`

## Known Issues
- Empty API dirs: `api/forms/`, `api/slack/`

## What's Built
- [x] Google OAuth login
- [x] RBAC — roles, per-automation access, request/approve flow
- [x] Admin panel — approve/decline requests, manage users, change roles, toggle access
- [x] Home page — shows locked/unlocked automations based on user access
- [x] Gratuity dashboard — real data from Supabase
- [x] Consolidated schema with constraints, indexes, triggers, RLS
- [x] AuthProvider context — centralized auth, shared user state, singleton Supabase client
- [x] Zoho employee sync API route (`/api/sync/zoho`) with PII strip + exit detection + manager resolution
- [x] Admin "Sync Employees" button with in-session counts and `employees.last_synced_at` display
- [x] Custom loading screen + 404 page

## Recently shipped — Gratuity Form F dispatch (v1)
- [x] Per-user Slack token storage (`user_profiles.slack_bot_token`, `slack_user_token`), managed via `/profile`
- [x] Token verification via Slack `auth.test` on save
- [x] Templates stored in DB (`gratuity_templates`), editable in `/admin → Templates` by anyone with gratuity access
- [x] Message composition with `{{first_name}}` substitution, editable pre-send
- [x] Native Slack file uploads (`files.upload` via user token)
- [x] Messages sent as the user, not a bot — preserves human relationship
- [x] Dev-redirect: in `APP_ENV=development`, all messages route to `DEV_TEST_USER_EMAIL`; composer shows explicit banner
- [x] 3 manual reminders enforced in sequence via `(dispatch_id, message_type)` unique constraint
- [x] Dispatch detail slide-over with full message history, Mark Complete, and (admin) Delete
- [x] Audit events for every send / complete / delete / template edit / token change

## What's Next
- [ ] Forms I, J, K (same pattern)
- [ ] Optional: reminder cron (when HR wants auto-follow-ups)
- [ ] Compliance export (one-click PDF of all dispatches + statuses)
- [ ] Onboarding automation (first pass using the same per-automation table pattern)
