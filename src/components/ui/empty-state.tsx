import { clsx } from "clsx";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-stone-25/50 py-16 dark:border-stone-700 dark:bg-stone-900/50",
        className
      )}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100 text-stone-400 dark:bg-stone-800 dark:text-stone-500">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-stone-700 dark:text-stone-200">{title}</h3>
      {description && (
        <p className="mt-2 max-w-xs text-center text-xs leading-relaxed text-stone-400 dark:text-stone-500">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
