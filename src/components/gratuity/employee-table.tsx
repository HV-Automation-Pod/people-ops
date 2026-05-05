"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Send,
  CheckCircle2,
  Clock,
  AlertTriangle,
  X,
  Filter,
  Users,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { clsx } from "clsx";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import type { EligibleEmployee } from "@/lib/types";

type Tab = "needs" | "in_progress" | "completed" | "all";
type SortKey = "name" | "dept" | "tenure" | "joined" | "status";
type SortDir = "asc" | "desc";

const TAB_CONFIG: Record<
  Tab,
  { label: string; description: string; icon: React.ElementType; color: string }
> = {
  needs: {
    label: "Needs Form F",
    description: "Eligible, no dispatch yet",
    icon: AlertTriangle,
    color: "text-amber-500",
  },
  in_progress: {
    label: "In progress",
    description: "Sent, awaiting completion",
    icon: Clock,
    color: "text-blue-500",
  },
  completed: {
    label: "Completed",
    description: "Form collected & filed",
    icon: CheckCircle2,
    color: "text-emerald-500",
  },
  all: {
    label: "All eligible",
    description: "Every employee with 1+ year of service",
    icon: Users,
    color: "text-stone-400",
  },
};

function fmtDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function tenureBadge(years: number): { label: string; variant: "muted" | "blue" | "violet" | "coral" | "emerald" | "amber" } {
  if (years < 1) return { label: "<1y", variant: "amber" };
  if (years === 1) return { label: "1y", variant: "blue" };
  if (years < 3) return { label: `${years}y`, variant: "violet" };
  if (years < 5) return { label: `${years}y`, variant: "coral" };
  return { label: `${years}y`, variant: "emerald" };
}

function categorize(
  emp: EligibleEmployee
): "needs" | "in_progress" | "completed" {
  if (emp.dispatch_status === "completed") return "completed";
  if (emp.dispatch_status === "pending") return "in_progress";
  return "needs";
}

