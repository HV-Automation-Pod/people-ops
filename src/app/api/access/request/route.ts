import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase";

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

  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { automation_id, reason } = body;

  if (!automation_id) {
    return NextResponse.json({ error: "automation_id is required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Check if already has access
  const { data: existing } = await supabase
    .from("automations")
    .select("id")
    .eq("user_id", user.id)
    .eq("automation_id", automation_id)
    .single();

  if (existing) {
    return NextResponse.json({ error: "Already have access" }, { status: 409 });
  }

  // Check if pending request already exists
  const { data: pendingReq } = await supabase
    .from("access_requests")
    .select("id")
    .eq("user_id", user.id)
    .eq("automation_id", automation_id)
    .eq("status", "pending")
    .single();

  if (pendingReq) {
    return NextResponse.json({ error: "Request already pending" }, { status: 409 });
  }

  // Create request
  const { data, error } = await supabase
    .from("access_requests")
    .insert({
      user_id: user.id,
      automation_id,
      reason: reason || "",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
