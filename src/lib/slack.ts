import { WebClient } from "@slack/web-api";

/**
 * Slack helpers — per-user token model.
 * Every send in the platform uses the clicking user's OWN Slack tokens
 * (stored in user_profiles.slack_bot_token / slack_user_token), so messages
 * appear to come from the real HR person's Slack account, not a bot.
 */

export interface SlackAuthResult {
  ok: true;
  user_id: string;
  team_id: string;
  team: string;
  user: string;
}

/** Call Slack `auth.test`. Throws a user-readable error if it fails. */
export async function slackAuthTest(token: string): Promise<SlackAuthResult> {
  const client = new WebClient(token);
  const res = await client.auth.test();
  if (!res.ok || !res.user_id || !res.team_id) {
    throw new Error(`Slack auth check failed: ${res.error ?? "unknown error"}`);
  }
  return {
    ok: true,
    user_id: res.user_id as string,
    team_id: res.team_id as string,
    team: (res.team as string) ?? "",
    user: (res.user as string) ?? "",
  };
}

/** Look up a Slack user by email using a bot token. Returns the Slack user_id. */
export async function slackLookupByEmail(
  botToken: string,
  email: string
): Promise<string> {
  const client = new WebClient(botToken);
  const res = await client.users.lookupByEmail({ email });
  if (!res.ok || !res.user?.id) {
    throw new Error(
      `Could not find Slack user for ${email}: ${res.error ?? "unknown error"}`
    );
  }
  return res.user.id;
}

/** Open a DM channel with a Slack user. Returns the channel id. */
export async function slackOpenDm(
  userToken: string,
  slackUserId: string
): Promise<string> {
  const client = new WebClient(userToken);
  const res = await client.conversations.open({ users: slackUserId });
  if (!res.ok || !res.channel?.id) {
    throw new Error(`Could not open DM: ${res.error ?? "unknown error"}`);
  }
  return res.channel.id;
}

export interface SlackUploadedFile {
  id: string;
  name: string;
  size: number;
  mime_type: string;
  permalink?: string;
}

/**
 * Upload a single file to Slack using the v2 upload flow, shared to a channel.
 * Returns the file metadata stored in the gratuity_messages row.
 */
export async function slackUploadFile(
  userToken: string,
  channelId: string,
  file: {
    buffer: Buffer;
    name: string;
    mime_type?: string;
  }
): Promise<SlackUploadedFile> {
  const client = new WebClient(userToken);
  const res = (await client.files.uploadV2({
    channel_id: channelId,
    file: file.buffer,
    filename: file.name,
  })) as {
    ok: boolean;
    error?: string;
    files?: { files?: { id?: string; permalink?: string }[] }[];
  };
  if (!res.ok) {
    throw new Error(`File upload failed: ${res.error ?? "unknown error"}`);
  }
  const first = res.files?.[0]?.files?.[0];
  return {
    id: first?.id ?? "",
    name: file.name,
    size: file.buffer.byteLength,
    mime_type: file.mime_type ?? "application/octet-stream",
    permalink: first?.permalink,
  };
}

/**
 * Delete a previously posted message via `chat.delete`. Slack only allows
 * deletion using the same User token (xoxp-) that posted the message.
 * Returns true on success, "already_gone" if the message no longer exists
 * (treated as success). Throws for other errors.
 */
export async function slackDeleteMessage(
  userToken: string,
  channelId: string,
  ts: string
): Promise<true | "already_gone"> {
  const client = new WebClient(userToken);
  try {
    const res = await client.chat.delete({ channel: channelId, ts });
    if (!res.ok) {
      throw new Error(`Slack chat.delete failed: ${res.error ?? "unknown error"}`);
    }
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // If the message is already gone, treat as success — nothing to clean up on Slack.
    if (/message_not_found|already_in_thread|cant_delete_message/i.test(msg)) {
      if (/message_not_found/i.test(msg)) return "already_gone";
    }
    throw e;
  }
}

/** Post a chat message to a DM channel. Returns the message timestamp (ts). */
export async function slackPostMessage(
  userToken: string,
  channelId: string,
  text: string
): Promise<string> {
  const client = new WebClient(userToken);
  const res = await client.chat.postMessage({
    channel: channelId,
    text,
    as_user: true,
  });
  if (!res.ok || !res.ts) {
    throw new Error(`Message send failed: ${res.error ?? "unknown error"}`);
  }
  return res.ts;
}

/**
 * Map raw Slack error codes to human-readable messages for the UI.
 * Extend as we encounter new errors in production.
 */
export function humanizeSlackError(raw: string): string {
  const map: Record<string, string> = {
    invalid_auth: "Your Slack token is invalid. Re-connect in your profile.",
    token_revoked: "Your Slack token was revoked. Reconnect in your profile.",
    account_inactive: "Your Slack account is inactive.",
    users_not_found: "This employee's email isn't in the Slack workspace.",
    not_in_channel: "You don't have permission to message this user.",
    rate_limited: "Slack rate limit hit. Try again in a minute.",
    missing_scope: "Your Slack token is missing a required permission scope.",
    channel_not_found: "Slack could not find or open a DM with this user.",
    cant_delete_message: "You can only delete messages you sent yourself.",
    message_not_found: "That message no longer exists in Slack.",
  };
  return map[raw] ?? `Slack error: ${raw}`;
}

/** Mask a token for UI display. Keeps prefix + last 4 chars. */
export function maskToken(token: string | null | undefined): string | null {
  if (!token) return null;
  if (token.length <= 12) return "****";
  const prefix = token.slice(0, 5); // "xoxb-" or "xoxp-"
  const tail = token.slice(-4);
  return `${prefix}****…${tail}`;
}
