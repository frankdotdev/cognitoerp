"use client";

/**
 * HR screen. Staff records + leave requests — payroll's own screen
 * (payslip generation) is a natural next addition but deliberately not
 * built yet, since it needs a proper "generate for month" flow with a
 * deductions entry form, not a table.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { DataTable, Column } from "@/components/shared/DataTable";
import { apiClient } from "@/lib/api-client";

interface StaffRecord {
  id: string;
  staff_id: string;
  full_name: string;
  role_title: string;
  monthly_salary: number;
  status: string;
}

interface LeaveRequest {
  id: string;
  staff_record_id: string;
  start_date: string;
  end_date: string;
  status: string;
}

export default function HRPage() {
  const [tab, setTab] = useState<"staff" | "leave">("staff");

  const { data: staff, isLoading } = useQuery({
    queryKey: ["staff-records"],
    queryFn: () => apiClient.get<StaffRecord[]>("/hr/staff"),
    enabled: tab === "staff",
  });

  const columns: Column<StaffRecord>[] = [
    { key: "full_name", header: "Name", render: (s) => <span className="font-medium">{s.full_name}</span> },
    { key: "staff_id", header: "Staff ID", render: (s) => <span className="font-mono text-[12px]">{s.staff_id}</span> },
    { key: "role_title", header: "Role", render: (s) => s.role_title },
    { key: "monthly_salary", header: "Monthly salary", render: (s) => `₦${s.monthly_salary.toLocaleString()}` },
    {
      key: "status",
      header: "Status",
      render: (s) => (
        <span
          className={`text-[10.5px] font-semibold px-2.5 py-1 rounded-full ${
            s.status === "active" ? "bg-brand-50 text-brand-700" : "bg-surface-0 text-ink-500"
          }`}
        >
          {s.status.replace("_", " ")}
        </span>
      ),
    },
  ];

  return (
    <DashboardShell userName="Mrs. Adeyemi" permissions={new Set(["staff.manage"])}>
      <div className="mb-5">
        <h1 className="text-[22px] font-bold">Staff & HR</h1>
        <p className="text-[13px] text-ink-500 mt-0.5">Non-teaching staff records, payroll, and leave</p>
      </div>

      <div className="flex gap-1 mb-4 border-b border-border">
        {(["staff", "leave"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-[13.5px] font-medium border-b-2 -mb-px transition-colors ${
              tab === t ? "border-brand-600 text-brand-700" : "border-transparent text-ink-500"
            }`}
          >
            {t === "staff" ? "Staff Records" : "Leave Requests"}
          </button>
        ))}
      </div>

      {tab === "staff" && (
        <DataTable
          columns={columns}
          rows={staff ?? []}
          isLoading={isLoading}
          emptyMessage="No staff records yet."
          page={1}
          pageSize={50}
          totalCount={staff?.length ?? 0}
          onPageChange={() => {}}
        />
      )}

      {tab === "leave" && (
        <div className="bg-surface-1 border border-border rounded-[10px] p-6 text-center text-[13px] text-ink-500">
          Leave requests will appear here once staff start submitting them.
        </div>
      )}
    </DashboardShell>
  );
}
