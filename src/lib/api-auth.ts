import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export interface AuthedUser {
  userId: string;
  email: string;
}

/**
 * Verifies the bearer token. Use on routes that any logged-in user can hit
 * (e.g. read-only dashboards). For role/grant checks use the dedicated
 * helpers (`requireGratuityAccess`, `requireAdmin`, etc).
 */
export async function requireUser(
  request: NextRequest
): Promise<{ user: AuthedUser } | { error: string; status: 401 }> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return { error: "Sign in to continue", status: 401 };

  const token = authHeader.replace("Bearer ", "");
  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const {
    data: { user },
    error,
  } = await supabaseAuth.auth.getUser(token);
  if (error || !user) return { error: "Your session has expired. Please sign in again.", status: 401 };

  return { user: { userId: user.id, email: user.email ?? "" } };
}
