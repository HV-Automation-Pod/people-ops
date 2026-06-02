"use client";

import { useEffect, useState } from "react";
import {
  Mail,
  Clock,
  AlertTriangle,
  Pencil,
  Save,
  FileText,
  Paperclip,
  X,
  Loader2,
  Eye,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SlideOver } from "@/components/ui/slide-over";
import type { GratuityTemplate, TemplateAttachment } from "@/lib/types";
import {
  TemplateTextarea,
  PlaceholderHint,
} from "@/components/gratuity/template-textarea";
import { PLACEHOLDER_TOKENS } from "@/lib/gratuity-templates";

const TEMPLATE_META: Record<
  string,
  { title: string; subtitle: string; icon: React.ElementType }
> = {
  initial: {
    title: "Initial message",
    subtitle: "Sent when HR dispatches Form F for the first time",
    icon: Mail,
  },
  reminder_1: {
    title: "Reminder 1",
    subtitle: "First follow-up — typically ~7 days after initial",
    icon: Clock,
  },
  reminder_2: {
    title: "Reminder 2",
    subtitle: "Firmer nudge — typically ~14 days",
    icon: Clock,
  },
  reminder_3: {
    title: "Reminder 3",
    subtitle: "Final reminder — typically ~21 days",
    icon: AlertTriangle,
  },
};

