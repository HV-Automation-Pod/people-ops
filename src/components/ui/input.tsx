import { clsx } from "clsx";
import React from "react";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
>(function Input({ className, invalid, ...props }, ref) {
  return (
    <input
      ref={ref}
      {...props}
      className={clsx(
        "w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-stone-700 shadow-soft transition-all duration-200 placeholder:text-stone-300 focus:shadow-elevated focus:outline-none dark:bg-stone-850 dark:text-stone-200 dark:placeholder:text-stone-600",
        invalid
          ? "border-rose-300 focus:border-rose-400 dark:border-rose-700/50"
          : "border-stone-150 focus:border-stone-250 dark:border-stone-700 dark:focus:border-stone-600",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    />
  );
});

export function Label({
  children,
  hint,
  className,
}: {
  children: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("mb-1.5 flex items-center justify-between", className)}>
      <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
        {children}
      </label>
      {hint && (
        <span className="text-[10px] font-medium text-stone-300 dark:text-stone-600">
          {hint}
        </span>
      )}
    </div>
  );
}
