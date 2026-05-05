import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { requireGratuityAccess } from "@/lib/gratuity-auth";

/**
 * GET /api/gratuity/dispatches
 * Returns all Form F dispatches with the employee + message history in one hit.
 */
export async function GET(request: NextRequest) {
  const auth = await requireGratuityAccess(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createServiceClient();

  const { data: dispatches, error } = await supabase
    .from("gratuity_dispatches")
    .select(
      "*, employee:employees(id, emp_id, first_name, last_name, email, department, designation, date_of_joining)"
    )
    .eq("form_type", "F")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ids = (dispatches ?? []).map((d) => d.id as string);
  const { data: messages } = await supabase
    .from("gratuity_messages")
    .select(
      "*, sender:user_profiles!gratuity_messages_sent_by_fkey(id, name, email)"
    )
    .in("dispatch_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
    .order("sent_at", { ascending: true });

  const messagesByDispatch = new Map<string, unknown[]>();
  for (const m of messages ?? []) {
    const arr = messagesByDispatch.get(m.dispatch_id as string) ?? [];
    arr.push(m);
    messagesByDispatch.set(m.dispatch_id as string, arr);
  }

  const result = (dispatches ?? []).map((d) => ({
    ...d,
    messages: messagesByDispatch.get(d.id as string) ?? [],
  }));

  return NextResponse.json(result);
}
