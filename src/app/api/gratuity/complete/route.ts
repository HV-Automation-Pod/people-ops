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

  // Only admins or someone who has actually messaged on this dispatch can
  // complete it — prevents one HR rep from closing another's workflow.
  if (!auth.actor.isAdmin) {
    const { data: ownMessages } = await supabase
      .from("gratuity_messages")
      .select("id")
      .eq("dispatch_id", dispatch_id)
      .eq("sent_by", auth.actor.userId)
      .limit(1);
    if (!ownMessages || ownMessages.length === 0) {
      return NextResponse.json(
        { error: "Only the HR rep who sent this dispatch (or an admin) can mark it complete." },
        { status: 403 }
      );
    }
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
