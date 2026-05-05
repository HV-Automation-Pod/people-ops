import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase";

async function getAdminUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;

  const token = authHeader.replace("Bearer ", "");
  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: { user } } = await supabaseAuth.auth.getUser(token);
  if (!user) return null;

  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") return null;
  return profile;
}

// GET — list all pending requests
export async function GET(request: NextRequest) {
  const admin = await getAdminUser(request);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("access_requests")
    .select(`
      *,
      user:user_profiles!access_requests_user_id_fkey(id, email, name, role)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

// PATCH — approve or decline a request
export async function PATCH(request: NextRequest) {
  const admin = await getAdminUser(request);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { request_id, action, review_note } = body;

  if (!request_id || !["approve", "decline"].includes(action)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Get the request
  const { data: req } = await supabase
    .from("access_requests")
    .select("*")
    .eq("id", request_id)
    .single();

  if (!req) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  if (req.status !== "pending") {
    return NextResponse.json({ error: "Request already reviewed" }, { status: 409 });
  }

  const newStatus = action === "approve" ? "approved" : "declined";

  // Update request
  await supabase
    .from("access_requests")
    .update({
      status: newStatus,
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
      review_note: review_note || null,
    })
    .eq("id", request_id);

  // If approved, grant access
  if (action === "approve") {
    await supabase.from("automations").insert({
      user_id: req.user_id,
      automation_id: req.automation_id,
      granted_by: admin.id,
    });
  }

  return NextResponse.json({ status: newStatus });
}
