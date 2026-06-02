"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type TextareaHTMLAttributes,
} from "react";
import { PLACEHOLDERS, type PlaceholderDef } from "@/lib/gratuity-templates";

/**
 * A textarea with `{{...}}` placeholder autocomplete.
 * Type `{{` and start any placeholder name → menu appears. Tab or Enter to
 * insert. ↑/↓ to navigate, Esc to close.
 *
 * Driven by PLACEHOLDERS in src/lib/gratuity-templates.ts — adding a new
 * placeholder there makes it appear here automatically.
 */
export interface TemplateTextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> {
  value: string;
  onChange: (next: string) => void;
}

export const TemplateTextarea = forwardRef<
  HTMLTextAreaElement,
  TemplateTextareaProps
>(function TemplateTextarea({ value, onChange, onKeyDown, ...rest }, ref) {
  const localRef = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => localRef.current as HTMLTextAreaElement, []);

  const [menuOpen, setMenuOpen] = useState(false);
  const [matches, setMatches] = useState<PlaceholderDef[]>([]);
  const [highlight, setHighlight] = useState(0);
  // Range to replace when an item is selected: [tokenStart, cursor]
  const tokenRange = useRef<{ start: number; end: number } | null>(null);

  /** Detect whether the cursor sits inside an open `{{token` and what token is typed so far. */
  const detectToken = useCallback((text: string, caret: number) => {
    // Walk back from caret looking for `{{` without a closing `}}` in between.
    const head = text.slice(0, caret);
    const open = head.lastIndexOf("{{");
    if (open === -1) return null;
    const between = head.slice(open + 2);
    if (between.includes("}}")) return null;
    // Only allow [a-z0-9_] as the typed token so {{ followed by punctuation/space cancels.
    if (!/^[a-z0-9_]*$/i.test(between)) return null;
    return { start: open, partial: between.toLowerCase() };
  }, []);

  const updateMenu = useCallback(() => {
    const ta = localRef.current;
    if (!ta) return;
    const caret = ta.selectionStart ?? 0;
    const token = detectToken(ta.value, caret);
    if (!token) {
      setMenuOpen(false);
      tokenRange.current = null;
      return;
    }
    const filtered = PLACEHOLDERS.filter((p) =>
      p.key.toLowerCase().startsWith(token.partial)
    );
    if (filtered.length === 0) {
      setMenuOpen(false);
      tokenRange.current = null;
      return;
    }
    // Only reset highlight when the candidate set actually changed —
    // otherwise arrow navigation gets clobbered on every keyup.
    setMatches((prev) => {
      const sameSet =
        prev.length === filtered.length &&
        prev.every((p, i) => p.key === filtered[i].key);
      if (!sameSet) setHighlight(0);
      return sameSet ? prev : filtered;
    });
    setMenuOpen(true);
    tokenRange.current = { start: token.start, end: caret };
  }, [detectToken]);

  /** Insert {{key}} at the active token range. */
  const insertPlaceholder = useCallback(
    (def: PlaceholderDef) => {
      const ta = localRef.current;
      const range = tokenRange.current;
      if (!ta || !range) return;
      const before = value.slice(0, range.start);
      const after = value.slice(range.end);
      const inserted = `{{${def.key}}}`;
      const next = before + inserted + after;
      onChange(next);
      setMenuOpen(false);
      tokenRange.current = null;
      // Restore caret after the inserted text on next paint.
      requestAnimationFrame(() => {
        const pos = before.length + inserted.length;
        ta.focus();
        ta.setSelectionRange(pos, pos);
      });
    },
    [value, onChange]
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (menuOpen && matches.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => (h + 1) % matches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => (h - 1 + matches.length) % matches.length);
        return;
      }
      if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        insertPlaceholder(matches[highlight]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMenuOpen(false);
        return;
      }
    }
    onKeyDown?.(e);
  };

  // Re-detect on cursor move / focus (selection changes don't fire onChange).
  useEffect(() => {
    const ta = localRef.current;
    if (!ta) return;
    const handler = () => updateMenu();
    ta.addEventListener("keyup", handler);
    ta.addEventListener("click", handler);
    return () => {
      ta.removeEventListener("keyup", handler);
      ta.removeEventListener("click", handler);
    };
  }, [updateMenu]);

  // Hide menu when textarea loses focus (delayed so click-on-item still works).
  const handleBlur = () => {
    setTimeout(() => setMenuOpen(false), 100);
  };

  return (
    <div className="relative">
      <textarea
        {...rest}
        ref={localRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          // Defer to let the value land before recomputing.
          requestAnimationFrame(updateMenu);
        }}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />

      {menuOpen && (
        <div className="absolute z-20 mt-1 w-72 overflow-hidden rounded-xl border border-stone-150 bg-white shadow-elevated dark:border-stone-700 dark:bg-stone-850">
          <div className="border-b border-stone-100 bg-stone-50/60 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:border-stone-800 dark:bg-stone-900/50">
            Insert placeholder · Tab to confirm
          </div>
          <ul className="max-h-60 overflow-y-auto py-1">
            {matches.map((m, i) => (
              <li key={m.key}>
                <button
                  type="button"
                  // Use mousedown so the textarea doesn't blur first and lose tokenRange.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertPlaceholder(m);
                  }}
                  onMouseEnter={() => setHighlight(i)}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs transition-colors ${
                    i === highlight
                      ? "bg-coral-50 text-coral-700 dark:bg-coral-700/25 dark:text-coral-200"
                      : "text-stone-700 hover:bg-stone-50 dark:text-stone-200 dark:hover:bg-stone-800"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[10px] text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                        {`{{${m.key}}}`}
                      </code>
                      <span className="truncate font-medium">{m.label}</span>
                    </div>
                    <div className="mt-0.5 truncate text-[10px] text-stone-400">
                      e.g. {m.sample}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
});

/** Convenience: Tip line shown under the textarea. */
export function PlaceholderHint() {
  const sample = useMemo(
    () => PLACEHOLDERS.slice(0, 3).map((p) => `{{${p.key}}}`).join(", "),
    []
  );
  return (
    <p className="text-[10px] text-stone-400 dark:text-stone-500">
      Tip — type <code className="rounded bg-stone-100 px-1 font-mono dark:bg-stone-800">{"{{"}</code>{" "}
      to autocomplete a placeholder (e.g. {sample}). Tab to insert.
    </p>
  );
}
