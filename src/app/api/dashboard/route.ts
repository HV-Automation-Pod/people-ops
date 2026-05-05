import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

/**
 * GET /api/dashboard
 *
 * Aggregates for the gratuity dashboard. Counts reflect gratuity_dispatches,
 * which is the per-automation workflow table. When more forms are built
 * (I/J/K), they'll share the same status model.
 */
export async function GET() {
  const supabase = createServiceClient();

  const [employeesRes, dispatchesRes] = await Promise.all([
    supabase.from("employees").select("id, status, date_of_joining"),
    supabase
      .from("gratuity_dispatches")
      .select("id, status, form_type, created_at"),
  ]);

  const employees = employeesRes.data ?? [];
  const dispatches = dispatchesRes.data ?? [];

  const totalEmployees = employees.length;
  const activeEmployees = employees.filter((e) => e.status === "active").length;

  const formsPending = dispatches.filter((d) => d.status === "pending").length;
  const formsSent = formsPending; // in the new model, "sent but not completed" == pending
  const formsCompleted = dispatches.filter((d) => d.status === "completed").length;
  const formsOverdue = 0; // overdue is computed in UI if needed

  // Upcoming anniversaries (next 30 days)
  const today = new Date();
  const thirtyDaysLater = new Date(today);
  thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

  const upcomingAnniversaries = employees.filter((e) => {
    if (e.status !== "active" || !e.date_of_joining) return false;
    const joinDate = new Date(e.date_of_joining);
    const anniversary = new Date(joinDate);
    anniversary.setFullYear(today.getFullYear());
    if (anniversary < today) anniversary.setFullYear(today.getFullYear() + 1);
    return anniversary >= today && anniversary <= thirtyDaysLater;
  }).length;

  // Per-form-type breakdown
  const formBreakdown = (["F", "I", "J", "K"] as const).map((type) => {
    const typed = dispatches.filter((d) => d.form_type === type);
    return {
      type,
      sent: typed.length,
      completed: typed.filter((d) => d.status === "completed").length,
      pending: typed.filter((d) => d.status === "pending").length,
      overdue: 0,
    };
  });

  return NextResponse.json({
    stats: {
      totalEmployees,
      activeEmployees,
      formsPending,
      formsSent,
      formsCompleted,
      formsOverdue,
      upcomingAnniversaries,
    },
    formBreakdown,
  });
}
