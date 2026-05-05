import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase";
import {
  ZOHO_PII_KEYS,
  type ZohoEmployee,
  type ZohoSyncResponse,
} from "@/lib/types";

const ZOHO_EDGE_URL = process.env.ZOHO_EDGE_FUNCTION_URL;

function parseZohoDate(raw: string): string | null {
  if (!raw || raw.trim() === "") return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0];
}

function stripPII(emp: ZohoEmployee): Record<string, unknown> {
  const out: Record<string, unknown> = { ...emp };
  for (const k of ZOHO_PII_KEYS) delete out[k];
  return out;
}

function normalizeEmpType(raw: string): "FT" | "Contract" | "Intern" {
  const v = (raw || "").trim();
  if (v === "Contract" || v === "Intern") return v;
  return "FT";
}

async function requireAdmin(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return { error: "Unauthorized", status: 401 as const };

  const token = authHeader.replace("Bearer ", "");
  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const {
    data: { user },
    error,
  } = await supabaseAuth.auth.getUser(token);
  if (error || !user) return { error: "Unauthorized", status: 401 as const };

  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return { error: "Admin only", status: 403 as const };
  return { userId: user.id };
}

/**
 * POST /api/sync/zoho — admin only.
 * Full refresh from the Zoho edge function. Strips PII, detects exits by diff,
 * resolves manager_id in a second pass. Returns the run counts in the response.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createServiceClient();
  const today = new Date().toISOString().split("T")[0];

  if (!ZOHO_EDGE_URL) {
    return NextResponse.json(
      { error: "ZOHO_EDGE_FUNCTION_URL is not configured" },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(ZOHO_EDGE_URL, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Zoho edge function ${res.status}: ${await res.text()}`);
    }
    const payload: ZohoSyncResponse = await res.json();
    const incoming = payload.employees ?? [];

    // Snapshot existing active employees for exit-diff
    const { data: existingActive } = await supabase
      .from("employees")
      .select("id, emp_id")
      .eq("status", "active");
    const existingByEmpId = new Map(
      (existingActive ?? []).map((e) => [e.emp_id as string, e.id as string])
    );

    let created = 0;
    let updated = 0;
    let errors = 0;
    const incomingEmpIds = new Set<string>();
    const managerResolve: { id: string; manager_email: string }[] = [];

    for (const emp of incoming) {
      try {
        const doj = parseZohoDate(emp.date_of_joining);
        if (!doj) {
          errors++;
          continue;
        }
        const exit = parseZohoDate(emp.date_of_exit);
        const empId = (emp.emp_id || "").trim();
        if (!empId) {
          errors++;
          continue;
        }
        incomingEmpIds.add(empId);

        const row = {
          emp_id: empId,
          email: (emp.email || "").toLowerCase().trim(),
          first_name: emp.first_name || "",
          last_name: emp.last_name || "",
          nick_name: emp.nick_name || null,
          department: emp.department || "",
          business_unit: emp.business_unit || "",
          designation: emp.designation || "",
          employment_type: normalizeEmpType(emp.employment_type),
          location: emp.location || "",
          seating_location: emp.seating_location || null,
          reporting_manager_email:
            (emp.reporting_manager_email || "").toLowerCase().trim() || null,
          date_of_joining: doj,
          date_of_exit: exit,
          onboarding_status: emp.onboarding_status || null,
          status: exit ? "exited" : "active",
          zoho_raw: stripPII(emp),
          last_synced_at: new Date().toISOString(),
        };

        const wasExisting = existingByEmpId.has(empId);
        const { data: up, error: upErr } = await supabase
          .from("employees")
          .upsert(row, { onConflict: "emp_id" })
          .select("id, reporting_manager_email")
          .single();

        if (upErr || !up) {
          console.error(`[sync] upsert failed for ${empId}:`, upErr?.message);
          errors++;
          continue;
        }
        if (wasExisting) updated++;
        else created++;

        if (up.reporting_manager_email) {
          managerResolve.push({
            id: up.id as string,
            manager_email: up.reporting_manager_email as string,
          });
        }
      } catch (e) {
        console.error(`[sync] processing error for ${emp.email}:`, e);
        errors++;
      }
    }

    // Second pass — resolve manager_id by matching email → employee row
    if (managerResolve.length) {
      const emails = Array.from(
        new Set(managerResolve.map((m) => m.manager_email))
      );
      const { data: managers } = await supabase
        .from("employees")
        .select("id, email")
        .in("email", emails);
      const emailToId = new Map(
        (managers ?? []).map((m) => [m.email as string, m.id as string])
      );
      for (const { id, manager_email } of managerResolve) {
        const mid = emailToId.get(manager_email);
        if (mid && mid !== id) {
          await supabase.from("employees").update({ manager_id: mid }).eq("id", id);
        }
      }
    }

    // Exit detection — active in DB but missing from latest payload → exited
    const toExit = (existingActive ?? []).filter(
      (e) => !incomingEmpIds.has(e.emp_id as string)
    );
    let exited = 0;
    if (toExit.length) {
      const { error: exitErr } = await supabase
        .from("employees")
        .update({ status: "exited", date_of_exit: today })
        .in(
          "id",
          toExit.map((e) => e.id)
        );
      if (!exitErr) exited = toExit.length;
    }

    return NextResponse.json({
      success: true,
      total_fetched: incoming.length,
      created,
      updated,
      exited,
      errors,
      synced_at: payload.fetched_at,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/sync/zoho — current employee count + most-recent last_synced_at.
 */
export async function GET() {
  const supabase = createServiceClient();

  const { count } = await supabase
    .from("employees")
    .select("*", { count: "exact", head: true });

  const { data: recent } = await supabase
    .from("employees")
    .select("last_synced_at")
    .order("last_synced_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    totalEmployees: count ?? 0,
    lastSyncedAt: recent?.last_synced_at ?? null,
  });
}