export function EmployeeTable({
  employees,
  onSend,
  onOpenDispatch,
}: {
  employees: EligibleEmployee[];
  onSend: (emp: EligibleEmployee) => void;
  onOpenDispatch: (dispatchId: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("needs");
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deptOpen, setDeptOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("tenure");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const PAGE_SIZE = 10;

  // Reset to first page whenever filters or sort change
  useEffect(() => {
    setPage(0);
  }, [tab, dept, query, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "tenure" ? "desc" : "asc");
    }
  };

  // Counts per tab (unfiltered by search/dept so the count is stable)
  const counts = useMemo(() => {
    const c = { needs: 0, in_progress: 0, completed: 0, all: employees.length };
    for (const e of employees) {
      c[categorize(e)]++;
    }
    return c;
  }, [employees]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const e of employees) {
      if (e.department) set.add(e.department);
    }
    return Array.from(set).sort();
  }, [employees]);

  // Filtered + sorted rows (all pages combined)
  const rows = useMemo(() => {
    let xs = employees.slice();
    if (tab !== "all") xs = xs.filter((e) => categorize(e) === tab);
    if (dept !== "all") xs = xs.filter((e) => e.department === dept);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      xs = xs.filter((e) =>
        `${e.first_name} ${e.last_name} ${e.emp_id} ${e.email} ${e.department}`
          .toLowerCase()
          .includes(q)
      );
    }

    // Sort
    const dir = sortDir === "asc" ? 1 : -1;
    xs.sort((a, b) => {
      const cmp = (() => {
        switch (sortKey) {
          case "name":
            return `${a.first_name} ${a.last_name}`.localeCompare(
              `${b.first_name} ${b.last_name}`
            );
          case "dept":
            return a.department.localeCompare(b.department);
          case "tenure":
            return a.service_years - b.service_years;
          case "joined":
            return (
              new Date(a.date_of_joining).getTime() -
              new Date(b.date_of_joining).getTime()
            );
          case "status": {
            const rank = (e: EligibleEmployee) =>
              e.dispatch_status === "completed"
                ? 2
                : e.dispatch_status === "pending"
                  ? 1
                  : 0;
            return rank(a) - rank(b);
          }
        }
      })();
      return cmp * dir;
    });
    return xs;
  }, [employees, tab, dept, query, sortKey, sortDir]);

  // Pagination slice
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = rows.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const pageIds = useMemo(() => pageRows.map((r) => r.id), [pageRows]);
  const selectableRows = useMemo(
    () => pageRows.filter((r) => r.dispatch_status !== "completed"),
    [pageRows]
  );
  const selectableIds = useMemo(
    () => new Set(selectableRows.map((r) => r.id)),
    [selectableRows]
  );

  const allSelected =
    selectableRows.length > 0 &&
    selectableRows.every((r) => selected.has(r.id));
  const someSelected =
    !allSelected && selectableRows.some((r) => selected.has(r.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of selectableIds) next.delete(id);
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of selectableIds) next.add(id);
        return next;
      });
    }
  };

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const selectedCount = Array.from(selected).filter((id) =>
    pageIds.includes(id)
  ).length;
  const totalSelectedInFilter = Array.from(selected).filter((id) =>
    rows.some((r) => r.id === id)
  ).length;

  return (
    <div className="rounded-2xl border border-stone-100 bg-white shadow-soft dark:border-stone-800 dark:bg-stone-850">
      {/* Header — title + search + dept filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-5 py-4 dark:border-stone-800">
        <div>
          <h2 className="text-sm font-bold tracking-tight text-stone-900 dark:text-stone-100">
            Form F · Nominations
          </h2>
          <p className="mt-0.5 text-[11px] text-stone-400 dark:text-stone-500">
            Employees with 1+ year of service, sorted by longest tenure first.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, dept, emp id…"
              className="!py-1.5 !pl-9 !text-xs w-56"
            />
          </div>
          <div className="relative">
            <button
              onClick={() => setDeptOpen(!deptOpen)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-stone-150 bg-white px-3 py-2 text-xs font-semibold text-stone-600 shadow-soft transition-colors hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-750"
            >
              <Filter className="h-3 w-3" />
              {dept === "all" ? "All depts" : dept}
              <ChevronDown className="h-3 w-3 text-stone-400" />
            </button>
            {deptOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setDeptOpen(false)}
                />
                <div className="animate-scale-in absolute right-0 top-full z-20 mt-2 max-h-72 w-52 overflow-y-auto rounded-xl border border-stone-100 bg-white p-1.5 shadow-float dark:border-stone-700 dark:bg-stone-800">
                  <button
                    onClick={() => {
                      setDept("all");
                      setDeptOpen(false);
                    }}
                    className={clsx(
                      "flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-1.5 text-left text-xs font-medium",
                      dept === "all"
                        ? "bg-coral-50 text-coral-600 dark:bg-coral-700/15 dark:text-coral-400"
                        : "text-stone-500 hover:bg-stone-50 hover:text-stone-700 dark:text-stone-400 dark:hover:bg-stone-750 dark:hover:text-stone-200"
                    )}
                  >
                    All departments
                    <span className="text-[10px] text-stone-300">
                      {employees.length}
                    </span>
                  </button>
                  {departments.map((d) => {
                    const n = employees.filter((e) => e.department === d).length;
                    return (
                      <button
                        key={d}
                        onClick={() => {
                          setDept(d);
                          setDeptOpen(false);
                        }}
                        className={clsx(
                          "flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-1.5 text-left text-xs font-medium",
                          dept === d
                            ? "bg-coral-50 text-coral-600 dark:bg-coral-700/15 dark:text-coral-400"
                            : "text-stone-500 hover:bg-stone-50 hover:text-stone-700 dark:text-stone-400 dark:hover:bg-stone-750 dark:hover:text-stone-200"
                        )}
                      >
                        {d}
                        <span className="text-[10px] text-stone-300">{n}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-stone-100 px-3 pt-3 dark:border-stone-800">
        {(Object.keys(TAB_CONFIG) as Tab[]).map((t) => {
          const c = TAB_CONFIG[t];
          const TI = c.icon;
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                "flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-t-xl border-b-2 px-4 py-2.5 text-xs font-semibold transition-all duration-150",
                active
                  ? "border-coral-500 text-stone-900 dark:text-stone-100"
                  : "border-transparent text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300"
              )}
            >
              <TI className={clsx("h-3.5 w-3.5", active ? c.color : "")} />
              {c.label}
              <span
                className={clsx(
                  "ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                  active
                    ? "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-200"
                    : "bg-stone-100 text-stone-400 dark:bg-stone-800 dark:text-stone-500"
                )}
              >
                {counts[t]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="px-5 py-16 text-center">
          <p className="text-sm text-stone-400 dark:text-stone-500">
            {query || dept !== "all"
              ? "No employees match the current filters."
              : tab === "needs"
                ? "Everyone's Form F is already in progress or completed."
                : tab === "completed"
                  ? "No completed dispatches yet."
                  : tab === "in_progress"
                    ? "No active dispatches."
                    : "No eligible employees."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-25/50 dark:border-stone-800 dark:bg-stone-900/50">
                <th className="w-10 px-4 py-3">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={toggleAll}
                    disabled={selectableRows.length === 0}
                    title={
                      selectableRows.length === 0
                        ? "Nothing to select"
                        : allSelected
                          ? "Deselect all"
                          : "Select all visible"
                    }
                  />
                </th>
                <SortableTh label="Employee" k="name" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <SortableTh label="Dept" k="dept" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <SortableTh label="Tenure" k="tenure" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <SortableTh label="Joined" k="joined" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <SortableTh label="Status" k="status" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((emp) => {
                const name = `${emp.first_name} ${emp.last_name}`.trim();
                const category = categorize(emp);
                const t = tenureBadge(emp.service_years);
                const isCompleted = emp.dispatch_status === "completed";
                const isPending = emp.dispatch_status === "pending";
                const isChecked = selected.has(emp.id);
                return (
                  <tr
                    key={emp.id}
                    className={clsx(
                      "border-b border-stone-75 transition-colors last:border-0 dark:border-stone-800/50",
                      isChecked
                        ? "bg-coral-50/40 dark:bg-coral-700/10"
                        : "hover:bg-stone-25/60 dark:hover:bg-stone-900/40"
                    )}
                  >
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={isChecked}
                        onChange={() => toggleRow(emp.id)}
                        disabled={isCompleted}
                        title={
                          isCompleted
                            ? "Already completed"
                            : isChecked
                              ? "Deselect"
                              : "Select"
                        }
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={name} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-stone-800 dark:text-stone-100">
                            {name}
                          </p>
                          <p className="truncate text-[10px] text-stone-400">
                            {emp.emp_id} · {emp.designation}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium text-stone-500 dark:text-stone-400">
                        {emp.department || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Badge variant={t.variant}>{t.label}</Badge>
                        {category === "needs" && emp.service_years >= 2 && (
                          <Tooltip
                            label={`Overdue by ${emp.service_years - 1}y`}
                            position="top"
                          >
                            <span className="flex h-1.5 w-1.5 flex-shrink-0 rounded-full bg-rose-500 animate-pulse-dot" />
                          </Tooltip>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-stone-400">
                        {fmtDate(emp.date_of_joining)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {isCompleted ? (
                        <Badge variant="emerald" dot>
                          Completed
                        </Badge>
                      ) : isPending ? (
                        <Badge variant="amber" dot>
                          In progress
                        </Badge>
                      ) : (
                        <Badge variant="muted">Not sent</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isCompleted || isPending ? (
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() =>
                            emp.dispatch_id && onOpenDispatch(emp.dispatch_id)
                          }
                        >
                          View
                        </Button>
                      ) : (
                        <Button
                          size="xs"
                          variant="primary"
                          icon={<Send className="h-3 w-3" />}
                          onClick={() => onSend(emp)}
                        >
                          Send
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination footer */}
          {rows.length > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t border-stone-100 px-5 py-3 dark:border-stone-800">
              <p className="text-[11px] text-stone-400 dark:text-stone-500">
                Showing{" "}
                <span className="font-semibold text-stone-600 dark:text-stone-300">
                  {safePage * PAGE_SIZE + 1}
                  {"–"}
                  {Math.min((safePage + 1) * PAGE_SIZE, rows.length)}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-stone-600 dark:text-stone-300">
                  {rows.length}
                </span>
              </p>
              <div className="flex items-center gap-1">
                <PageButton
                  label="Previous"
                  disabled={safePage === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </PageButton>
                <PaginationNumbers
                  current={safePage}
                  total={pageCount}
                  onChange={setPage}
                />
                <PageButton
                  label="Next"
                  disabled={safePage >= pageCount - 1}
                  onClick={() =>
                    setPage((p) => Math.min(pageCount - 1, p + 1))
                  }
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </PageButton>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sticky action bar for selection (counts across all pages) */}
      {selected.size > 0 && (
        <div className="sticky bottom-4 z-20 mx-4 mb-4 mt-3 flex items-center justify-between rounded-2xl border border-coral-200/60 bg-white/95 px-4 py-3 shadow-float backdrop-blur-sm dark:border-coral-700/30 dark:bg-stone-900/95">
          <div className="flex items-center gap-3">
            <span className="flex h-7 min-w-7 items-center justify-center rounded-lg bg-coral-50 px-2 text-xs font-bold text-coral-600 dark:bg-coral-700/15 dark:text-coral-400">
              {selected.size}
            </span>
            <span className="text-xs font-medium text-stone-600 dark:text-stone-300">
              {selected.size === 1 ? "employee" : "employees"} selected
              {totalSelectedInFilter !== selected.size && (
                <span className="ml-1 text-stone-400">
                  ({totalSelectedInFilter} in current filter)
                </span>
              )}
            </span>
            <button
              onClick={clearSelection}
              className="flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-stone-400 hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-stone-800 dark:hover:text-stone-300"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          </div>
          <Tooltip label="Bulk send · coming soon" position="top" align="end">
            <Button
              size="sm"
              variant="primary"
              icon={<Send className="h-3.5 w-3.5" />}
              disabled
            >
              Send to {selected.size}
            </Button>
          </Tooltip>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Sortable table header
// ============================================================================
function SortableTh({
  label,
  k,
  sortKey,
  sortDir,
  onClick,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onClick: (k: SortKey) => void;
}) {
  const active = sortKey === k;
  return (
    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-stone-400">
      <button
        onClick={() => onClick(k)}
        className={clsx(
          "inline-flex cursor-pointer items-center gap-1 transition-colors",
          active
            ? "text-stone-700 dark:text-stone-200"
            : "hover:text-stone-600 dark:hover:text-stone-300"
        )}
      >
        {label}
        {active ? (
          sortDir === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUp className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-40" />
        )}
      </button>
    </th>
  );
}

// ============================================================================
// Pagination helpers
// ============================================================================
function PageButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "flex h-7 w-7 items-center justify-center rounded-lg border transition-all",
        disabled
          ? "cursor-not-allowed border-stone-100 text-stone-300 dark:border-stone-800 dark:text-stone-700"
          : "cursor-pointer border-stone-150 text-stone-500 hover:border-stone-200 hover:bg-stone-50 hover:text-stone-700 dark:border-stone-700 dark:text-stone-400 dark:hover:border-stone-600 dark:hover:bg-stone-750 dark:hover:text-stone-200"
      )}
    >
      {children}
    </button>
  );
}

