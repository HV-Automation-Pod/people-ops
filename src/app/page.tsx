"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  UserPlus,
  CalendarCheck,
  ArrowRight,
  Clock,
  CheckCircle2,
  Zap,
  Building2,
  Loader2,
  Lock,
  Send as SendIcon,
  Shield,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import type { DashboardStats } from "@/lib/types";

const AUTOMATIONS = [
  {
    id: "gratuity",
    title: "Gratuity Forms",
    description:
      "Automated gratuity form dispatch triggered at employee lifecycle events. Forms F, I, J, K.",
    href: "/gratuity",
    icon: FileText,
    gradient: "from-coral-500 to-coral-600",
    lightBg: "bg-coral-50 dark:bg-coral-700/10",
    iconColor: "text-coral-500 dark:text-coral-400",
    active: true,
  },
  {
    id: "onboarding",
    title: "Onboarding Checklist",
    description:
      "Automated onboarding workflows — documents, IT setup, buddy assignment, and more.",
    href: "#",
    icon: UserPlus,
    gradient: "from-emerald-500 to-emerald-600",
    lightBg: "bg-emerald-50 dark:bg-emerald-950/40",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    active: false,
  },
  {
    id: "leave",
    title: "Leave Management",
    description:
      "Leave approvals, balance tracking, and policy compliance automation.",
    href: "#",
    icon: CalendarCheck,
    gradient: "from-indigo-500 to-indigo-600",
    lightBg: "bg-indigo-50 dark:bg-indigo-950/40",
    iconColor: "text-indigo-600 dark:text-indigo-400",
    active: false,
  },
];

