"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Send,
  Clock,
  AlertTriangle,
  Paperclip,
  Trash2,
  MessageSquare,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SlideOver } from "@/components/ui/slide-over";
import type { GratuityDispatch, GratuityTemplateKey } from "@/lib/types";

const REMINDER_ORDER: GratuityTemplateKey[] = [
  "initial",
  "reminder_1",
  "reminder_2",
  "reminder_3",
];

const MESSAGE_META: Record<
  GratuityTemplateKey,
  { label: string; icon: React.ElementType; tone: string }
> = {
  initial: { label: "Initial", icon: Send, tone: "text-blue-500" },
  reminder_1: { label: "Reminder 1", icon: Clock, tone: "text-amber-500" },
  reminder_2: { label: "Reminder 2", icon: Clock, tone: "text-amber-600" },
  reminder_3: { label: "Reminder 3", icon: AlertTriangle, tone: "text-rose-500" },
};

function fmtTime(d: string) {
  const date = new Date(d);
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DispatchDetail({
  open,
  onClose,
  dispatch,
  isAdmin,
  currentUserId,
  onSendReminder,
  onMarkComplete,
  onDelete,
  onDeleteMessage,
}: {
  open: boolean;
  onClose: () => void;
  dispatch: GratuityDispatch | null;
  isAdmin: boolean;
  currentUserId: string | null;
  onSendReminder: (type: GratuityTemplateKey) => void;
  onMarkComplete: (note: string) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
  onDeleteMessage: (
    messageId: string
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const [showMarkComplete, setShowMarkComplete] = useState(false);
  const [note, setNote] = useState("");
  const [completing, setCompleting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [confirmDeleteMessageId, setConfirmDeleteMessageId] = useState<string | null>(null);

  if (!dispatch) return <SlideOver open={open} onClose={onClose} title="" children={null} />;

  const employee = dispatch.employee;
  const name = employee
    ? `${employee.first_name} ${employee.last_name}`
    : "Unknown";
  const messages = dispatch.messages ?? [];
  const sentTypes = new Set(messages.map((m) => m.message_type));

  // Next reminder eligible to send
  const nextReminder =
    REMINDER_ORDER.find((t) => !sentTypes.has(t)) ?? null;
  const canSendInitial = !sentTypes.has("initial");

  const handleComplete = async () => {
    setCompleting(true);
    setError(null);
    const ok = await onMarkComplete(note);
    setCompleting(false);
    if (ok) {
      setShowMarkComplete(false);
      setNote("");
    } else {
      setError("Failed to mark complete");
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    const ok = await onDelete();
    setDeleting(false);
    if (ok) {
      setConfirmDelete(false);
    } else {
      setError("Failed to delete dispatch");
    }
  };

  const handleDeleteMessage = async () => {
    if (!confirmDeleteMessageId) return;
    setDeletingMessageId(confirmDeleteMessageId);
    setError(null);
    const result = await onDeleteMessage(confirmDeleteMessageId);
    setDeletingMessageId(null);
    if (result.ok) {
      setConfirmDeleteMessageId(null);
    } else {
      setError(result.error);
    }
  };

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="Form F dispatch"
      subtitle={name}
      width="lg"
      footer={
        <div className="flex items-center justify-between gap-3">
          <div>
            {isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                icon={<Trash2 className="h-3.5 w-3.5" />}
                onClick={() => setConfirmDelete(true)}
                disabled={deleting || completing}
                className="!text-rose-500 hover:!bg-rose-50 dark:hover:!bg-rose-950/20"
              >
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {dispatch.status === "pending" && nextReminder && nextReminder !== "initial" && (
              <Button
                variant="secondary"
                size="sm"
                icon={<Send className="h-3.5 w-3.5" />}
                onClick={() => onSendReminder(nextReminder)}
              >
                Send {nextReminder.replace("_", " ")}
              </Button>
            )}
            {dispatch.status === "pending" && canSendInitial && (
              <Button
                size="sm"
                icon={<Send className="h-3.5 w-3.5" />}
                onClick={() => onSendReminder("initial")}
              >
                Send initial
              </Button>
            )}
            {dispatch.status === "pending" && !canSendInitial && (
              <Button
                variant="success"
                size="sm"
                icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                onClick={() => setShowMarkComplete(true)}
              >
                Mark completed
              </Button>
            )}
          </div>
        </div>
      }
    >
      {/* Employee card */}
      {employee && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-stone-100 bg-stone-25 p-4 dark:border-stone-800 dark:bg-stone-900/50">
          <Avatar name={name} size="md" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-stone-800 dark:text-stone-100">
                {name}
              </p>
              <Badge variant="muted">{employee.emp_id}</Badge>
              {dispatch.status === "completed" ? (
                <Badge variant="emerald" dot>
                  Completed
                </Badge>
              ) : (
                <Badge variant="amber" dot>
                  Pending
                </Badge>
              )}
            </div>
            <p className="truncate text-[11px] text-stone-400">
              {employee.department} · {employee.designation}
            </p>
            <p className="truncate text-[10px] text-stone-300 dark:text-stone-600">
              {employee.email}
            </p>
          </div>
        </div>
      )}

      {/* Completed note */}
      {dispatch.status === "completed" && (
        <div className="mb-5 rounded-xl border border-emerald-200/60 bg-emerald-50/40 p-4 dark:border-emerald-900/30 dark:bg-emerald-950/20">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Completed
            {dispatch.completed_at && (
              <span className="text-[10px] font-medium opacity-70">
                {fmtTime(dispatch.completed_at)}
              </span>
            )}
          </div>
          {dispatch.completed_note && (
            <p className="mt-1.5 text-xs text-emerald-700 dark:text-emerald-400">
              {dispatch.completed_note}
            </p>
          )}
        </div>
      )}

      {/* Mark complete inline form */}
      {showMarkComplete && (
        <div className="mb-5 rounded-xl border border-emerald-200/60 bg-emerald-50/40 p-4 dark:border-emerald-900/30 dark:bg-emerald-950/20">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            Mark as completed
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Optional note — e.g. “Signed PDF in EPF folder #45”"
            className="w-full resize-y rounded-xl border border-stone-150 bg-white px-3 py-2 text-xs text-stone-700 focus:outline-none dark:border-stone-700 dark:bg-stone-850 dark:text-stone-200"
          />
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={completing}
              onClick={() => {
                setShowMarkComplete(false);
                setNote("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="success"
              size="sm"
              loading={completing}
              icon={<CheckCircle2 className="h-3.5 w-3.5" />}
              onClick={handleComplete}
            >
              Confirm
            </Button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-rose-200/60 bg-rose-50/40 px-3.5 py-2.5 text-xs text-rose-600 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Message timeline */}
      <div className="mb-2 flex items-center gap-2">
        <MessageSquare className="h-3.5 w-3.5 text-stone-400" />
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
          Message history
        </h3>
      </div>

      {messages.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-200 bg-stone-25 px-4 py-6 text-center text-xs text-stone-400 dark:border-stone-700 dark:bg-stone-900/50">
          No messages sent yet. Click &ldquo;Send initial&rdquo; to start.
        </p>
      ) : (
        <div className="space-y-3">
          {messages.map((m) => {
            const meta = MESSAGE_META[m.message_type];
            const MI = meta.icon;
            const canDelete =
              !!currentUserId && m.sent_by === currentUserId && !!m.slack_ts;
            const isDeletingThis = deletingMessageId === m.id;
            return (
              <div
                key={m.id}
                className="rounded-xl border border-stone-100 bg-white p-4 dark:border-stone-800 dark:bg-stone-850"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <MI className={`h-3.5 w-3.5 ${meta.tone}`} />
                    <span className="text-[11px] font-bold text-stone-700 dark:text-stone-200">
                      {meta.label}
                    </span>
                    {m.error && (
                      <Badge variant="rose" dot>
                        Failed
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-stone-400">
                      {fmtTime(m.sent_at)}
                    </span>
                    {canDelete && (
                      <button
                        onClick={() => setConfirmDeleteMessageId(m.id)}
                        disabled={isDeletingThis}
                        title="Delete this message from Slack and our records"
                        className="cursor-pointer rounded p-1 text-stone-300 transition-colors hover:bg-rose-50 hover:text-rose-500 disabled:opacity-50 dark:text-stone-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400"
                      >
                        {isDeletingThis ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
                <p className="mb-2 text-[10px] text-stone-400">
                  by {m.sender?.name ?? "Unknown"}
                </p>
                <pre className="whitespace-pre-wrap rounded-lg bg-stone-50 p-3 font-sans text-xs leading-relaxed text-stone-600 dark:bg-stone-900 dark:text-stone-300">
                  {m.message_text}
                </pre>
                {m.attachments && m.attachments.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {m.attachments.map((att, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-lg bg-stone-50 px-3 py-1.5 text-[11px] dark:bg-stone-900"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Paperclip className="h-3 w-3 flex-shrink-0 text-stone-400" />
                          <span className="truncate text-stone-600 dark:text-stone-300">
                            {att.name}
                          </span>
                        </div>
                        {att.url && (
                          <a
                            href={att.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-shrink-0 text-stone-400 hover:text-stone-600"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {m.error && (
                  <div className="mt-2 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[10px] text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
                    {m.error}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete this dispatch?"
        description={
          <>
            This will permanently remove the dispatch and its full message
            history from the database.
          </>
        }
        destructiveNote="This cannot be undone."
        confirmLabel="Delete dispatch"
        variant="danger"
      />

      <ConfirmDialog
        open={!!confirmDeleteMessageId}
        onClose={() => setConfirmDeleteMessageId(null)}
        onConfirm={handleDeleteMessage}
        title="Delete this message?"
        description={
          <>
            This will delete the message from Slack and remove it from our
            records. The recipient will no longer see it in their DM history.
          </>
        }
        destructiveNote="This cannot be undone."
        confirmLabel="Delete message"
        variant="danger"
      />
    </SlideOver>
  );
}
