"use client";

import { useMemo, useState } from "react";
import { Search, Send, CheckCircle2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SlideOver } from "@/components/ui/slide-over";
import type { EligibleEmployee } from "@/lib/types";

export function EmployeePicker({
  open,
  onClose,
  employees,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  employees: EligibleEmployee[];
  onPick: (e: EligibleEmployee) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => {
      const haystack = `${e.first_name} ${e.last_name} ${e.emp_id} ${e.email} ${e.department}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [employees, query]);

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="Pick an employee"
      subtitle={`${employees.length} eligible for Form F (1+ year of service)`}
      width="lg"
    >
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, emp ID, email, department…"
          className="pl-10"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-stone-400 dark:text-stone-500">
          No employees match that search.
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((emp) => {
            const name = `${emp.first_name} ${emp.last_name}`;
            return (
              <button
                key={emp.id}
                onClick={() => onPick(emp)}
                className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-stone-100 bg-white px-4 py-3 text-left transition-all duration-150 hover:border-coral-200 hover:shadow-soft dark:border-stone-800 dark:bg-stone-850 dark:hover:border-coral-700/40"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={name} size="sm" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-stone-800 dark:text-stone-100">
                        {name}
                      </p>
                      <Badge variant="muted">{emp.emp_id}</Badge>
                      {emp.dispatch_status === "completed" && (
                        <Badge variant="emerald" dot>
                          Completed
                        </Badge>
                      )}
                      {emp.dispatch_status === "pending" && (
                        <Badge variant="amber" dot>
                          In progress
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-[11px] text-stone-400">
                      {emp.department} · {emp.service_years}y service
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-coral-500">
                  {emp.dispatch_status ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </SlideOver>
  );
}
