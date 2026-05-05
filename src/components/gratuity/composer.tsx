"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Send,
  Paperclip,
  X,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Eye,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SlideOver } from "@/components/ui/slide-over";
import type {
  EligibleEmployee,
  GratuityTemplate,
  GratuityTemplateKey,
  TemplateAttachment,
} from "@/lib/types";
import { substituteTemplate } from "@/lib/gratuity-templates";

type UploadedPreview = {
  file: File;
  name: string;
  size: number;
  type: string;
};

export function Composer({
  open,
  onClose,
  employee,
  templates,
  messageType,
  onSent,
  authFetch,
  canSend,
  profileMissing,
  devRedirectEmail,
}: {
  open: boolean;
  onClose: () => void;
  employee: EligibleEmployee | null;
  templates: GratuityTemplate[];
  messageType: GratuityTemplateKey;
  onSent: () => void;
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
  canSend: boolean;
  profileMissing: boolean;
  devRedirectEmail: string | null;
}) {
  const template = useMemo(
    () =>
      templates.find(
        (t) => t.form_type === "F" && t.template_key === messageType
      ),
    [templates, messageType]
  );

  const [text, setText] = useState("");
  const [files, setFiles] = useState<UploadedPreview[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-populate text whenever the composer opens for a new employee/template
  useEffect(() => {
    if (!open || !employee) return;
    const body = template?.body ?? "";
    setText(substituteTemplate(body, employee));
    setFiles([]);
    setError(null);
  }, [open, employee, template]);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next: UploadedPreview[] = [];
    for (const f of Array.from(list)) {
      next.push({ file: f, name: f.name, size: f.size, type: f.type });
    }
    setFiles((prev) => [...prev, ...next]);
  };

  const removeFile = (idx: number) =>
    setFiles((prev) => prev.filter((_, i) => i !== idx));

  const send = async () => {
    if (!employee) return;
    setSending(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("employee_id", employee.id);
      body.append("form_type", "F");
      body.append("message_type", messageType);
      body.append("message_text", text);
      for (const f of files) body.append("files", f.file);

      const res = await authFetch("/api/gratuity/send", {
        method: "POST",
        body,
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error ?? `Send failed (${res.status})`);
        return;
      }
      onSent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  const title =
    messageType === "initial"
      ? "Send Form F"
      : `Send ${messageType.replace("_", " ")}`;

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={title}
      subtitle={employee ? `to ${employee.first_name} ${employee.last_name}` : undefined}
      width="lg"
      footer={
        <div className="flex items-center justify-between">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-stone-150 bg-white px-3 py-2 text-xs font-semibold text-stone-600 shadow-soft transition-colors hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-750">
            <Paperclip className="h-3.5 w-3.5" />
            Add files
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
          </label>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={sending}>
              Cancel
            </Button>
            <Button
              size="sm"
              icon={<Send className="h-3.5 w-3.5" />}
              onClick={send}
              loading={sending}
              disabled={!canSend || !text.trim() || !employee}
            >
              {sending ? "Sending…" : "Send via Slack"}
            </Button>
          </div>
        </div>
      }
    >
      {/* Profile-missing warning */}
      {profileMissing && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200/60 bg-amber-50/40 px-4 py-3 dark:border-amber-900/30 dark:bg-amber-950/20">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
          <div className="text-[12px] leading-relaxed text-amber-700 dark:text-amber-400">
            <p className="font-semibold">Slack not connected</p>
            <p className="mt-0.5">
              You need to connect Slack before you can dispatch.{" "}
              <Link
                href="/profile"
                className="font-semibold underline hover:no-underline"
              >
                Open your profile
              </Link>
              .
            </p>
          </div>
        </div>
      )}

      {/* Dev-redirect warning */}
      {devRedirectEmail && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-blue-200/60 bg-blue-50/40 px-3.5 py-2 text-[11px] font-medium text-blue-700 dark:border-blue-900/30 dark:bg-blue-950/20 dark:text-blue-400">
          <span className="font-bold">DEV MODE</span> · Messages redirect to{" "}
          <code className="font-mono">{devRedirectEmail}</code>
        </div>
      )}

      {/* Employee card */}
      {employee && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-stone-100 bg-stone-25 p-3.5 dark:border-stone-800 dark:bg-stone-900/50">
          <Avatar name={`${employee.first_name} ${employee.last_name}`} size="md" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-stone-800 dark:text-stone-100">
                {employee.first_name} {employee.last_name}
              </p>
              <Badge variant="muted">{employee.emp_id}</Badge>
            </div>
            <p className="truncate text-[11px] text-stone-400 dark:text-stone-500">
              {employee.department} · {employee.designation}
            </p>
            <p className="truncate text-[10px] text-stone-300 dark:text-stone-600">
              {employee.email}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">
              Service
            </p>
            <p className="text-sm font-bold text-stone-700 dark:text-stone-200">
              {employee.service_years}y
            </p>
          </div>
        </div>
      )}

      {/* Message composer */}
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-stone-400">
        Message
      </label>
      {template && !template.body && (
        <div className="mb-2 flex items-center gap-2 rounded-xl border border-stone-100 bg-stone-50 px-3.5 py-2 text-[11px] font-medium text-stone-500 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-400">
          <FileText className="h-3.5 w-3.5" />
          No template saved yet — write your message below, or save one in Admin → Templates.
        </div>
      )}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={12}
        placeholder="Type your message…"
        className="w-full resize-y rounded-xl border border-stone-150 bg-white px-3.5 py-3 text-sm leading-relaxed text-stone-700 shadow-soft transition-colors focus:border-stone-250 focus:outline-none dark:border-stone-700 dark:bg-stone-850 dark:text-stone-200 dark:focus:border-stone-600"
      />

      {/* Attachment previews */}
      {(files.length > 0 || (template?.default_attachments?.length ?? 0) > 0) && (
        <div className="mt-4 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
            Attachments
          </p>

          {/* Template-pinned attachments (locked, always included) */}
          {template &&
            (template.default_attachments ?? []).map((a) => (
              <PinnedAttachmentRow
                key={a.id}
                templateId={template.id}
                attachment={a}
                authFetch={authFetch}
              />
            ))}

          {/* User-added files */}
          {files.map((f, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-xl border border-stone-100 bg-white px-3.5 py-2 text-xs dark:border-stone-800 dark:bg-stone-850"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Paperclip className="h-3.5 w-3.5 flex-shrink-0 text-stone-400" />
                <span className="truncate font-medium text-stone-700 dark:text-stone-200">
                  {f.name}
                </span>
                <span className="text-[10px] text-stone-400">
                  {humanSize(f.size)}
                </span>
              </div>
              <button
                onClick={() => removeFile(i)}
                className="cursor-pointer rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-stone-800"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200/60 bg-rose-50/40 px-3.5 py-2.5 text-[12px] text-rose-600 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Placeholders help */}
      <p className="mt-4 text-[10px] text-stone-400 dark:text-stone-500">
        <CheckCircle2 className="mr-0.5 inline h-3 w-3" />
        Placeholders auto-filled:{" "}
        <code className="rounded bg-stone-100 px-1 py-0.5 font-mono dark:bg-stone-800">
          {"{{first_name}}"}
        </code>{" "}
        ·{" "}
        <code className="rounded bg-stone-100 px-1 py-0.5 font-mono dark:bg-stone-800">
          {"{{service_years}}"}
        </code>{" "}
        · and more
      </p>
    </SlideOver>
  );
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function PinnedAttachmentRow({
  templateId,
  attachment,
  authFetch,
}: {
  templateId: string;
  attachment: TemplateAttachment;
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
}) {
  const [opening, setOpening] = useState(false);

  const open = async () => {
    setOpening(true);
    try {
      const res = await authFetch(
        `/api/gratuity/templates/${templateId}/attachments/${attachment.id}`
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.url) return;
      window.open(body.url, "_blank", "noopener,noreferrer");
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="flex items-center justify-between rounded-xl border border-coral-200/50 bg-coral-50/40 px-3.5 py-2 text-xs dark:border-coral-700/30 dark:bg-coral-700/10">
      <button
        onClick={open}
        disabled={opening}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
        title="Click to preview"
      >
        {opening ? (
          <Loader2 className="h-3.5 w-3.5 flex-shrink-0 animate-spin text-coral-500" />
        ) : (
          <Paperclip className="h-3.5 w-3.5 flex-shrink-0 text-coral-500" />
        )}
        <span className="truncate font-medium text-stone-700 underline-offset-2 hover:underline dark:text-stone-200">
          {attachment.name}
        </span>
        <span className="text-[10px] text-stone-400">
          {humanSize(attachment.size)}
        </span>
        <span className="flex-shrink-0 rounded bg-white/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-coral-600 dark:bg-stone-900/60 dark:text-coral-400">
          from template
        </span>
      </button>
      <button
        onClick={open}
        disabled={opening}
        title="Preview"
        className="cursor-pointer rounded p-1 text-stone-400 hover:bg-white/50 hover:text-coral-600 disabled:opacity-50 dark:hover:bg-stone-900/40"
      >
        <Eye className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