export default function Home() {
  const router = useRouter();
  const {
    user,
    isAdmin,
    accessList,
    pendingRequests,
    hasAccess,
    requestAccess,
  } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [requesting, setRequesting] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setStatsLoading(true);
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setStats(d.stats ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleRequestAccess = async (id: string) => {
    setRequesting(id);
    try {
      await requestAccess(id);
    } finally {
      setRequesting(null);
    }
  };

  console.log({user});

  const firstName = user?.name?.split(" ")[0] ?? "there";

  return (
    <div className="min-h-screen bg-stone-25 dark:bg-stone-950">
      {/* Header */}
      <header className="glass-header sticky top-0 z-50 border-b border-stone-100 dark:border-stone-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-coral-400 to-coral-600 shadow-sm shadow-coral-500/20">
              <Building2 className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight text-stone-900 dark:text-stone-100">
                People Ops
              </span>
              <p className="text-[10px] text-stone-400 dark:text-stone-500">
                HR Automation
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link href="/admin">
                <Button
                  variant="ghost"
                  size="xs"
                  icon={<Shield className="h-3.5 w-3.5" />}
                >
                  Admin
                </Button>
              </Link>
            )}
            <Tooltip label="Profile, theme & sign out" position="bottom" align="end">
              <Link
                href="/profile"
                className="cursor-pointer rounded-full ring-2 ring-stone-100 transition-all hover:ring-coral-200 dark:ring-stone-800 dark:hover:ring-coral-700/50"
              >
                {user?.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt=""
                    className="h-8 w-8 rounded-full"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-coral-400 to-coral-600 text-[10px] font-bold text-white">
                    {firstName[0]}
                  </div>
                )}
              </Link>
            </Tooltip>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-stone-100 dark:border-stone-800">
        <div className="bg-grid absolute inset-0 opacity-30" />
        <div className="absolute -right-32 -top-32 h-64 w-64 rounded-full bg-coral-500/5 blur-3xl dark:bg-coral-500/10" />
        <div className="absolute -bottom-32 -left-32 h-64 w-64 rounded-full bg-indigo-500/5 blur-3xl dark:bg-indigo-500/10" />
        <div className="relative mx-auto max-w-6xl px-6 py-16">
          <div className="flex items-start justify-between">
            <div>
              <Badge variant="coral" className="mb-4">
                <Sparkles className="mr-0.5 h-3 w-3" />
                HR Automation Platform
              </Badge>
              <h1 className="text-4xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
                Welcome back, {firstName}
              </h1>
              <p className="mt-3 max-w-lg text-base leading-relaxed text-stone-400 dark:text-stone-500">
                Manage your HR automations, track compliance, and streamline
                employee lifecycle workflows.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-6 py-10 page-enter">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              Automations
            </h2>
            <p className="mt-0.5 text-xs text-stone-400 dark:text-stone-500">
              {accessList.length} accessible to you
            </p>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {AUTOMATIONS.map((item) => {
            const Icon = item.icon;
            const has = hasAccess(item.id);
            const pend = pendingRequests.includes(item.id);
            const soon = !item.active;
            const canOpen = has && item.active;

            return (
              <div
                key={item.id}
                onClick={() => canOpen && router.push(item.href)}
                className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-soft transition-all duration-300 dark:bg-stone-850 ${
                  canOpen
                    ? "cursor-pointer border-stone-100/80 hover:-translate-y-1 hover:border-stone-200 hover:shadow-elevated dark:border-stone-800 dark:hover:border-stone-700"
                    : "cursor-default border-stone-100/60 dark:border-stone-800/60"
                }`}
              >
                <div
                  className={`h-1.5 bg-gradient-to-r ${item.gradient} ${!canOpen ? "opacity-15" : ""}`}
                />
                <div
                  className={`flex flex-1 flex-col p-6 ${!canOpen ? "opacity-35" : ""}`}
                >
                  <div className="mb-5 flex items-start justify-between">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-xl ${item.lightBg}`}
                    >
                      <Icon className={`h-6 w-6 ${item.iconColor}`} />
                    </div>
                    {soon && <Badge variant="muted">Coming Soon</Badge>}
                    {!soon && !has && !pend && (
                      <Badge variant="amber">
                        <Lock className="mr-0.5 inline h-3 w-3" />
                        Restricted
                      </Badge>
                    )}
                    {pend && (
                      <Badge variant="blue">
                        <Clock className="mr-0.5 inline h-3 w-3" />
                        Pending
                      </Badge>
                    )}
                    {has && item.active && (
                      <Badge variant="coral">4 forms</Badge>
                    )}
                  </div>

                  <h3 className="mb-2 text-base font-bold tracking-tight text-stone-800 dark:text-stone-100">
                    {item.title}
                  </h3>
                  <p className="mb-6 flex-1 text-sm leading-relaxed text-stone-400 dark:text-stone-500">
                    {item.description}
                  </p>

                  {has && item.active && (stats || statsLoading) && (
                    <div className="mb-5 grid grid-cols-3 divide-x divide-stone-100 rounded-xl border border-stone-100 bg-stone-25 py-3.5 dark:divide-stone-800 dark:border-stone-800 dark:bg-stone-900">
                      {[
                        { label: "Active", value: stats?.formsSent, icon: Zap, color: "text-blue-500" },
                        { label: "Pending", value: stats?.formsPending, icon: Clock, color: "text-amber-500" },
                        { label: "Done", value: stats?.formsCompleted, icon: CheckCircle2, color: "text-emerald-500" },
                      ].map((s) => {
                        const SI = s.icon;
                        return (
                          <div key={s.label} className="flex flex-col items-center gap-1">
                            <SI className={`h-3.5 w-3.5 ${s.color}`} />
                            {statsLoading ? (
                              <span className="my-0.5 h-5 w-6 animate-pulse rounded-md bg-stone-100 dark:bg-stone-800" />
                            ) : (
                              <span className="text-lg font-bold text-stone-800 dark:text-stone-100">
                                {s.value ?? 0}
                              </span>
                            )}
                            <span className="text-[9px] font-semibold uppercase tracking-wider text-stone-300 dark:text-stone-600">{s.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {canOpen && (
                    <span className="flex items-center gap-2 text-sm font-bold text-coral-500 dark:text-coral-400">
                      Open Dashboard
                      <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                    </span>
                  )}
                  {!soon && !has && !pend && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRequestAccess(item.id); }}
                      disabled={requesting === item.id}
                      className="flex cursor-pointer items-center gap-2 text-sm font-bold text-amber-600 transition-opacity hover:opacity-80 disabled:opacity-40 dark:text-amber-400"
                    >
                      {requesting === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendIcon className="h-4 w-4" />}
                      Request Access
                    </button>
                  )}
                  {pend && (
                    <p className="flex items-center gap-2 text-sm font-semibold text-blue-500">
                      <Clock className="h-4 w-4" /> Request pending approval
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
