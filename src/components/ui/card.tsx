import { clsx } from "clsx";

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  interactive?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  glow?: "coral" | "indigo" | "emerald" | "amber";
};

export function Card({
  children,
  className,
  interactive,
  padding = "md",
  glow,
  ...rest
}: CardProps) {
  const p = { none: "", sm: "p-4", md: "p-5", lg: "p-6" };
  const glowMap = {
    coral: "hover:shadow-coral",
    indigo: "hover:shadow-indigo",
    emerald: "hover:shadow-[0_2px_8px_rgba(16,185,129,0.12),0_8px_24px_rgba(16,185,129,0.08)]",
    amber: "hover:shadow-[0_2px_8px_rgba(245,158,11,0.12),0_8px_24px_rgba(245,158,11,0.08)]",
  };

  return (
    <div
      {...rest}
      className={clsx(
        "rounded-2xl border border-stone-100/80 bg-white shadow-soft dark:border-stone-800 dark:bg-stone-850",
        p[padding],
        interactive &&
          "cursor-pointer transition-all duration-250 ease-out hover-lift hover:border-stone-200 hover:shadow-elevated dark:hover:border-stone-700",
        glow && interactive && glowMap[glow],
        className
      )}
    >
      {children}
    </div>
  );
}
