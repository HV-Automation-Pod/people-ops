"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { clsx } from "clsx";
import { Tooltip } from "@/components/ui/tooltip";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  if (!m) return <div className="h-8 w-20" />;

  return (
    <div className="flex items-center gap-0.5 rounded-xl border border-stone-150 bg-stone-50/80 p-0.5 dark:border-stone-700 dark:bg-stone-800/80">
      {(
        [
          ["light", Sun, "Light"],
          ["dark", Moon, "Dark"],
          ["system", Monitor, "System"],
        ] as const
      ).map(([v, Icon, label]) => (
        <Tooltip key={v} label={label} position="top" align="center">
          <button
            onClick={() => setTheme(v)}
            className={clsx(
              "cursor-pointer rounded-lg p-1.5 transition-all duration-200",
              theme === v
                ? "bg-white text-stone-700 shadow-sm dark:bg-stone-700 dark:text-stone-100"
                : "text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        </Tooltip>
      ))}
    </div>
  );
}
