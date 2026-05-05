import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { requireGratuityAccess } from "@/lib/gratuity-auth";
import {
  deleteTemplateAttachment,
  getSignedAttachmentUrl,
} from "@/lib/gratuity-attachments";
import type { TemplateAttachment } from "@/lib/types";

/**
 * GET /api/gratuity/templates/:id/attachments/:attachmentId
 * Returns a short-lived signed URL the browser can open/download.
 * Any user with gratuity access can view attachments.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const { id, attachmentId } = await params;
  const auth = await requireGratuityAccess(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createServiceClient();
  const { data: template } = await supabase
    .from("gratuity_templates")
    .select("default_attachments")
    .eq("id", id)
    .single();
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const attachment = ((template.default_attachments ?? []) as TemplateAttachment[]).find(
    (a) => a.id === attachmentId
  );
  if (!attachment) {
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  }

  try {
    const url = await getSignedAttachmentUrl(attachment.storage_path, 300);
    return NextResponse.json({
      url,
      name: attachment.name,
      mime_type: attachment.mime_type,
      size: attachment.size,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Signed URL failed" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/gratuity/templates/:id/attachments/:attachmentId
 * Admin only. Removes from Supabase Storage and the template's JSONB list.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const { id, attachmentId } = await params;

  const auth = await requireGratuityAccess(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!auth.actor.isAdmin) {
    return NextResponse.json(
      { error: "Admin only" },
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

  const existing = (template.default_attachments ?? []) as TemplateAttachment[];
  const victim = existing.find((a) => a.id === attachmentId);
  if (!victim) {
    return NextResponse.json(
      { error: "Attachment not found" },
      { status: 404 }
    );
  }

  // Remove from Storage (best-effort)
  await deleteTemplateAttachment(victim.storage_path);

  const next = existing.filter((a) => a.id !== attachmentId);
  const { error: updErr } = await supabase
    .from("gratuity_templates")
    .update({ default_attachments: next, updated_by: auth.actor.userId })
    .eq("id", id);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  await supabase.from("audit_events").insert({
    automation_id: "gratuity",
    action: "gratuity.template_attachment_removed",
    actor_id: auth.actor.userId,
    details: {
      template_id: id,
      form_type: template.form_type,
      template_key: template.template_key,
      attachment_id: attachmentId,
      filename: victim.name,
    },
  });

  return NextResponse.json({ success: true });
}
