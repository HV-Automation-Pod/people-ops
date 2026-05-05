import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { requireGratuityAccess } from "@/lib/gratuity-auth";
import {
  humanizeSlackError,
  slackLookupByEmail,
  slackOpenDm,
  slackPostMessage,
  slackUploadFile,
  type SlackUploadedFile,
} from "@/lib/slack";
import {
  devRedirectNote,
  resolveRecipientEmail,
} from "@/lib/env";
import { downloadTemplateAttachment } from "@/lib/gratuity-attachments";
import type { TemplateAttachment } from "@/lib/types";

/**
 * POST /api/gratuity/send
 *
 * Multipart form-data:
 *   employee_id:   uuid
 *   form_type:     'F' | 'I' | 'J' | 'K'
 *   message_type:  'initial' | 'reminder_1' | 'reminder_2' | 'reminder_3'
 *   message_text:  string
 *   files:         File[] (repeated)
 *
 * Sends a Slack DM from the actor's user token. Uploads each file to Slack.
 * Creates the dispatch row if it doesn't exist; enforces message_type uniqueness.
 * Writes an audit_events row.
 */
export async function POST(request: NextRequest) {
  const auth = await requireGratuityAccess(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const actorId = auth.actor.userId;

  const form = await request.formData();
  const employeeId = String(form.get("employee_id") ?? "");
  const formType = String(form.get("form_type") ?? "F") as
    | "F"
    | "I"
    | "J"
    | "K";
  const messageType = String(form.get("message_type") ?? "initial") as
    | "initial"
    | "reminder_1"
    | "reminder_2"
    | "reminder_3";
  const messageText = String(form.get("message_text") ?? "").trim();

  if (!employeeId || !messageText) {
    return NextResponse.json(
      { error: "employee_id and message_text are required" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  // 1. Actor's Slack tokens
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("slack_bot_token, slack_user_token")
    .eq("id", actorId)
    .single();
  if (!profile?.slack_bot_token || !profile?.slack_user_token) {
    return NextResponse.json(
      {
        error:
          "Your Slack tokens aren't set. Go to /profile to connect Slack first.",
      },
      { status: 400 }
    );
  }

  // 2. Employee
  const { data: employee } = await supabase
    .from("employees")
    .select("id, email, first_name, last_name, slack_user_id")
    .eq("id", employeeId)
    .single();
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  // 3. Existing dispatch (for duplicate-message-type check + id reuse)
  const { data: existingDispatch } = await supabase
    .from("gratuity_dispatches")
    .select("id")
    .eq("employee_id", employeeId)
    .eq("form_type", formType)
    .maybeSingle();

  if (existingDispatch) {
    const { data: existingMsg } = await supabase
      .from("gratuity_messages")
      .select("id")
      .eq("dispatch_id", existingDispatch.id)
      .eq("message_type", messageType)
      .maybeSingle();
    if (existingMsg) {
      return NextResponse.json(
        { error: `${messageType} already sent for this dispatch.` },
        { status: 409 }
      );
    }
  }

  // 4. Resolve Slack user id (dev-redirect-aware)
  const targetEmail = resolveRecipientEmail(employee.email);
  let slackUserId: string | null = null;
  try {
    slackUserId = await slackLookupByEmail(profile.slack_bot_token, targetEmail);
  } catch (e) {
    return NextResponse.json(
      { error: extractSlackError(e) },
      { status: 502 }
    );
  }

  // 5. Open DM
  let dmChannel: string;
  try {
    dmChannel = await slackOpenDm(profile.slack_user_token, slackUserId);
  } catch (e) {
    return NextResponse.json(
      { error: extractSlackError(e) },
      { status: 502 }
    );
  }

  // 6a. Fetch the template for this (form_type, message_type) to pull any
  //     default attachments that must ride along with this message.
  const { data: template } = await supabase
    .from("gratuity_templates")
    .select("default_attachments")
    .eq("form_type", formType)
    .eq("template_key", messageType)
    .maybeSingle();
  const templateAttachments: TemplateAttachment[] =
    (template?.default_attachments as TemplateAttachment[] | null) ?? [];

  // 6b. Upload files (template attachments first, then user-added)
  const uploadedFiles: SlackUploadedFile[] = [];

  // Template-pinned attachments — server pulls from our Storage bucket with
  // service-role, then uploads to Slack with the clicking user's token.
  for (const att of templateAttachments) {
    try {
      const buf = await downloadTemplateAttachment(att.storage_path);
      const uploaded = await slackUploadFile(
        profile.slack_user_token,
        dmChannel,
        {
          buffer: buf,
          name: att.name,
          mime_type: att.mime_type,
        }
      );
      uploadedFiles.push(uploaded);
    } catch (e) {
      return NextResponse.json(
        {
          error: `Template attachment upload failed for "${att.name}": ${extractSlackError(e)}`,
        },
        { status: 502 }
      );
    }
  }

  // User-added files from the composer
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  for (const f of files) {
    try {
      const buf = Buffer.from(await f.arrayBuffer());
      const uploaded = await slackUploadFile(profile.slack_user_token, dmChannel, {
        buffer: buf,
        name: f.name,
        mime_type: f.type,
      });
      uploadedFiles.push(uploaded);
    } catch (e) {
      return NextResponse.json(
        {
          error: `File upload failed for "${f.name}": ${extractSlackError(e)}`,
        },
        { status: 502 }
      );
    }
  }

  // 7. Post the message
  let slackTs: string;
  try {
    slackTs = await slackPostMessage(profile.slack_user_token, dmChannel, messageText);
  } catch (e) {
    return NextResponse.json(
      { error: extractSlackError(e) },
      { status: 502 }
    );
  }

  // 8. Upsert dispatch
  const dispatchId =
    existingDispatch?.id ??
    (await (async () => {
      const { data, error } = await supabase
        .from("gratuity_dispatches")
        .insert({
          employee_id: employeeId,
          form_type: formType,
          status: "pending",
        })
        .select("id")
        .single();
      if (error || !data) throw new Error(error?.message ?? "dispatch insert failed");
      return data.id as string;
    })());

  // 9. Cache slack_user_id on employees for next time.
  //    IMPORTANT: only cache when the lookup was for the real employee. In dev,
  //    targetEmail is redirected to DEV_TEST_USER_EMAIL — caching that ID
  //    against the real employee row would permanently mis-route any later
  //    production send (DM goes to the test user instead of the employee).
  if (!employee.slack_user_id && targetEmail === employee.email) {
    await supabase
      .from("employees")
      .update({ slack_user_id: slackUserId })
      .eq("id", employeeId);
  }

  // 10. Insert message row
  const { error: msgErr } = await supabase.from("gratuity_messages").insert({
    dispatch_id: dispatchId,
    message_type: messageType,
    sent_by: actorId,
    slack_channel: dmChannel,
    slack_ts: slackTs,
    message_text: messageText,
    attachments: uploadedFiles,
  });
  if (msgErr) {
    return NextResponse.json({ error: msgErr.message }, { status: 500 });
  }

  // 11. Audit
  await supabase.from("audit_events").insert({
    automation_id: "gratuity",
    action: "gratuity.message_sent",
    actor_id: actorId,
    employee_id: employeeId,
    details: {
      dispatch_id: dispatchId,
      message_type: messageType,
      form_type: formType,
      recipient_email: employee.email,
      dev_redirect: devRedirectNote(employee.email),
      attachment_count: uploadedFiles.length,
    },
  });

  return NextResponse.json({
    success: true,
    dispatch_id: dispatchId,
    slack_ts: slackTs,
  });
}

function extractSlackError(e: unknown): string {
  if (e instanceof Error) {
    const m = e.message.match(/: (\w+)$/);
    if (m) return humanizeSlackError(m[1]);
    return e.message;
  }
  return "Unknown Slack error";
}
