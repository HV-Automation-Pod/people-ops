import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { requireGratuityAccess } from "@/lib/gratuity-auth";
import type { EligibleEmployee } from "@/lib/types";

/**
 * GET /api/gratuity/eligible
 * Active employees with 1+ years of service, with their current Form F
 * dispatch status (if any).
 */
export async function GET(request: NextRequest) {
  const auth = await requireGratuityAccess(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createServiceClient();

  // Employees: active only
  const { data: employees, error: eErr } = await supabase
    .from("employees")
    .select(
      "id, emp_id, email, first_name, last_name, department, designation, date_of_joining"
    )
    .eq("status", "active")
    .order("date_of_joining", { ascending: true });

  if (eErr) {
    return NextResponse.json({ error: eErr.message }, { status: 500 });
  }

  // Existing Form F dispatches (keyed by employee_id)
  const { data: dispatches } = await supabase
    .from("gratuity_dispatches")
    .select("id, employee_id, status")
    .eq("form_type", "F");
  const dispatchMap = new Map(
    (dispatches ?? []).map((d) => [
      d.employee_id as string,
      { id: d.id as string, status: d.status as "pending" | "completed" },
    ])
  );

  const today = new Date();
  const result: EligibleEmployee[] = (employees ?? [])
    .map((e) => {
      const doj = new Date(e.date_of_joining);
      let years = today.getFullYear() - doj.getFullYear();
      const m = today.getMonth() - doj.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < doj.getDate())) years--;
      years = Math.max(0, years);
      return {
        id: e.id as string,
        emp_id: e.emp_id as string,
        email: e.email as string,
        first_name: e.first_name as string,
        last_name: e.last_name as string,
        department: e.department as string,
        designation: e.designation as string,
        date_of_joining: e.date_of_joining as string,
        service_years: years,
        dispatch_status: dispatchMap.get(e.id as string)?.status ?? null,
        dispatch_id: dispatchMap.get(e.id as string)?.id ?? null,
      };
    })
    .filter((e) => e.service_years >= 1);

  return NextResponse.json(result);
}
