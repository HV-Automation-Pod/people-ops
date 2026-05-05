import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { requireGratuityAccess } from "@/lib/gratuity-auth";

/**
 * GET /api/gratuity/templates — list all templates (gratuity access required).
 */
export async function GET(request: NextRequest) {
  const auth = await requireGratuityAccess(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("gratuity_templates")
    .select("*")
    .order("form_type")
    .order("template_key");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}
