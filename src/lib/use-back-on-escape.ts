"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Navigates to `target` (default "/") when Escape is pressed.
 * Ignores the shortcut when the user is typing in an input/textarea/
 * contenteditable, so modals and forms can still use Esc locally.
 */
export function useBackOnEscape(target: string = "/") {
  const router = useRouter();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const el = document.activeElement as HTMLElement | null;
      if (el) {
        const tag = el.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          el.isContentEditable
        ) {
          return;
        }
      }
      router.push(target);
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router, target]);
}
