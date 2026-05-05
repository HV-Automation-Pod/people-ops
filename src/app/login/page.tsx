"use client";

import { createBrowserClient } from "@/lib/supabase-browser";
import { Building2, ArrowRight, Shield, Zap, Clock } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function LoginPage() {
  const login = async () => {
    const s = createBrowserClient();
    await s.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel — Branding */}
      <div className="relative hidden flex-1 overflow-hidden bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 lg:flex lg:flex-col lg:justify-between">
        <div className="bg-grid absolute inset-0 opacity-40" />
        {/* Decorative gradient orbs */}
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-coral-500/20 blur-3xl" />
        <div className="absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-indigo-500/15 blur-3xl" />

        <div className="relative z-10 p-12">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-coral-400 to-coral-600 shadow-lg shadow-coral-500/30">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white">
              People Ops
            </span>
          </div>
        </div>

        <div className="relative z-10 p-12">
          <h2 className="max-w-md text-3xl font-bold leading-tight tracking-tight text-white">
            Automate your{" "}
            <span className="bg-gradient-to-r from-coral-300 to-coral-500 bg-clip-text text-transparent">
              HR workflows
            </span>{" "}
            with confidence
          </h2>
          <p className="mt-4 max-w-sm text-base leading-relaxed text-stone-400">
            Streamline compliance, form dispatch, and employee lifecycle
            management — all in one place.
          </p>

          <div className="mt-10 space-y-4">
            {[
              {
                icon: Shield,
                title: "Compliance First",
                desc: "Automated gratuity form dispatch for Forms F, I, J, K",
              },
              {
                icon: Zap,
                title: "Smart Triggers",
                desc: "Auto-dispatch based on employee lifecycle events",
              },
              {
                icon: Clock,
                title: "Never Miss a Deadline",
                desc: "Automated reminders and overdue tracking",
              },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="flex items-start gap-3.5">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10">
                    <Icon className="h-4 w-4 text-coral-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-stone-200">
                      {f.title}
                    </p>
                    <p className="mt-0.5 text-xs text-stone-500">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative z-10 p-12">
          <p className="text-xs text-stone-600">
            Trusted by HR teams for compliance automation
          </p>
        </div>
      </div>

      {/* Right panel — Login form */}
      <div className="relative flex flex-1 flex-col items-center justify-center bg-stone-25 dark:bg-stone-950">
        <div className="bg-dots absolute inset-0 opacity-20" />
        <div className="absolute right-6 top-6 z-10">
          <ThemeToggle />
        </div>

        <div className="relative w-full max-w-[400px] px-8">
          {/* Mobile-only logo */}
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-coral-400 to-coral-600 shadow-lg shadow-coral-500/20">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-stone-900 dark:text-stone-100">
              People Ops
            </span>
          </div>

          <div className="mb-2">
            <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
              Welcome back
            </h1>
            <p className="mt-2 text-sm text-stone-400 dark:text-stone-500">
              Sign in with your company Google account to continue
            </p>
          </div>

          <div className="mt-8">
            <button
              onClick={login}
              className="group flex w-full cursor-pointer items-center justify-center gap-3 rounded-xl border border-stone-150 bg-white px-5 py-3.5 text-sm font-semibold text-stone-700 shadow-soft transition-all duration-200 hover:border-stone-200 hover:bg-stone-50 hover:shadow-elevated active:scale-[0.99] dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:hover:border-stone-600 dark:hover:bg-stone-750"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
              <ArrowRight className="h-4 w-4 text-stone-400 transition-transform duration-200 group-hover:translate-x-0.5" />
            </button>
          </div>

          <div className="divider-fade mt-8" />

          <p className="mt-6 text-center text-[11px] leading-relaxed text-stone-300 dark:text-stone-600">
            Only authorized team members can access this platform.
            <br />
            Contact your admin if you need an invitation.
          </p>
        </div>
      </div>
    </div>
  );
}
