import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { requireGratuityAccess } from "@/lib/gratuity-auth";
import { uploadTemplateAttachment } from "@/lib/gratuity-attachments";
import type { TemplateAttachment } from "@/lib/types";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB per file

/**
 * POST /api/gratuity/templates/:id/attachments
 * Multipart form-data: file
 * Admin only. Uploads to Supabase Storage and appends metadata to
 * gratuity_templates.default_attachments.
 */
export async function POST(
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
      { error: "Admin only — attachments can only be managed by admins" },
      { status: 403 }
    );
  }

  const supabase = createServiceClient();

  const { data: template } = await supabase
    .from("gratuity_templates")
    .select("id, form_type, template_key, default_attachments")
    .eq("id", id)
    .single();
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "file field is required" },
      { status: 400 }
    );
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (max ${MAX_BYTES / (1024 * 1024)} MB)` },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let attachment: TemplateAttachment;
  try {
    attachment = await uploadTemplateAttachment({
      templateId: id,
      file: {
        buffer,
        name: file.name,
        mime_type: file.type || "application/octet-stream",
      },
      uploadedBy: auth.actor.userId,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 }
    );
  }

  const existing = (template.default_attachments ?? []) as TemplateAttachment[];
  const next = [...existing, attachment];

  const { error: updErr } = await supabase
    .from("gratuity_templates")
    .update({ default_attachments: next, updated_by: auth.actor.userId })
    .eq("id", id);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  await supabase.from("audit_events").insert({
    automation_id: "gratuity",
    action: "gratuity.template_attachment_added",
    actor_id: auth.actor.userId,
    details: {
      template_id: id,
      form_type: template.form_type,
      template_key: template.template_key,
      attachment_id: attachment.id,
      filename: attachment.name,
      size: attachment.size,
    },
  });

  return NextResponse.json({ success: true, attachment });
}
