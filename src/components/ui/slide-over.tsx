"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { clsx } from "clsx";

/**
 * Right-side slide-over panel. Click-out or Esc to close.
 */
export function SlideOver({
  open,
  onClose,
  title,
  subtitle,
  width = "md",
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  width?: "sm" | "md" | "lg";
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const widthClass = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
  }[width];

  return (
    <div
      className={clsx(
        "fixed inset-0 z-[100] transition-opacity duration-200",
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      )}
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-stone-900/30 backdrop-blur-sm dark:bg-black/50"
      />

      {/* Panel */}
      <div
        className={clsx(
          "absolute inset-y-0 right-0 flex w-full flex-col border-l border-stone-100 bg-white shadow-2xl transition-transform duration-200 ease-out dark:border-stone-800 dark:bg-stone-950",
          widthClass,
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-stone-100 px-6 py-4 dark:border-stone-800">
          <div>
            <h2 className="text-sm font-bold tracking-tight text-stone-900 dark:text-stone-100">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-[11px] text-stone-400 dark:text-stone-500">
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-stone-800 dark:hover:text-stone-300"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="border-t border-stone-100 px-6 py-4 dark:border-stone-800">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
