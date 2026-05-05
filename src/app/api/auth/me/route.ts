import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase";

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

  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Upsert user profile (no avatar_url — that comes from auth.users)
  const { data: profile } = await supabase
    .from("user_profiles")
    .upsert(
      {
        id: user.id,
        email: user.email!,
        name: user.user_metadata?.full_name || user.email!,
      },
      { onConflict: "id", ignoreDuplicates: true }
    )
    .select()
    .single();

  let userProfile = profile;
  if (!userProfile) {
    const { data } = await supabase
      .from("user_profiles")
      .select()
      .eq("id", user.id)
      .single();
    userProfile = data;
  }

  // Fetch user's automation access
  const { data: access } = await supabase
    .from("automations")
    .select("automation_id")
    .eq("user_id", user.id);

  // Fetch pending requests by this user
  const { data: pendingRequests } = await supabase
    .from("access_requests")
    .select("automation_id, status")
    .eq("user_id", user.id)
    .eq("status", "pending");

  return NextResponse.json({
    user: {
      ...userProfile,
      // avatar_url from Google OAuth (auth.users metadata)
      // Google OAuth may store it as avatar_url, picture, or under identities
      avatar_url:
        user.user_metadata?.avatar_url ||
        user.user_metadata?.picture ||
        null,
    },
    accessList: (access ?? []).map((a) => a.automation_id),
    pendingRequests: (pendingRequests ?? []).map((r) => r.automation_id),
  });
}
