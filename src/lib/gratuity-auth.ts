import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase";

export interface GratuityActor {
  userId: string;
  role: string;
  isAdmin: boolean;
}

/**
 * Shared permission check for all gratuity mutations.
 * - Validates the bearer token and looks up the user.
 * - Admins are always allowed.
 * - Non-admins must have a gratuity grant in the `automations` table.
 *
 * Returns { actor } on success, or { error, status } to short-circuit the route.
 */
export async function requireGratuityAccess(
  request: NextRequest
): Promise<
  | { actor: GratuityActor }
  | { error: string; status: 401 | 403 }
> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return { error: "Unauthorized", status: 401 };

  const token = authHeader.replace("Bearer ", "");
  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const {
    data: { user },
    error,
  } = await supabaseAuth.auth.getUser(token);
  if (error || !user) return { error: "Unauthorized", status: 401 };

  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();

  if (!profile) return { error: "Profile not found", status: 401 };

  const isAdmin = profile.role === "admin";
  if (isAdmin) {
    return { actor: { userId: user.id, role: "admin", isAdmin: true } };
  }

  // Non-admin — must have gratuity grant
  const { data: grant } = await supabase
    .from("automations")
    .select("id")
    .eq("user_id", user.id)
    .eq("automation_id", "gratuity")
    .maybeSingle();

  if (!grant) {
    return { error: "You need gratuity access to do this", status: 403 };
  }

  return { actor: { userId: user.id, role: profile.role, isAdmin: false } };
}
