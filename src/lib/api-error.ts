import { NextResponse } from "next/server";

/**
 * Wrap an API route handler to convert uncaught exceptions into a friendly
 * JSON response instead of Next.js's default "Internal Server Error" HTML.
 *
 * Usage:
 *   export const GET = withErrorHandler(async (req) => { ... });
 */
export function withErrorHandler<T extends unknown[]>(
  handler: (...args: T) => Promise<Response>
): (...args: T) => Promise<Response> {
  return async (...args: T) => {
    try {
      return await handler(...args);
    } catch (err) {
      console.error("[api]", err);
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Something went wrong on our end. Please try again.";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}

/** Friendly wrapper for Supabase errors when the message would otherwise leak SQL detail. */
export function dbErrorMessage(err: { message?: string } | null | undefined): string {
  const msg = err?.message ?? "";
  if (!msg) return "We couldn't complete that request. Please try again.";
  // Hide low-level Postgres detail from the user; log it on the server.
  if (/duplicate key|violates unique/i.test(msg)) return "That record already exists.";
  if (/violates foreign key/i.test(msg)) return "That reference is invalid or no longer exists.";
  if (/not found/i.test(msg)) return "We couldn't find that record.";
  return msg;
}
