# Automation Guidelines

Mandatory conventions every automation on this platform must follow. Read this **before** implementing any new automation (gratuity dispatch, onboarding tasks, appraisal nudges, leave approvals, etc.).

---

## 1. Dev-mode recipient override (non-negotiable)

The platform is actively being developed against live Zoho data for 366+ real employees. A single buggy dispatch can spam hundreds of inboxes or Slack DMs. To prevent this, **every automation that sends anything to an employee must route through the environment-aware helper in `src/lib/env.ts`**.

### Environment switch

| `APP_ENV` | Behavior |
|---|---|
| `development` | All employee-facing notifications (Slack DM, email, form link) are redirected to `DEV_TEST_USER_EMAIL` regardless of the actual employee. |
| `production` | Notifications go to the real employee. |

Both `APP_ENV` and `DEV_TEST_USER_EMAIL` are declared in `.env.example`. In dev, the app fails loudly if `DEV_TEST_USER_EMAIL` is unset — this is intentional, to prevent a missing env var from silently sending real messages.

### Required usage pattern

Never read `employee.email` (or any address field) directly for sending. Always pass it through `resolveRecipientEmail` at the send-boundary of the automation:

```ts
import { resolveRecipientEmail, devRedirectNote } from "@/lib/env";

// ❌ BAD — sends to the real employee in every environment
await sendSlackDm(employee.email, "Please complete Form F");

// ✅ GOOD — sends to test inbox in dev, real employee in prod
const to = resolveRecipientEmail(employee.email);
await sendSlackDm(to, "Please complete Form F");
```

### Audit logging

When you log a dispatch (in `audit_events` or in a table like `form_dispatches`), record the real target and the redirect note separately so the audit trail is truthful:

```ts
await supabase.from("audit_events").insert({
  automation_id: "gratuity",
  action: "form_dispatched",
  employee_id: employee.id,
  details: {
    form_type: "F",
    target_email: employee.email,                  // the real intended recipient
    sent_to: resolveRecipientEmail(employee.email), // where it actually went
    note: devRedirectNote(employee.email),         // null in prod, descriptive string in dev
  },
});
```

This keeps the audit log accurate whether we're in dev or prod, and makes it trivial to spot dev-redirected events.

### UI hints

When an admin manually dispatches something in dev mode, surface the redirect in the UI with `devRedirectNote(employee.email)` so they aren't confused about why they got the message. Example: `"Sent to satish.d@hyperverge.co (dev-redirect from anurag.p@hyperverge.co)"`.

---

## 2. Checklist for new automations

Before merging a new automation:

- [ ] Every send call uses `resolveRecipientEmail` (Slack DMs, emails, form links).
- [ ] The automation's main table references `employees(id)` with `on delete cascade` or `set null` (cascade for transactional rows like dispatches; set-null for historical audit refs).
- [ ] The automation's rows carry `automation_id` (text, matching the frontend automation key — `gratuity`, `onboarding`, `appraisal`, `leave`).
- [ ] Every mutation writes an `audit_events` row with `automation_id`, `action`, `actor_id`, `employee_id`.
- [ ] RLS is enabled on all new tables. `authenticated` is read-only; mutations go through API routes with admin/role gates.
- [ ] Admin panel exposes any knobs the ops team needs (manual trigger, pause switch, retry).
- [ ] Access is gated by the `automations` grants table — the automation appears on the home page as "locked" for users without a grant, with the Request Access flow wired up.

---

## 3. PII handling

Employees' Aadhaar / PAN / UAN / DOB / personal contact / address are **not** stored in Supabase (see `ZOHO_PII_KEYS` in `src/lib/types.ts` for the strip list). If your automation genuinely needs one of these, fetch it on-demand from the Zoho edge function at send-time. Never promote a PII column to `employees`.

---

## 4. When this guide changes

Update this file whenever you add a new platform-level convention (e.g., a new env var, a new shared table, a new mandatory audit event shape). Every automation author reads this before they start — keep it current.
