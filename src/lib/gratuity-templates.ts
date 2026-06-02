import type { Employee } from "@/lib/types";

/**
 * Single source of truth for template placeholders.
 *
 * To add a new placeholder available in templates and the autocomplete UI,
 * append one entry here. Both the substitution engine (`substituteTemplate`)
 * and the editor autocomplete read from this list — nothing else to wire.
 */
export interface PlaceholderDef {
  /** Inner key — what appears between {{ and }} in the template */
  key: string;
  /** Short label shown in the autocomplete menu */
  label: string;
  /** Example value rendered as a hint in the menu */
  sample: string;
  /** Pull the value from an employee record */
  getValue: (employee: PlaceholderEmployee) => string;
}

export type PlaceholderEmployee = Pick<
  Employee,
  "first_name" | "last_name" | "emp_id" | "date_of_joining"
>;

export const PLACEHOLDERS: PlaceholderDef[] = [
  {
    key: "first_name",
    label: "First name",
    sample: "Aviral",
    getValue: (e) => e.first_name ?? "",
  },
  {
    key: "last_name",
    label: "Last name",
    sample: "Gupta",
    getValue: (e) => e.last_name ?? "",
  },
  {
    key: "emp_id",
    label: "Employee ID",
    sample: "HV1234",
    getValue: (e) => e.emp_id ?? "",
  },
  {
    key: "joining_date",
    label: "Joining date",
    sample: "12 Jan 2022",
    getValue: (e) => formatDate(e.date_of_joining),
  },
  {
    key: "service_years",
    label: "Years of service",
    sample: "3",
    getValue: (e) => String(computeServiceYears(e.date_of_joining)),
  },
];

/** Render `{{key}}` strings — used for chip lists / placeholder hints. */
export const PLACEHOLDER_TOKENS = PLACEHOLDERS.map((p) => `{{${p.key}}}`);

/**
 * Substitute placeholders in a template body with values from an employee.
 * Driven by the PLACEHOLDERS registry so new entries flow through automatically.
 */
export function substituteTemplate(
  body: string,
  employee: PlaceholderEmployee
): string {
  let out = body;
  for (const p of PLACEHOLDERS) {
    out = out.replaceAll(`{{${p.key}}}`, p.getValue(employee));
  }
  return out;
}

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function computeServiceYears(iso: string): number {
  if (!iso) return 0;
  const join = new Date(iso);
  if (isNaN(join.getTime())) return 0;
  const now = new Date();
  let years = now.getFullYear() - join.getFullYear();
  const m = now.getMonth() - join.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < join.getDate())) years--;
  return Math.max(0, years);
}
