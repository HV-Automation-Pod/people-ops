import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { requireGratuityAccess } from "@/lib/gratuity-auth";
import { humanizeSlackError, slackDeleteMessage } from "@/lib/slack";
import { withErrorHandler } from "@/lib/api-error";

/**
 * DELETE /api/gratuity/messages/:id
 *
 * Deletes a single Slack DM (via chat.delete) AND its row from
 * gratuity_messages. Slack only allows the original sender's User token
 * to delete the message, so non-senders are blocked here too.
 *
 * If this was the only message on the dispatch, the dispatch row is left
 * in place (status pending) so HR can re-send. Use the dispatch-level
 * delete to remove the whole record.
 */
export const DELETE = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;

  const auth = await requireGratuityAccess(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const actorId = auth.actor.userId;

  const supabase = createServiceClient();

  // 1. Look up the message
  const { data: message } = await supabase
    .from("gratuity_messages")
    .select("id, dispatch_id, sent_by, slack_channel, slack_ts, message_type")
    .eq("id", id)
    .single();
  if (!message) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  // 2. Permission — only the original sender can delete (Slack constraint).
  if (message.sent_by !== actorId) {
    return NextResponse.json(
      {
        error:
          "Only the HR rep who sent this message can delete it. (Slack only lets the original sender delete.)",
      },
      { status: 403 }
    );
  }

  // 3. Get the actor's Slack user token
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("slack_user_token")
    .eq("id", actorId)
    .single();
  if (!profile?.slack_user_token) {
    return NextResponse.json(
      {
        error:
          "Your Slack token isn't connected. Reconnect at /profile and try again.",
      },
      { status: 400 }
    );
  }

  // 4. Delete from Slack first — if this fails, leave the DB intact so the
  //    user can retry. "already_gone" means the message vanished on Slack
  //    (deleted manually); we proceed to clean up our row.
  if (message.slack_channel && message.slack_ts) {
    try {
      await slackDeleteMessage(
        profile.slack_user_token,
        message.slack_channel,
        message.slack_ts
      );
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Unknown Slack error";
      const m = raw.match(/: (\w+)$/);
      const friendly = m ? humanizeSlackError(m[1]) : raw;
      return NextResponse.json({ error: friendly }, { status: 502 });
    }
  }

  // 5. Delete the row (dispatch row stays — HR may want to re-send)
  const { error: delErr } = await supabase
    .from("gratuity_messages")
    .delete()
    .eq("id", id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  // 6. Audit
  await supabase.from("audit_events").insert({
    automation_id: "gratuity",
    action: "gratuity.message_deleted",
    actor_id: actorId,
    details: {
      dispatch_id: message.dispatch_id,
      message_type: message.message_type,
      slack_ts: message.slack_ts,
    },
  });

  return NextResponse.json({ success: true });
});
