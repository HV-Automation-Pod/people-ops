import { clsx } from "clsx";
import { Loader2 } from "lucide-react";

type V = "primary" | "secondary" | "ghost" | "danger" | "success";
type S = "xs" | "sm" | "md" | "lg";

const v: Record<V, string> = {
  primary:
    "bg-gradient-to-b from-coral-500 to-coral-600 text-white shadow-sm shadow-coral-500/20 hover:from-coral-600 hover:to-coral-700 hover:shadow-md hover:shadow-coral-500/25 active:from-coral-700 active:to-coral-700",
  secondary:
    "border border-stone-150 bg-white text-stone-600 shadow-soft hover:bg-stone-50 hover:border-stone-200 hover:text-stone-700 active:bg-stone-75 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-750 dark:hover:border-stone-600 dark:hover:text-stone-200",
  ghost:
    "text-stone-500 hover:bg-stone-75 hover:text-stone-700 active:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-200",
  danger:
    "bg-gradient-to-b from-red-500 to-red-600 text-white shadow-sm shadow-red-500/20 hover:from-red-600 hover:to-red-700 hover:shadow-md hover:shadow-red-500/25",
  success:
    "bg-gradient-to-b from-emerald-500 to-emerald-600 text-white shadow-sm shadow-emerald-500/20 hover:from-emerald-600 hover:to-emerald-700 hover:shadow-md hover:shadow-emerald-500/25",
};

const s: Record<S, string> = {
  xs: "h-7 px-2.5 text-[11px] gap-1 rounded-lg",
  sm: "h-8 px-3.5 text-xs gap-1.5 rounded-lg",
  md: "h-9 px-4 text-sm gap-2 rounded-xl",
  lg: "h-11 px-6 text-sm gap-2.5 rounded-xl",
};

export function Button({
  children,
  variant = "primary",
  size = "sm",
  loading,
  icon,
  className,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: V;
  size?: S;
  loading?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <button
      className={clsx(
        "inline-flex cursor-pointer items-center justify-center font-semibold tracking-tight transition-all duration-200 ease-out focus-ring disabled:cursor-not-allowed disabled:opacity-40",
        v[variant],
        s[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
      {children}
    </button>
  );
}