function PaginationNumbers({
  current,
  total,
  onChange,
}: {
  current: number;
  total: number;
  onChange: (p: number) => void;
}) {
  // Build a compact page list: 1, …, current-1, current, current+1, …, last
  const pages: (number | "…")[] = [];
  const push = (v: number | "…") => {
    if (v === "…" && pages[pages.length - 1] === "…") return;
    pages.push(v);
  };
  for (let i = 0; i < total; i++) {
    if (
      i === 0 ||
      i === total - 1 ||
      (i >= current - 1 && i <= current + 1)
    ) {
      push(i);
    } else {
      push("…");
    }
  }

  return (
    <div className="flex items-center gap-0.5 px-1">
      {pages.map((p, i) =>
        p === "…" ? (
          <span
            key={`e${i}`}
            className="px-1 text-xs text-stone-300 dark:text-stone-600"
          >
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={clsx(
              "flex h-7 min-w-7 items-center justify-center rounded-lg px-2 text-xs font-semibold transition-all",
              p === current
                ? "bg-coral-500 text-white shadow-sm shadow-coral-500/30"
                : "cursor-pointer text-stone-500 hover:bg-stone-50 hover:text-stone-700 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-200"
            )}
          >
            {p + 1}
          </button>
        )
      )}
    </div>
  );
}

// ============================================================================
// Checkbox — accessible, matches platform look
// ============================================================================
function Checkbox({
  checked,
  indeterminate,
  onChange,
  disabled,
  title,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      disabled={disabled}
      onClick={disabled ? undefined : onChange}
      title={title}
      className={clsx(
        "flex h-4 w-4 items-center justify-center rounded-md border transition-all duration-150",
        disabled
          ? "cursor-not-allowed border-stone-100 bg-stone-50 dark:border-stone-800 dark:bg-stone-900"
          : "cursor-pointer hover:shadow-sm",
        checked || indeterminate
          ? "border-coral-500 bg-coral-500 text-white"
          : !disabled &&
              "border-stone-200 bg-white hover:border-coral-300 dark:border-stone-600 dark:bg-stone-800 dark:hover:border-coral-500"
      )}
    >
      {indeterminate ? (
        <span className="h-0.5 w-2 rounded-full bg-white" />
      ) : checked ? (
        <CheckCircle2 className="h-3 w-3" strokeWidth={3} />
      ) : null}
    </button>
  );
}
