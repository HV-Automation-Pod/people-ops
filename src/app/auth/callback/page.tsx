"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase-browser";
import { LoadingScreen } from "@/components/ui/loading-screen";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createBrowserClient();

    const finish = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const errorDesc = params.get("error_description");

      if (errorDesc) {
        router.replace(`/login?error=${encodeURIComponent(errorDesc)}`);
        return;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          router.replace(`/login?error=${encodeURIComponent(error.message)}`);
          return;
        }
      }

      router.replace("/");
    };

    finish();
  }, [router]);

  return <LoadingScreen message="Signing you in..." />;
}
