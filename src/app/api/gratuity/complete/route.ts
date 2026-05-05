import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { requireGratuityAccess } from "@/lib/gratuity-auth";

/**
 * POST /api/gratuity/complete
 * Body: { dispatch_id: uuid, note?: string }
 */
export async function POST(request: NextRequest) {
  const auth = await requireGratuityAccess(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: { dispatch_id?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { dispatch_id, note } = body;
  if (!dispatch_id) {
    return NextResponse.json(
      { error: "dispatch_id is required" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();
  const { data: current } = await supabase
    .from("gratuity_dispatches")
    .select("id, status, employee_id")
    .eq("id", dispatch_id)
    .single();

  if (!current) {
    return NextResponse.json({ error: "Dispatch not found" }, { status: 404 });
  }
  if (current.status === "completed") {
    return NextResponse.json(
      { error: "Dispatch is already marked completed" },
      { status: 409 }
    );
  }

  const { error } = await supabase
    .from("gratuity_dispatches")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      completed_by: auth.actor.userId,
      completed_note: note?.trim() || null,
    })
    .eq("id", dispatch_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("audit_events").insert({
    automation_id: "gratuity",
    action: "gratuity.completed",
    actor_id: auth.actor.userId,
    employee_id: current.employee_id,
    details: {
      dispatch_id,
      note: note?.trim() || null,
    },
  });

  return NextResponse.json({ success: true });
}
