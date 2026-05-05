import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase";
import { slackAuthTest } from "@/lib/slack";

/**
 * POST /api/profile/slack
 * Body: { bot_token: string, user_token: string }
 *
 * Validates both tokens via auth.test before saving. Never echoes tokens back.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = authHeader.replace("Bearer ", "");

  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const {
    data: { user },
    error: authError,
  } = await supabaseAuth.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { bot_token?: string; user_token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const bot = (body.bot_token ?? "").trim();
  const usr = (body.user_token ?? "").trim();

  if (!bot || !usr) {
    return NextResponse.json(
      { error: "Both bot_token and user_token are required" },
      { status: 400 }
    );
  }
  if (!bot.startsWith("xoxb-")) {
    return NextResponse.json(
      { error: "Bot token must start with xoxb-" },
      { status: 400 }
    );
  }
  if (!usr.startsWith("xoxp-")) {
    return NextResponse.json(
      { error: "User token must start with xoxp-" },
      { status: 400 }
    );
  }

  // Verify both tokens with Slack before saving anything.
  try {
    await slackAuthTest(bot);
  } catch (e) {
    return NextResponse.json(
      { error: `Bot token rejected by Slack: ${errMsg(e)}` },
      { status: 400 }
    );
  }

  let userCheck;
  try {
    userCheck = await slackAuthTest(usr);
  } catch (e) {
    return NextResponse.json(
      { error: `User token rejected by Slack: ${errMsg(e)}` },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();
  const { error: updateErr } = await supabase
    .from("user_profiles")
    .update({ slack_bot_token: bot, slack_user_token: usr })
    .eq("id", user.id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  await supabase.from("audit_events").insert({
    automation_id: null,
    action: "profile.slack_tokens_updated",
    actor_id: user.id,
    details: {
      slack_user_id: userCheck.user_id,
      slack_team_id: userCheck.team_id,
      slack_team: userCheck.team,
    },
  });

  return NextResponse.json({
    success: true,
    slack_connected_as: {
      user_id: userCheck.user_id,
      team_id: userCheck.team_id,
      team: userCheck.team,
    },
  });
}

/**
 * DELETE /api/profile/slack — disconnect (clears both tokens)
 */
export async function DELETE(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = authHeader.replace("Bearer ", "");

  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const {
    data: { user },
    error: authError,
  } = await supabaseAuth.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  await supabase
    .from("user_profiles")
    .update({ slack_bot_token: null, slack_user_token: null })
    .eq("id", user.id);

  await supabase.from("audit_events").insert({
    automation_id: null,
    action: "profile.slack_tokens_cleared",
    actor_id: user.id,
    details: {},
  });

  return NextResponse.json({ success: true });
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "unknown error";
}