export function TemplateManager({
  open,
  onClose,
  templates,
  onSave,
  onAttachmentAdded,
  onAttachmentRemoved,
  authFetch,
  canEdit,
}: {
  open: boolean;
  onClose: () => void;
  templates: GratuityTemplate[];
  onSave: (id: string, body: string) => Promise<boolean>;
  /** Called after a successful upload so parent refreshes templates */
  onAttachmentAdded: () => Promise<void>;
  /** Called after a successful delete so parent refreshes templates */
  onAttachmentRemoved: () => Promise<void>;
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
  canEdit: boolean;
}) {
  const formF = templates.filter((t) => t.form_type === "F");
  const order = ["initial", "reminder_1", "reminder_2", "reminder_3"];
  formF.sort(
    (a, b) => order.indexOf(a.template_key) - order.indexOf(b.template_key)
  );

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="Form F templates"
      subtitle={
        canEdit
          ? "Edit the default copy used when HR composes a dispatch"
          : "Read-only — only admins can edit templates"
      }
      width="lg"
    >
      <Card className="mb-5 !bg-stone-50/60 dark:!bg-stone-900/40">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/40">
            <FileText className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-[11px] leading-relaxed text-stone-500 dark:text-stone-400">
            <p className="mb-1 font-semibold text-stone-700 dark:text-stone-200">
              Placeholders
            </p>
            <p>
              {PLACEHOLDER_TOKENS.map((p, i) => (
                <span key={p}>
                  <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[10px] dark:bg-stone-800">
                    {p}
                  </code>
                  {i < PLACEHOLDER_TOKENS.length - 1 && " · "}
                </span>
              ))}
              {" "}are filled in automatically from the target employee. Type{" "}
              <code className="rounded bg-stone-100 px-1 font-mono dark:bg-stone-800">{"{{"}</code>{" "}
              in the editor to autocomplete. HR can still edit the final text
              in the composer before sending.
            </p>
          </div>
        </div>
      </Card>

      <div className="space-y-5">
        {formF.map((t) => (
          <TemplateRow
            key={t.id}
            template={t}
            onSave={onSave}
            canEdit={canEdit}
            authFetch={authFetch}
            onAttachmentAdded={onAttachmentAdded}
            onAttachmentRemoved={onAttachmentRemoved}
          />
        ))}
      </div>
    </SlideOver>
  );
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function TemplateRow({
  template,
  onSave,
  canEdit,
  authFetch,
  onAttachmentAdded,
  onAttachmentRemoved,
}: {
  template: GratuityTemplate;
  onSave: (id: string, body: string) => Promise<boolean>;
  canEdit: boolean;
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
  onAttachmentAdded: () => Promise<void>;
  onAttachmentRemoved: () => Promise<void>;
}) {
  const meta = TEMPLATE_META[template.template_key] ?? {
    title: template.template_key,
    subtitle: "",
    icon: Mail,
  };
  const Icon = meta.icon;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(template.body);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) setDraft(template.body);
  }, [template.body, editing]);

  const handleSave = async () => {
    setSaving(true);
    const ok = await onSave(template.id, draft);
    setSaving(false);
    if (ok) {
      setEditing(false);
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 2500);
    }
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await authFetch(
        `/api/gratuity/templates/${template.id}/attachments`,
        { method: "POST", body }
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUploadError(payload.error ?? `Upload failed (${res.status})`);
        return;
      }
      await onAttachmentAdded();
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (attachmentId: string) => {
    setDeletingId(attachmentId);
    try {
      const res = await authFetch(
        `/api/gratuity/templates/${template.id}/attachments/${attachmentId}`,
        { method: "DELETE" }
      );
      if (!res.ok) return;
      await onAttachmentRemoved();
    } finally {
      setDeletingId(null);
    }
  };

  const attachments = template.default_attachments ?? [];

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-coral-50 dark:bg-coral-700/15">
            <Icon className="h-4 w-4 text-coral-500" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold tracking-tight text-stone-900 dark:text-stone-100">
                {meta.title}
              </h3>
              <Badge variant="muted">Form F · {template.template_key}</Badge>
              {!template.body && !editing && (
                <Badge variant="amber" dot>
                  Empty
                </Badge>
              )}
              {savedAt && (
                <Badge variant="emerald" dot>
                  Saved
                </Badge>
              )}
            </div>
            <p className="mt-0.5 text-[11px] text-stone-400 dark:text-stone-500">
              {meta.subtitle}
            </p>
          </div>
        </div>
        {canEdit && !editing && (
          <Button
            variant="secondary"
            size="sm"
            icon={<Pencil className="h-3.5 w-3.5" />}
            onClick={() => setEditing(true)}
          >
            Edit
          </Button>
        )}
      </div>

      {editing ? (
        <div className="mt-4 space-y-3">
          <TemplateTextarea
            value={draft}
            onChange={setDraft}
            rows={8}
            placeholder="Hi {{first_name}}, ..."
            className="w-full resize-y rounded-xl border border-stone-150 bg-white px-3.5 py-2.5 font-mono text-xs leading-relaxed text-stone-700 shadow-soft transition-colors focus:border-stone-250 focus:outline-none dark:border-stone-700 dark:bg-stone-850 dark:text-stone-200 dark:focus:border-stone-600"
          />
          <PlaceholderHint />
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={saving}
              onClick={() => {
                setEditing(false);
                setDraft(template.body);
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              loading={saving}
              icon={<Save className="h-3.5 w-3.5" />}
              onClick={handleSave}
            >
              Save template
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-stone-100 bg-stone-25 p-3.5 dark:border-stone-800 dark:bg-stone-900/50">
          {template.body ? (
            <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-stone-600 dark:text-stone-300">
              {template.body}
            </pre>
          ) : (
            <p className="text-xs italic text-stone-300 dark:text-stone-600">
              {canEdit
                ? "No copy yet — click Edit to draft this message."
                : "No copy yet. Ask an admin to draft this message."}
            </p>
          )}
        </div>
      )}

      {/* Attachments */}
      <div className="mt-4 border-t border-stone-100 pt-4 dark:border-stone-800">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Paperclip className="h-3.5 w-3.5 text-stone-400" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              Default attachments
            </span>
            {attachments.length > 0 && (
              <Badge variant="muted">{attachments.length}</Badge>
            )}
          </div>
          {canEdit && (
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-stone-150 bg-white px-2.5 py-1 text-[10px] font-semibold text-stone-600 shadow-soft transition-colors hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-750">
              {uploading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Paperclip className="h-3 w-3" />
              )}
              {uploading ? "Uploading…" : "Add file"}
              <input
                type="file"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>

        <p className="mb-2 text-[10px] text-stone-400 dark:text-stone-500">
          Auto-included when this message is sent. HR can add more at send-time but can&apos;t remove these.
        </p>

        {uploadError && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-rose-200/60 bg-rose-50/40 px-2.5 py-1.5 text-[10px] text-rose-600 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-400">
            <AlertTriangle className="h-3 w-3 flex-shrink-0" />
            {uploadError}
          </div>
        )}

        {attachments.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-200 bg-stone-25 px-3 py-2 text-[11px] italic text-stone-300 dark:border-stone-700 dark:bg-stone-900/50 dark:text-stone-600">
            {canEdit
              ? "No files attached. Add the blank Form F PDF or any helper doc."
              : "No files attached to this template."}
          </p>
        ) : (
          <div className="space-y-1.5">
            {attachments.map((a) => (
              <AttachmentChip
                key={a.id}
                templateId={template.id}
                attachment={a}
                authFetch={authFetch}
                canDelete={canEdit}
                deleting={deletingId === a.id}
                onDelete={() => handleDelete(a.id)}
              />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function AttachmentChip({
  templateId,
  attachment,
  authFetch,
  canDelete,
  deleting,
  onDelete,
}: {
  templateId: string;
  attachment: TemplateAttachment;
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
  canDelete: boolean;
  deleting: boolean;
  onDelete: () => void;
}) {
  const [opening, setOpening] = useState(false);

  const handleOpen = async () => {
    setOpening(true);
    try {
      const res = await authFetch(
        `/api/gratuity/templates/${templateId}/attachments/${attachment.id}`
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.url) {
        alert(body.error ?? "Could not open file");
        return;
      }
      window.open(body.url, "_blank", "noopener,noreferrer");
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="group flex items-center justify-between gap-3 rounded-lg border border-stone-100 bg-white px-3 py-1.5 transition-colors hover:border-stone-200 hover:bg-stone-50 dark:border-stone-800 dark:bg-stone-850 dark:hover:border-stone-700 dark:hover:bg-stone-800">
      <button
        onClick={handleOpen}
        disabled={opening}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
        title="Click to preview / download"
      >
        {opening ? (
          <Loader2 className="h-3 w-3 flex-shrink-0 animate-spin text-stone-400" />
        ) : (
          <Paperclip className="h-3 w-3 flex-shrink-0 text-stone-400 group-hover:text-indigo-500" />
        )}
        <span className="truncate text-[11px] font-medium text-stone-600 underline-offset-2 group-hover:text-indigo-600 group-hover:underline dark:text-stone-300 dark:group-hover:text-indigo-400">
          {attachment.name}
        </span>
        <span className="flex-shrink-0 text-[10px] text-stone-400">
          {humanSize(attachment.size)}
        </span>
      </button>
      <div className="flex items-center gap-0.5">
        <button
          onClick={handleOpen}
          disabled={opening}
          title="Preview / download"
          className="cursor-pointer rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-indigo-500 disabled:opacity-50 dark:hover:bg-stone-800"
        >
          <Eye className="h-3 w-3" />
        </button>
        {canDelete && (
          <button
            onClick={onDelete}
            disabled={deleting}
            className="cursor-pointer rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-rose-500 disabled:opacity-50 dark:hover:bg-stone-800"
            title="Remove attachment"
          >
            {deleting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <X className="h-3 w-3" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
