"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

type Variant = "danger" | "warning" | "primary";

const VARIANT_STYLES: Record<
  Variant,
  { iconBg: string; iconColor: string; confirm: "danger" | "primary" | "success" }
> = {
  danger: {
    iconBg: "bg-rose-50 dark:bg-rose-950/40",
    iconColor: "text-rose-500",
    confirm: "danger",
  },
  warning: {
    iconBg: "bg-amber-50 dark:bg-amber-950/40",
    iconColor: "text-amber-500",
    confirm: "primary",
  },
  primary: {
    iconBg: "bg-coral-50 dark:bg-coral-700/15",
    iconColor: "text-coral-500",
    confirm: "primary",
  },
};

/**
 * Reusable confirmation dialog. Use for irreversible / high-risk actions:
 * sign out, disconnect, delete, etc.
 *
 * The dialog manages its own loading state when `onConfirm` returns a Promise.
 * Esc and backdrop-click call `onClose`. Enter triggers confirm (unless loading).
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  icon,
  destructiveNote,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
  icon?: React.ReactNode;
  /** Small red note shown between description and buttons, e.g. "This cannot be undone." */
  destructiveNote?: string;
}) {
  const [loading, setLoading] = useState(false);
  const styles = VARIANT_STYLES[variant];

  // Reset loading whenever the dialog opens
  useEffect(() => {
    if (open) setLoading(false);
  }, [open]);

  // Body scroll lock while open
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Keyboard: Esc closes, Enter confirms
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (loading) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Enter") {
        e.preventDefault();
        void handleConfirm();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loading]);

  const handleConfirm = async () => {
    if (loading) return;
    const result = onConfirm();
    if (result instanceof Promise) {
      setLoading(true);
      try {
        await result;
      } finally {
        setLoading(false);
      }
    }
  };

  const resolvedIcon =
    icon ??
    (variant === "danger" ? (
      <AlertTriangle className="h-5 w-5" />
    ) : variant === "warning" ? (
      <AlertTriangle className="h-5 w-5" />
    ) : (
      <Info className="h-5 w-5" />
    ));

  return (
    <div
      className={clsx(
        "fixed inset-0 z-[200] flex items-center justify-center p-4 transition-opacity duration-150",
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      )}
      aria-hidden={!open}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      {/* Backdrop */}
      <div
        onClick={() => !loading && onClose()}
        className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm dark:bg-black/60"
      />

      {/* Panel */}
      <div
        className={clsx(
          "relative w-full max-w-md rounded-2xl border border-stone-100 bg-white p-6 shadow-2xl transition-transform duration-150 dark:border-stone-800 dark:bg-stone-900",
          open ? "scale-100" : "scale-95"
        )}
      >
        <div className="flex items-start gap-4">
          <div
            className={clsx(
              "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl",
              styles.iconBg,
              styles.iconColor
            )}
          >
            {resolvedIcon}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h2
              id="confirm-title"
              className="text-base font-bold tracking-tight text-stone-900 dark:text-stone-100"
            >
              {title}
            </h2>
            {description && (
              <div className="mt-1.5 text-[13px] leading-relaxed text-stone-500 dark:text-stone-400">
                {description}
              </div>
            )}
            {destructiveNote && (
              <p className="mt-2.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                {destructiveNote}
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={loading}
            onClick={onClose}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={styles.confirm}
            size="sm"
            loading={loading}
            onClick={handleConfirm}
            autoFocus
          >
            {loading ? "Working…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
