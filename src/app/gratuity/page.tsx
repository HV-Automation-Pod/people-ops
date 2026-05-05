"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  UserPlus,
  FileText,
  Users,
  Scale,
  Clock,
  CheckCircle2,
  Send,
  AlertTriangle,
  ChevronRight,
  Calendar,
  Eye,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { StatCard } from "@/components/ui/stat-card";
import { Tooltip } from "@/components/ui/tooltip";
import { Composer } from "@/components/gratuity/composer";
import { EmployeePicker } from "@/components/gratuity/employee-picker";
import { useBackOnEscape } from "@/lib/use-back-on-escape";
import { DispatchDetail } from "@/components/gratuity/dispatch-detail";
import { EmployeeTable } from "@/components/gratuity/employee-table";
import { TemplateManager } from "@/components/gratuity/template-manager";
import type {
  EligibleEmployee,
  GratuityDispatch,
  GratuityTemplate,
  GratuityTemplateKey,
  ProfilePayload,
} from "@/lib/types";
import {
  FORM_CONFIGS,
  type FormType,
  type DispatchStatus,
  type DashboardStats,
} from "@/lib/types";

const iconMap: Record<string, React.ElementType> = {
  UserPlus,
  FileText,
  Users,
  Scale,
};
const STATUS: Record<
  DispatchStatus,
  {
    variant: "muted" | "blue" | "violet" | "amber" | "emerald" | "rose";
    label: string;
  }
> = {
  pending: { variant: "muted", label: "Pending" },
  sent: { variant: "blue", label: "Sent" },
  acknowledged: { variant: "violet", label: "Viewed" },
  submitted: { variant: "amber", label: "Submitted" },
  filed: { variant: "emerald", label: "Filed" },
  overdue: { variant: "rose", label: "Overdue" },
};

interface DispatchRow {
  id: string;
  form_type: FormType;
  status: DispatchStatus;
  trigger_reason: string;
  sent_at: string | null;
  created_at: string;
  employee: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    department: string;
    designation: string;
  } | null;
}
interface UpcomingEmployee {
  id: string;
  name: string;
  first_name: string;
  last_name: string;
  department: string;
  designation: string;
  anniversaryDate: string;
  daysLeft: number;
  yearsCompleting: number;
}
interface FormBreakdown {
  type: FormType;
  sent: number;
  completed: number;
  pending: number;
  overdue: number;
}

