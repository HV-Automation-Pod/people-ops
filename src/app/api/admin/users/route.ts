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

// GET — list all users with their access
export async function GET(request: NextRequest) {
  const admin = await getAdminUser(request);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createServiceClient();

  const { data: users, error } = await supabase
    .from("user_profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch all access grants
  const { data: allAccess } = await supabase
    .from("automations")
    .select("user_id, automation_id, granted_at");

  // Group access by user
  const accessMap: Record<string, string[]> = {};
  for (const a of allAccess ?? []) {
    if (!accessMap[a.user_id]) accessMap[a.user_id] = [];
    accessMap[a.user_id].push(a.automation_id);
  }

  const result = (users ?? []).map((u) => ({
    ...u,
    accessList: accessMap[u.id] ?? [],
  }));

  return NextResponse.json(result);
}

// PATCH — update user role or toggle access
export async function PATCH(request: NextRequest) {
  const admin = await getAdminUser(request);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { user_id, action, role, automation_id } = body;

  // Prevent admins from modifying their own row — protects against self-demotion
  // locking out the last admin.
  if (user_id === admin.id) {
    return NextResponse.json(
      { error: "You cannot modify your own account" },
      { status: 403 }
    );
  }

  const supabase = createServiceClient();

  if (action === "update_role" && role) {
    const validRoles = ["admin", "hr_manager", "hr_ops", "member"];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    await supabase
      .from("user_profiles")
      .update({ role })
      .eq("id", user_id);

    return NextResponse.json({ success: true });
  }

  if (action === "grant_access" && automation_id) {
    await supabase.from("automations").upsert(
      { user_id, automation_id, granted_by: admin.id },
      { onConflict: "user_id,automation_id" }
    );
    return NextResponse.json({ success: true });
  }

  if (action === "revoke_access" && automation_id) {
    await supabase
      .from("automations")
      .delete()
      .eq("user_id", user_id)
      .eq("automation_id", automation_id);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
