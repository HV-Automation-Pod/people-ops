import { createServiceClient } from "@/lib/supabase";
import type { TemplateAttachment } from "@/lib/types";
import { randomUUID } from "crypto";

export const TEMPLATE_BUCKET = "gratuity-template-attachments";

/**
 * Upload a file to the template attachments bucket. Returns the metadata
 * record to be stored in gratuity_templates.default_attachments.
 */
export async function uploadTemplateAttachment(params: {
  templateId: string;
  file: { buffer: Buffer; name: string; mime_type: string };
  uploadedBy: string;
}): Promise<TemplateAttachment> {
  const supabase = createServiceClient();
  const id = randomUUID();
  // Keep a readable path: <template_id>/<attachment_uuid>-<original name>
  const safeName = params.file.name.replace(/[^\w.\-]/g, "_");
  const storage_path = `${params.templateId}/${id}-${safeName}`;

  const { error } = await supabase.storage
    .from(TEMPLATE_BUCKET)
    .upload(storage_path, params.file.buffer, {
      contentType: params.file.mime_type,
      upsert: false,
    });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  return {
    id,
    name: params.file.name,
    mime_type: params.file.mime_type,
    size: params.file.buffer.byteLength,
    storage_path,
    uploaded_by: params.uploadedBy,
    uploaded_at: new Date().toISOString(),
  };
}

/**
 * Generate a short-lived signed URL for previewing/downloading an attachment
 * in the browser. Bucket is private, so the UI needs this instead of a public
 * URL. Default expiry: 5 minutes (enough for a click-through preview).
 */
export async function getSignedAttachmentUrl(
  storage_path: string,
  expiresInSeconds = 300
): Promise<string> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.storage
    .from(TEMPLATE_BUCKET)
    .createSignedUrl(storage_path, expiresInSeconds);
  if (error || !data?.signedUrl) {
    throw new Error(`Signed URL failed: ${error?.message ?? "no URL returned"}`);
  }
  return data.signedUrl;
}

/** Download a template attachment's bytes from Storage. */
export async function downloadTemplateAttachment(
  storage_path: string
): Promise<Buffer> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.storage
    .from(TEMPLATE_BUCKET)
    .download(storage_path);
  if (error || !data) {
    throw new Error(`Storage download failed: ${error?.message ?? "no data"}`);
  }
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/** Remove an attachment from Storage (best-effort; errors are logged). */
export async function deleteTemplateAttachment(
  storage_path: string
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.storage
    .from(TEMPLATE_BUCKET)
    .remove([storage_path]);
  if (error) {
    console.error(`[gratuity-attachments] delete failed: ${error.message}`);
  }
}
