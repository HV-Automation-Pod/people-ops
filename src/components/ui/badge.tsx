import { clsx } from "clsx";

type Variant = "default" | "blue" | "emerald" | "amber" | "rose" | "violet" | "muted" | "coral" | "indigo";

const styles: Record<Variant, string> = {
  default:
    "bg-stone-100 text-stone-600 ring-stone-200/50 dark:bg-stone-800 dark:text-stone-300 dark:ring-stone-700/50",
  blue:
    "bg-blue-50 text-blue-700 ring-blue-200/40 dark:bg-blue-950/60 dark:text-blue-400 dark:ring-blue-800/40",
  emerald:
    "bg-emerald-50 text-emerald-700 ring-emerald-200/40 dark:bg-emerald-950/60 dark:text-emerald-400 dark:ring-emerald-800/40",
  amber:
    "bg-amber-50 text-amber-700 ring-amber-200/40 dark:bg-amber-950/60 dark:text-amber-400 dark:ring-amber-800/40",
  rose:
    "bg-rose-50 text-rose-700 ring-rose-200/40 dark:bg-rose-950/60 dark:text-rose-400 dark:ring-rose-800/40",
  violet:
    "bg-violet-50 text-violet-700 ring-violet-200/40 dark:bg-violet-950/60 dark:text-violet-400 dark:ring-violet-800/40",
  muted:
    "bg-stone-75 text-stone-400 ring-stone-200/30 dark:bg-stone-800/60 dark:text-stone-500 dark:ring-stone-700/30",
  coral:
    "bg-coral-50 text-coral-600 ring-coral-200/40 dark:bg-coral-700/15 dark:text-coral-400 dark:ring-coral-700/30",
  indigo:
    "bg-indigo-50 text-indigo-700 ring-indigo-200/40 dark:bg-indigo-950/60 dark:text-indigo-400 dark:ring-indigo-800/40",
};

export function Badge({
  children,
  variant = "default",
  dot,
  className,
}: {
  children: React.ReactNode;
  variant?: Variant;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
        styles[variant],
        className
      )}
    >
      {dot && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-pulse-dot rounded-full bg-current opacity-40" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {children}
    </span>
  );
}
