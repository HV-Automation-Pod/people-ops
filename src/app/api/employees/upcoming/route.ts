import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { requireUser } from "@/lib/api-auth";
import { withErrorHandler, dbErrorMessage } from "@/lib/api-error";

export const GET = withErrorHandler(async (request: NextRequest) => {
  const auth = await requireUser(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createServiceClient();

  const { data: employees, error } = await supabase
    .from("employees")
    .select("id, first_name, last_name, email, date_of_joining, department, designation")
    .eq("status", "active")
    .order("date_of_joining", { ascending: true });

  if (error) {
    return NextResponse.json({ error: dbErrorMessage(error) }, { status: 500 });
  }

  const today = new Date();
  const upcoming = (employees ?? [])
    .map((emp) => {
      const joinDate = new Date(emp.date_of_joining);
      const anniversary = new Date(joinDate);
      anniversary.setFullYear(today.getFullYear());
      if (anniversary < today) anniversary.setFullYear(today.getFullYear() + 1);

      const diffMs = anniversary.getTime() - today.getTime();
      const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      const yearsCompleting = anniversary.getFullYear() - joinDate.getFullYear();

      return {
        ...emp,
        name: `${emp.first_name} ${emp.last_name}`.trim(),
        anniversaryDate: anniversary.toISOString().split("T")[0],
        daysLeft,
        yearsCompleting,
      };
    })
    .filter((emp) => emp.daysLeft >= 0 && emp.daysLeft <= 30)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  return NextResponse.json(upcoming);
});
