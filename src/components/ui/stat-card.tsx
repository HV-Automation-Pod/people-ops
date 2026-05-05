import { Card } from "./card";
import { clsx } from "clsx";

export function StatCard({
  label,
  value,
  subtitle,
  icon,
  iconBg,
  trend,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  iconBg?: string;
  trend?: { text: string; type: "positive" | "warning" | "neutral" };
}) {
  return (
    <Card interactive>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
            {label}
          </p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
            {value}
          </p>
          {(trend || subtitle) && (
            <p
              className={clsx(
                "mt-1.5 text-[11px] font-medium",
                trend?.type === "positive" && "text-emerald-600 dark:text-emerald-400",
                trend?.type === "warning" && "text-amber-600 dark:text-amber-400",
                (!trend || trend.type === "neutral") && "text-stone-400 dark:text-stone-500"
              )}
            >
              {trend?.text ?? subtitle}
            </p>
          )}
        </div>
        <div
          className={clsx(
            "flex h-10 w-10 items-center justify-center rounded-xl",
            iconBg ?? "bg-stone-75 dark:bg-stone-800"
          )}
        >
          {icon}
        </div>
      </div>
    </Card>
  );
}
