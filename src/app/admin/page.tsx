"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Shield,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  UserPlus,
  CalendarCheck,
  UserCheck,
  UserX,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dropdown } from "@/components/ui/dropdown";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { StatCard } from "@/components/ui/stat-card";
import { Tooltip } from "@/components/ui/tooltip";
import { useBackOnEscape } from "@/lib/use-back-on-escape";
import type { SyncResult } from "@/lib/types";

interface AdminUserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  accessList: string[];
}
interface AccessRequest {
  id: string;
  user_id: string;
  automation_id: string;
  reason: string;
  status: "pending" | "approved" | "declined";
  review_note: string | null;
  created_at: string;
  user: { id: string; email: string; name: string; role: string };
}

const AUTO: Record<
  string,
  { label: string; icon: React.ElementType; variant: "blue" | "emerald" | "violet" }
> = {
  gratuity: { label: "Gratuity Forms", icon: FileText, variant: "blue" },
  onboarding: { label: "Onboarding", icon: UserPlus, variant: "emerald" },
  leave: { label: "Leave Mgmt", icon: CalendarCheck, variant: "violet" },
};
const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "hr_manager", label: "HR Manager" },
  { value: "hr_ops", label: "HR Ops" },
  { value: "member", label: "Member" },
];

function timeAgo(d: string) {
  const sec = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (sec < 60) return "just now";
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function AdminPage() {
  const router = useRouter();
  const { user, isAdmin, authFetch } = useAuth();
  const [tab, setTab] = useState<"requests" | "users">("requests");
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [users, setUsers] = useState<AdminUserProfile[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [loading, setLoading] = useState(true);

  useBackOnEscape("/");

  // Redirect non-admins
  useEffect(() => {
    if (user && !isAdmin) router.replace("/");
  }, [user, isAdmin, router]);

  // Fetch data once authenticated as admin
  useEffect(() => {
    if (!user || !isAdmin) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchAll(), fetchSyncStatus()]).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user, isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAll = async () => {
    const [r, u] = await Promise.all([
      authFetch("/api/admin/requests"),
      authFetch("/api/admin/users"),
    ]);
    setRequests(await r.json());
    setUsers(await u.json());
  };

  const fetchSyncStatus = async () => {
    const res = await authFetch("/api/sync/zoho");
    if (!res.ok) return;
    const data = await res.json();
    setTotalEmployees(data.totalEmployees ?? 0);
    setLastSyncedAt(data.lastSyncedAt ?? null);
  };

  const runSync = async () => {
    setSyncing(true);
    setSyncError(null);
    setLastResult(null);
    try {
      const res = await authFetch("/api/sync/zoho", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSyncError(body.error ?? `Sync failed (${res.status})`);
      } else {
        setLastResult({
          total_fetched: body.total_fetched ?? 0,
          created: body.created ?? 0,
          updated: body.updated ?? 0,
          exited: body.exited ?? 0,
          errors: body.errors ?? 0,
          synced_at: body.synced_at ?? new Date().toISOString(),
        });
      }
      await fetchSyncStatus();
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const review = async (id: string, action: "approve" | "decline") => {
    setProcessing(id);
    await authFetch("/api/admin/requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request_id: id, action }),
    });
    await fetchAll();
    setProcessing(null);
  };

  const changeRole = async (uid: string, role: string) => {
    await authFetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: uid, action: "update_role", role }),
    });
    await fetchAll();
  };

  const toggleAccess = async (uid: string, aid: string, has: boolean) => {
    await authFetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: uid,
        action: has ? "revoke_access" : "grant_access",
        automation_id: aid,
      }),
    });
    await fetchAll();
  };

  // Non-admin guard (AuthProvider handles the loading screen)
  if (!isAdmin) return null;

  // Block render until first data fetch completes — no empty-state flash
  if (loading) return <LoadingScreen message="Loading admin panel..." />;

  const pend = requests.filter((r) => r.status === "pending");
  const reviewed = requests.filter((r) => r.status !== "pending");

  return (
    <div className="min-h-screen bg-stone-25 dark:bg-stone-950">
      <header className="glass-header sticky top-0 z-50 border-b border-stone-100 dark:border-stone-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Tooltip label="Back" shortcut="Esc" align="start">
              <Link href="/">
                <Button variant="ghost" size="xs" icon={<ArrowLeft className="h-3.5 w-3.5" />}>
                  Back
                </Button>
              </Link>
            </Tooltip>
            <div className="h-5 w-px bg-stone-150 dark:bg-stone-800" />
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-coral-400 to-coral-600 shadow-sm shadow-coral-500/20">
                <Shield className="h-4 w-4 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight text-stone-900 dark:text-stone-100">
                  Admin Panel
                </h1>
                <p className="text-[10px] text-stone-400 dark:text-stone-500">
                  Users & access management
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 page-enter">
        {/* Employee sync */}
        <Card className="mb-6 !border-stone-150 dark:!border-stone-800">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 shadow-sm shadow-blue-500/20">
                <RefreshCw className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold tracking-tight text-stone-900 dark:text-stone-100">
                  Employee Data
                </p>
                <p className="mt-0.5 text-[11px] text-stone-400 dark:text-stone-500">
                  {totalEmployees} in database
                  {lastSyncedAt ? (
                    <> · Last synced {timeAgo(lastSyncedAt)}</>
                  ) : (
                    <> · Never synced</>
                  )}
                  {lastResult && (
                    <>
                      {" · "}
                      <span className="text-stone-500 dark:text-stone-400">
                        {lastResult.created} new
                      </span>
                      {" · "}
                      <span className="text-stone-500 dark:text-stone-400">
                        {lastResult.updated} updated
                      </span>
                      {lastResult.exited > 0 && (
                        <>
                          {" · "}
                          <span className="text-rose-500">
                            {lastResult.exited} exited
                          </span>
                        </>
                      )}
                      {lastResult.errors > 0 && (
                        <>
                          {" · "}
                          <span className="text-amber-500">
                            {lastResult.errors} errors
                          </span>
                        </>
                      )}
                    </>
                  )}
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              loading={syncing}
              disabled={syncing}
              icon={<RefreshCw className="h-3.5 w-3.5" />}
              onClick={runSync}
            >
              {syncing ? "Syncing…" : "Sync Employees"}
            </Button>
          </div>
          {syncError && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-200/60 bg-rose-50/40 px-3 py-2 text-[11px] text-rose-600 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-400">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{syncError}</span>
            </div>
          )}
        </Card>

        <div className="mb-8 grid grid-cols-3 gap-4">
          <StatCard
            label="Total Users"
            value={users.length}
            icon={<Users className="h-4 w-4 text-stone-400" />}
          />
          <StatCard
            label="Pending Requests"
            value={pend.length}
            icon={<Clock className="h-4 w-4 text-amber-500" />}
            iconBg="bg-amber-50 dark:bg-amber-950/50"
            trend={
              pend.length > 0
                ? { text: "Needs attention", type: "warning" }
                : { text: "All clear", type: "positive" }
            }
          />
          <StatCard
            label="Approved"
            value={requests.filter((r) => r.status === "approved").length}
            icon={<UserCheck className="h-4 w-4 text-emerald-500" />}
            iconBg="bg-emerald-50 dark:bg-emerald-950/50"
          />
        </div>

        <div className="mb-6 flex gap-1 rounded-2xl border border-stone-150 bg-white p-1.5 shadow-soft dark:border-stone-800 dark:bg-stone-850">
          {(["requests", "users"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 cursor-pointer rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                tab === t
                  ? "bg-gradient-to-b from-coral-500 to-coral-600 text-white shadow-sm shadow-coral-500/20"
                  : "text-stone-400 hover:bg-stone-50 hover:text-stone-600 dark:text-stone-500 dark:hover:bg-stone-800 dark:hover:text-stone-300"
              }`}
            >
              {t === "requests" ? "Access Requests" : "All Users"}
              {t === "requests" && pend.length > 0 && (
                <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/25 px-1.5 text-[10px] font-bold">
                  {pend.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === "requests" && (
          <div className="space-y-8">
            {pend.length > 0 ? (
              <div>
                <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Pending Approval
                </h2>
                <div className="space-y-3">
                  {pend.map((req) => {
                    const meta = AUTO[req.automation_id];
                    return (
                      <Card
                        key={req.id}
                        className="!border-amber-200/60 !bg-amber-50/20 dark:!border-amber-900/30 dark:!bg-amber-950/10"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <Avatar name={req.user?.name ?? ""} />
                            <div>
                              <p className="text-sm font-bold text-stone-700 dark:text-stone-200">
                                {req.user?.name}
                              </p>
                              <p className="text-[11px] text-stone-400">{req.user?.email}</p>
                              {req.reason && (
                                <p className="mt-1.5 text-[11px] italic text-stone-300 dark:text-stone-500">
                                  &ldquo;{req.reason}&rdquo;
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {meta && <Badge variant={meta.variant}>{meta.label}</Badge>}
                            <span className="text-[11px] font-medium text-stone-300 dark:text-stone-600">
                              {timeAgo(req.created_at)}
                            </span>
                            <Button
                              variant="success"
                              size="sm"
                              loading={processing === req.id}
                              icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                              onClick={() => review(req.id, "approve")}
                            >
                              Approve
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={processing === req.id}
                              icon={<XCircle className="h-3.5 w-3.5" />}
                              onClick={() => review(req.id, "decline")}
                            >
                              Decline
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ) : (
              <EmptyState
                icon={<CheckCircle2 className="h-8 w-8" />}
                title="All caught up"
                description="No pending access requests at this time."
              />
            )}

            {reviewed.length > 0 && (
              <div>
                <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-stone-400">
                  History
                </h2>
                <Card padding="none" className="overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-stone-100 bg-stone-25/50 dark:border-stone-800 dark:bg-stone-900/50">
                        {["User", "Automation", "Status", "Date"].map((h, i) => (
                          <th
                            key={h}
                            className={`px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-stone-400 ${i === 3 ? "text-right" : "text-left"}`}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reviewed.map((r) => (
                        <tr key={r.id} className="table-row-hover border-b border-stone-75 last:border-0 dark:border-stone-800/50">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <Avatar name={r.user?.name ?? ""} size="sm" />
                              <div>
                                <p className="text-sm font-semibold text-stone-700 dark:text-stone-200">{r.user?.name}</p>
                                <p className="text-[10px] text-stone-400">{r.user?.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-xs font-medium text-stone-400">
                            {AUTO[r.automation_id]?.label ?? r.automation_id}
                          </td>
                          <td className="px-5 py-4">
                            <Badge variant={r.status === "approved" ? "emerald" : "rose"} dot>
                              {r.status === "approved" ? "Approved" : "Declined"}
                            </Badge>
                          </td>
                          <td className="px-5 py-4 text-right text-xs font-medium text-stone-400">
                            {timeAgo(r.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </div>
            )}
          </div>
        )}

        {tab === "users" && (
          <Card padding="none" className="overflow-visible">
            {users.length === 0 ? (
              <EmptyState icon={<Users className="h-6 w-6" />} title="No users yet" />
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-stone-100 bg-stone-25/50 dark:border-stone-800 dark:bg-stone-900/50">
                    {["User", "Role", "Access", "Joined"].map((h, i) => (
                      <th
                        key={h}
                        className={`px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-stone-400 ${i === 3 ? "text-right" : "text-left"}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isSelf = u.id === user?.id;
                    const isAdminRow = u.role === "admin";
                    const lockAccess = isSelf || isAdminRow;
                    return (
                    <tr key={u.id} className="table-row-hover border-b border-stone-75 last:border-0 dark:border-stone-800/50">
                      <td className="px-5 py-5">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.name} />
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-stone-700 dark:text-stone-200">{u.name}</p>
                              {isSelf && <Badge variant="muted">you</Badge>}
                            </div>
                            <p className="text-[11px] text-stone-400">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-5">
                        <Dropdown
                          value={u.role}
                          options={ROLES}
                          onChange={(r) => changeRole(u.id, r)}
                          disabled={isSelf}
                        />
                      </td>
                      <td className="px-5 py-5">
                        {isAdminRow ? (
                          <Tooltip
                            label="Admins bypass per-automation grants"
                            position="top"
                            align="start"
                          >
                            <div className="inline-flex items-center gap-2 rounded-xl border border-coral-200/60 bg-gradient-to-r from-coral-50 to-coral-100/60 px-3 py-2 text-[10px] font-bold text-coral-600 shadow-sm dark:border-coral-700/40 dark:from-coral-700/15 dark:to-coral-700/5 dark:text-coral-400">
                              <Shield className="h-3.5 w-3.5" />
                              Full access
                              <span className="font-medium opacity-70">
                                · all automations
                              </span>
                            </div>
                          </Tooltip>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(AUTO).map(([id, meta]) => {
                              const granted = u.accessList.includes(id);
                              const Icon = meta.icon;
                              const tooltip = isSelf
                                ? "You cannot modify your own access"
                                : granted
                                  ? `Revoke ${meta.label}`
                                  : `Grant ${meta.label}`;
                              return (
                                <button
                                  key={id}
                                  onClick={() => !lockAccess && toggleAccess(u.id, id, granted)}
                                  disabled={lockAccess}
                                  title={tooltip}
                                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[10px] font-bold transition-all duration-200 ${
                                    lockAccess ? "cursor-not-allowed" : "cursor-pointer"
                                  } ${
                                    granted
                                      ? `border-coral-200/50 bg-coral-50 text-coral-600 shadow-sm dark:border-coral-700/30 dark:bg-coral-700/15 dark:text-coral-400 ${!lockAccess ? "hover:bg-coral-100 dark:hover:bg-coral-700/25" : ""}`
                                      : `border-stone-150 bg-stone-50 text-stone-300 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-600 ${!lockAccess ? "hover:border-stone-200 hover:bg-stone-75 hover:text-stone-500 dark:hover:border-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-400" : ""}`
                                  }`}
                                >
                                  <Icon className="h-3 w-3" />
                                  {meta.label}
                                  {granted ? <UserCheck className="h-3 w-3 text-emerald-500" /> : <UserX className="h-3 w-3" />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-5 text-right text-xs font-medium text-stone-400">
                        {timeAgo(u.created_at)}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>
        )}

      </main>
    </div>
  );
}
