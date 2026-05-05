import type { Employee } from "@/lib/types";

/**
 * Substitute placeholders in a template body with values from an employee.
 * Supported placeholders:
 *   {{first_name}}   — employee.first_name
 *   {{last_name}}    — employee.last_name
 *   {{emp_id}}       — employee.emp_id
 *   {{joining_date}} — employee.date_of_joining formatted "DD Mon YYYY"
 *   {{service_years}} — floor(years since date_of_joining)
 *
 * Returns the body unchanged if template is empty.
 */
export function substituteTemplate(
  body: string,
  employee: Pick<
    Employee,
    "first_name" | "last_name" | "emp_id" | "date_of_joining"
  >
): string {
  const joiningDate = formatDate(employee.date_of_joining);
  const serviceYears = computeServiceYears(employee.date_of_joining);

  return body
    .replaceAll("{{first_name}}", employee.first_name ?? "")
    .replaceAll("{{last_name}}", employee.last_name ?? "")
    .replaceAll("{{emp_id}}", employee.emp_id ?? "")
    .replaceAll("{{joining_date}}", joiningDate)
    .replaceAll("{{service_years}}", String(serviceYears));
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
