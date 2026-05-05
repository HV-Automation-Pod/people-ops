/**
 * Environment helpers.
 *
 * Dev-mode recipient override: when APP_ENV=development, every automation that
 * would otherwise send a Slack DM / email / form to an employee MUST route it
 * to DEV_TEST_USER_EMAIL instead. This prevents accidentally messaging real
 * employees during testing.
 *
 * See docs/AUTOMATION_GUIDELINES.md for the full pattern every automation
 * author must follow.
 */

export function isDev(): boolean {
  return (process.env.APP_ENV ?? "production").toLowerCase() === "development";
}

/**
 * Returns the recipient email an automation should actually send to.
 *
 * - production: returns `realEmail` unchanged.
 * - development: returns `DEV_TEST_USER_EMAIL` (throws if unset).
 *
 * Always call this at the send-boundary of any automation (Slack DM, email
 * dispatch, form link). Never use `employee.email` directly for notifications.
 */
export function resolveRecipientEmail(realEmail: string): string {
  if (!isDev()) return realEmail;
  const testEmail = process.env.DEV_TEST_USER_EMAIL;
  if (!testEmail) {
    throw new Error(
      "APP_ENV=development requires DEV_TEST_USER_EMAIL to be set in .env. " +
        "This prevents accidental messages to real employees during testing."
    );
  }
  return testEmail;
}

/**
 * Returns a human-readable note when a dev redirect is active for the given
 * real email, or null in production. Use this for audit log `details` and
 * inline UI hints so it's obvious when a message was redirected.
 */
export function devRedirectNote(realEmail: string): string | null {
  if (!isDev()) return null;
  const testEmail = process.env.DEV_TEST_USER_EMAIL;
  if (!testEmail || testEmail === realEmail) return null;
  return `dev-redirect: ${realEmail} → ${testEmail}`;
}
