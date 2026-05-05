import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { requireGratuityAccess } from "@/lib/gratuity-auth";

/**
 * PUT /api/gratuity/templates/:id
 * Body: { body: string }
 * Admin only. Updates the template body. Writes an audit_events row.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const auth = await requireGratuityAccess(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!auth.actor.isAdmin) {
    return NextResponse.json(
      { error: "Admin only — templates can only be edited by admins" },
      { status: 403 }
    );
  }

  let payload: { body?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const body = payload.body ?? "";

  const supabase = createServiceClient();

  const { data: before } = await supabase
    .from("gratuity_templates")
    .select("form_type, template_key, body")
    .eq("id", id)
    .single();
  if (!before) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("gratuity_templates")
    .update({ body, updated_by: auth.actor.userId })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("audit_events").insert({
    automation_id: "gratuity",
    action: "gratuity.template_updated",
    actor_id: auth.actor.userId,
    details: {
      template_id: id,
      form_type: before.form_type,
      template_key: before.template_key,
      body_length_before: before.body?.length ?? 0,
      body_length_after: body.length,
    },
  });

  return NextResponse.json({ success: true });
}
