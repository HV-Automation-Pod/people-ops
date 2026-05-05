import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase";
import { maskToken, slackAuthTest } from "@/lib/slack";
import type { ProfilePayload } from "@/lib/types";

/**
 * GET /api/profile
 * Returns the logged-in user's own profile with masked Slack tokens and a
 * live Slack connection status (auth.test on the stored user_token).
 */
export async function GET(request: NextRequest) {
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
  const { data: profile, error } = await supabase
    .from("user_profiles")
    .select(
      "id, email, name, role, is_active, slack_bot_token, slack_user_token"
    )
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Liveness check on the user token (best-effort — don't fail the request)
  let slackConnectedAs: ProfilePayload["slack_connected_as"] = null;
  if (profile.slack_user_token) {
    try {
      const res = await slackAuthTest(profile.slack_user_token);
      slackConnectedAs = {
        user_id: res.user_id,
        team_id: res.team_id,
        team: res.team,
      };
    } catch {
      slackConnectedAs = null;
    }
  }

  const payload: ProfilePayload = {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role: profile.role,
    is_active: profile.is_active,
    slack_bot_token_preview: maskToken(profile.slack_bot_token),
    slack_user_token_preview: maskToken(profile.slack_user_token),
    slack_connected_as: slackConnectedAs,
  };

  return NextResponse.json(payload);
}