function fmt(d: string | null) {
  if (!d) return "\u2014";
  return new Date(d).toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function GratuityDashboard() {
  const { user, authFetch, isAdmin } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [breakdown, setBreakdown] = useState<FormBreakdown[]>([]);
  const [dispatches, setDispatches] = useState<GratuityDispatch[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingEmployee[]>([]);
  const [eligible, setEligible] = useState<EligibleEmployee[]>([]);
  const [templates, setTemplates] = useState<GratuityTemplate[]>([]);
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);

  // Composer / picker / detail
  const [composerEmployee, setComposerEmployee] = useState<EligibleEmployee | null>(
    null
  );
  const [composerMessageType, setComposerMessageType] =
    useState<"initial" | "reminder_1" | "reminder_2" | "reminder_3">("initial");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [selectedDispatchId, setSelectedDispatchId] = useState<string | null>(
    null
  );

  const saveTemplate = async (id: string, body: string): Promise<boolean> => {
    const res = await authFetch(`/api/gratuity/templates/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (!res.ok) return false;
    const tRes = await authFetch("/api/gratuity/templates");
    if (tRes.ok) setTemplates(await tRes.json());
    return true;
  };

  useBackOnEscape("/");

  const fetchAll = () => {
    return Promise.all([
      fetch("/api/dashboard").then((r) => r.json()).catch(() => ({})),
      authFetch("/api/gratuity/dispatches").then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch("/api/employees/upcoming").then((r) => r.json()).catch(() => []),
      authFetch("/api/gratuity/eligible").then((r) => (r.ok ? r.json() : [])).catch(() => []),
      authFetch("/api/gratuity/templates").then((r) => (r.ok ? r.json() : [])).catch(() => []),
      authFetch("/api/profile").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
  };

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    fetchAll()
      .then(([d, disp, up, elig, tmpl, prof]) => {
        if (cancelled) return;
        setStats(d.stats ?? null);
        setBreakdown(d.formBreakdown ?? []);
        setDispatches(Array.isArray(disp) ? disp : []);
        setUpcoming(Array.isArray(up) ? up : []);
        setEligible(Array.isArray(elig) ? elig : []);
        setTemplates(Array.isArray(tmpl) ? tmpl : []);
        setProfile(prof ?? null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshAfterSend = async () => {
    const [d, disp, up, elig] = await Promise.all([
      fetch("/api/dashboard").then((r) => r.json()).catch(() => ({})),
      authFetch("/api/gratuity/dispatches").then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch("/api/employees/upcoming").then((r) => r.json()).catch(() => []),
      authFetch("/api/gratuity/eligible").then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ]);
    setStats(d.stats ?? null);
    setBreakdown(d.formBreakdown ?? []);
    setDispatches(Array.isArray(disp) ? disp : []);
    setUpcoming(Array.isArray(up) ? up : []);
    setEligible(Array.isArray(elig) ? elig : []);
  };

  const selectedDispatch =
    dispatches.find((d) => d.id === selectedDispatchId) ?? null;

  const openReminderComposer = (type: GratuityTemplateKey) => {
    if (!selectedDispatch || !selectedDispatch.employee) return;
    const emp = selectedDispatch.employee;
    const eligibleEmp: EligibleEmployee = {
      id: emp.id,
      emp_id: emp.emp_id,
      email: emp.email,
      first_name: emp.first_name,
      last_name: emp.last_name,
      department: emp.department,
      designation: emp.designation,
      date_of_joining: emp.date_of_joining,
      service_years: 0,
      dispatch_status: selectedDispatch.status,
      dispatch_id: selectedDispatch.id,
    };
    setComposerMessageType(type);
    setComposerEmployee(eligibleEmp);
  };

  const markComplete = async (note: string): Promise<boolean> => {
    if (!selectedDispatchId) return false;
    const res = await authFetch("/api/gratuity/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dispatch_id: selectedDispatchId, note }),
    });
    if (!res.ok) return false;
    await refreshAfterSend();
    return true;
  };

  const deleteDispatch = async (): Promise<boolean> => {
    if (!selectedDispatchId) return false;
    const res = await authFetch(
      `/api/gratuity/dispatches/${selectedDispatchId}`,
      { method: "DELETE" }
    );
    if (!res.ok) return false;
    setSelectedDispatchId(null);
    await refreshAfterSend();
    return true;
  };

  const profileMissing =
    !profile?.slack_bot_token_preview ||
    !profile?.slack_user_token_preview ||
    !profile?.slack_connected_as;

  const devRedirectEmail =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_DEV_REDIRECT_EMAIL
      ? process.env.NEXT_PUBLIC_DEV_REDIRECT_EMAIL
      : null;

  const openSendForUpcoming = (employeeId: string) => {
    const match = eligible.find((e) => e.id === employeeId);
    if (match) setComposerEmployee(match);
  };

  if (loading) return <LoadingScreen message="Loading dashboard..." />;

  const empty =
    (stats?.totalEmployees ?? 0) === 0 &&
    eligible.length === 0 &&
    dispatches.length === 0;

  return (
    <div className="min-h-screen bg-stone-25 dark:bg-stone-950">
      {/* Header */}
      <header className="glass-header sticky top-0 z-50 border-b border-stone-100 dark:border-stone-800">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Tooltip label="Back" shortcut="Esc" align="start">
              <Link href="/">
                <Button
                  variant="ghost"
                  size="xs"
                  icon={<ArrowLeft className="h-3.5 w-3.5" />}
                >
                  Back
                </Button>
              </Link>
            </Tooltip>
            <div className="h-5 w-px bg-stone-150 dark:bg-stone-800" />
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-coral-400 to-coral-600 shadow-sm shadow-coral-500/20">
                <FileText className="h-4 w-4 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight text-stone-900 dark:text-stone-100">
                  Gratuity Forms
                </h1>
                <p className="text-[10px] text-stone-400 dark:text-stone-500">
                  Dispatch & compliance tracking
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<FileText className="h-3.5 w-3.5" />}
              onClick={() => setTemplatesOpen(true)}
            >
              Templates
            </Button>
            <Button
              size="sm"
              icon={<Send className="h-3.5 w-3.5" />}
              onClick={() => setPickerOpen(true)}
            >
              Send Form
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 page-enter">
        {empty ? (
          <EmptyState
            icon={<FileText className="h-8 w-8" />}
            title="No data yet"
            description="Sync employees from Zoho People to get started with gratuity form automation."
          />
        ) : (
          <>
            {/* Stats Row */}
            <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard
                label="Total Employees"
                value={stats?.totalEmployees ?? 0}
                subtitle={`${stats?.activeEmployees ?? 0} active`}
                icon={<Users className="h-4 w-4 text-stone-400" />}
              />
              <StatCard
                label="Pending"
                value={stats?.formsPending ?? 0}
                icon={<Clock className="h-4 w-4 text-amber-500" />}
                iconBg="bg-amber-50 dark:bg-amber-950/50"
                trend={
                  (stats?.formsOverdue ?? 0) > 0
                    ? {
                        text: `${stats?.formsOverdue} overdue`,
                        type: "warning",
                      }
                    : { text: "None overdue", type: "positive" }
                }
              />
              <StatCard
                label="Sent"
                value={stats?.formsSent ?? 0}
                subtitle="Active dispatches"
                icon={<Send className="h-4 w-4 text-blue-500" />}
                iconBg="bg-blue-50 dark:bg-blue-950/50"
              />
              <StatCard
                label="Completed"
                value={stats?.formsCompleted ?? 0}
                icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                iconBg="bg-emerald-50 dark:bg-emerald-950/50"
                trend={{
                  text: `${stats?.upcomingAnniversaries ?? 0} upcoming`,
                  type: "neutral",
                }}
              />
            </div>

            {/* Form Breakdown */}
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-stone-300 dark:text-stone-600" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                Form Breakdown
              </h2>
            </div>
            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {breakdown.map((fb) => {
                const cfg = FORM_CONFIGS[fb.type];
                const Icon = iconMap[cfg.icon] || FileText;
                const pct =
                  fb.sent > 0
                    ? Math.round((fb.completed / fb.sent) * 100)
                    : 0;
                const barColor =
                  fb.type === "F"
                    ? "from-blue-400 to-blue-600"
                    : fb.type === "I"
                      ? "from-emerald-400 to-emerald-600"
                      : fb.type === "J"
                        ? "from-amber-400 to-amber-600"
                        : "from-rose-400 to-rose-600";
                return (
                  <Card key={fb.type} interactive>
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-xl ${cfg.bgColor}`}
                        >
                          <Icon className={`h-5 w-5 ${cfg.color}`} />
                        </div>
                        <div>
                          <p
                            className={`text-sm font-bold tracking-tight ${cfg.color}`}
                          >
                            {cfg.name}
                          </p>
                          <p className="text-[10px] text-stone-400">
                            {cfg.fullName}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-stone-300 transition-transform group-hover:translate-x-0.5 dark:text-stone-600" />
                    </div>
                    <div className="mb-2.5 h-2 w-full overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] font-medium text-stone-400">
                      <span>
                        {fb.completed}/{fb.sent} done
                      </span>
                      {fb.overdue > 0 && (
                        <span className="text-red-500">
                          {fb.overdue} overdue
                        </span>
                      )}
                      {fb.pending > 0 && fb.overdue === 0 && (
                        <span className="text-amber-500">
                          {fb.pending} pending
                        </span>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Employee table — eligibility, multi-select, send */}
            <EmployeeTable
              employees={eligible}
              onSend={(emp) => setComposerEmployee(emp)}
              onOpenDispatch={(id) => setSelectedDispatchId(id)}
            />
          </>
        )}
      </main>

      {/* Employee picker (for Send Form Manually) */}
      <EmployeePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        employees={eligible}
        onPick={(emp) => {
          setPickerOpen(false);
          setComposerEmployee(emp);
        }}
      />

      {/* Composer (send form F or reminder) */}
      <Composer
        open={!!composerEmployee}
        onClose={() => {
          setComposerEmployee(null);
          setComposerMessageType("initial");
        }}
        employee={composerEmployee}
        templates={templates}
        messageType={composerMessageType}
        authFetch={authFetch}
        canSend={!profileMissing}
        profileMissing={profileMissing}
        devRedirectEmail={devRedirectEmail}
        onSent={async () => {
          setComposerEmployee(null);
          setComposerMessageType("initial");
          await refreshAfterSend();
        }}
      />

      {/* Template manager (admin-only edit) */}
      <TemplateManager
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        templates={templates}
        onSave={saveTemplate}
        authFetch={authFetch}
        onAttachmentAdded={async () => {
          const tRes = await authFetch("/api/gratuity/templates");
          if (tRes.ok) setTemplates(await tRes.json());
        }}
        onAttachmentRemoved={async () => {
          const tRes = await authFetch("/api/gratuity/templates");
          if (tRes.ok) setTemplates(await tRes.json());
        }}
        canEdit={isAdmin}
      />

      {/* Dispatch detail panel */}
      <DispatchDetail
        open={!!selectedDispatchId}
        onClose={() => setSelectedDispatchId(null)}
        dispatch={selectedDispatch}
        isAdmin={isAdmin}
        onSendReminder={(t) => {
          setSelectedDispatchId(null);
          openReminderComposer(t);
        }}
        onMarkComplete={markComplete}
        onDelete={deleteDispatch}
      />
    </div>
  );
}
