"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { ChevronDown, Check } from "lucide-react";

export function Dropdown({
  options,
  value,
  onChange,
  className,
  disabled,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} className={clsx("relative", className)}>
      <button
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={clsx(
          "inline-flex items-center gap-2 rounded-xl border border-stone-150 bg-white px-3 py-1.5 text-xs font-semibold text-stone-600 shadow-soft transition-all duration-200 focus-ring dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300",
          disabled
            ? "cursor-not-allowed opacity-50"
            : "cursor-pointer hover:border-stone-200 hover:bg-stone-50 hover:shadow-elevated dark:hover:border-stone-600 dark:hover:bg-stone-750"
        )}
      >
        {options.find((o) => o.value === value)?.label ?? value}
        <ChevronDown
          className={clsx(
            "h-3 w-3 text-stone-400 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <div className="animate-scale-in absolute left-0 top-full z-50 mt-2 min-w-[180px] rounded-xl border border-stone-100 bg-white p-1.5 shadow-float dark:border-stone-700 dark:bg-stone-800 dark:shadow-black/40">
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={clsx(
                "flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-medium transition-all duration-150",
                value === o.value
                  ? "bg-coral-50 text-coral-600 dark:bg-coral-700/15 dark:text-coral-400"
                  : "text-stone-500 hover:bg-stone-50 hover:text-stone-700 dark:text-stone-400 dark:hover:bg-stone-750 dark:hover:text-stone-200"
              )}
            >
              {o.label}
              {value === o.value && <Check className="h-3.5 w-3.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
