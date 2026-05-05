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

  const { data, error } = await supabase
    .from("form_dispatches")
    .select("*, employee:employees(id, first_name, last_name, email, department, designation)")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: dbErrorMessage(error) }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
});
