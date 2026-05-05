"use client";

import { clsx } from "clsx";

/**
 * Hover tooltip matching the platform's UI:
 *   - Soft shadow, rounded 12px
 *   - Inverts in dark mode (stone-800 on light, stone-100 on dark)
 *   - Optional <kbd>-style shortcut pill
 *   - Fade + subtle slide on enter
 *
 * Wraps any focusable child. Never steals click/focus — `pointer-events-none`.
 */
export function Tooltip({
  label,
  shortcut,
  children,
  className,
  position = "bottom",
  align = "center",
}: {
  label: string;
  shortcut?: string;
  children: React.ReactNode;
  className?: string;
  position?: "top" | "bottom";
  align?: "start" | "center" | "end";
}) {
  return (
    <div className={clsx("group relative inline-flex", className)}>
      {children}
      <div
        role="tooltip"
        className={clsx(
          "pointer-events-none absolute z-50 flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-stone-800 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-float opacity-0 transition-all duration-150 ease-out dark:bg-stone-100 dark:text-stone-900",
          position === "bottom" ? "top-full mt-2" : "bottom-full mb-2",
          align === "start" && "left-0",
          align === "center" && "left-1/2 -translate-x-1/2",
          align === "end" && "right-0",
          position === "bottom"
            ? "-translate-y-1 group-hover:translate-y-0 group-focus-within:translate-y-0"
            : "translate-y-1 group-hover:translate-y-0 group-focus-within:translate-y-0",
          "group-hover:opacity-100 group-focus-within:opacity-100"
        )}
      >
        {label}
        {shortcut && (
          <kbd className="rounded-md border border-white/20 bg-white/10 px-1.5 py-[1px] font-mono text-[9px] font-semibold tracking-wide dark:border-stone-900/20 dark:bg-stone-900/10">
            {shortcut}
          </kbd>
        )}
      </div>
    </div>
  );
}
