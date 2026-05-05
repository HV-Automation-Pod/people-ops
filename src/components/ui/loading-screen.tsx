"use client";

import { Building2 } from "lucide-react";

export function LoadingScreen({ message }: { message?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-25 dark:bg-stone-950">
      <div className="flex flex-col items-center gap-5">
        {/* Animated logo */}
        <div className="relative">
          <div className="absolute inset-0 animate-ping rounded-2xl bg-coral-500/20" />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-coral-400 to-coral-600 shadow-lg shadow-coral-500/25">
            <Building2 className="h-7 w-7 text-white" />
          </div>
        </div>

        {/* Brand */}
        <div className="text-center">
          <p className="text-sm font-bold tracking-tight text-stone-900 dark:text-stone-100">
            People Ops
          </p>
          {message && (
            <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">
              {message}
            </p>
          )}
        </div>

        {/* Animated dots */}
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-coral-500 [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-coral-400 [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-coral-300 [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
