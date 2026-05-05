import { clsx } from "clsx";

const sizes = {
  sm: "h-8 w-8 text-[10px]",
  md: "h-10 w-10 text-xs",
  lg: "h-12 w-12 text-sm",
};

const colors = [
  "from-coral-400 to-coral-600",
  "from-blue-400 to-blue-600",
  "from-emerald-400 to-emerald-600",
  "from-violet-400 to-violet-600",
  "from-amber-400 to-amber-600",
  "from-cyan-400 to-cyan-600",
  "from-rose-400 to-rose-600",
  "from-indigo-400 to-indigo-600",
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function initials(n: string) {
  return n
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function Avatar({
  src,
  name,
  size = "md",
  className,
}: {
  src?: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  if (src)
    return (
      <img
        src={src}
        alt={name}
        className={clsx(
          "flex-shrink-0 rounded-full object-cover ring-2 ring-white dark:ring-stone-800",
          sizes[size],
          className
        )}
      />
    );
  return (
    <div
      className={clsx(
        "flex flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-bold text-white shadow-sm",
        colors[hash(name) % colors.length],
        sizes[size],
        className
      )}
    >
      {initials(name)}
    </div>
  );
}
