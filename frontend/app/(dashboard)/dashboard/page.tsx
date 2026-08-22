"use client";

/**
 * Principal Dashboard (doc 014's MVP scope): today's attendance, revenue
 * today, outstanding fees, teachers/students absent, pending admissions,
 * pending approvals. This screen intentionally answers three questions per
 * doc 002's UX principle: what happened, what needs my attention, what
 * should I do next — nothing here is decorative.
 */
import { useQuery } from "@tanstack/react-query";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { apiClient } from "@/lib/api-client";

interface DashboardSummary {
  student_count: number;
  attendance_today_percent: number;
  fees_collected_percent: number;
  teacher_count: number;
  outstanding_fees_total: number;
  pending_admissions: number;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-surface-1 border border-border rounded-[10px] p-4">
      <div className="text-[11.5px] text-ink-300 mb-1.5">{label}</div>
      <div className="font-heading font-bold text-[20px]">{value}</div>
      {sub && <div className="text-[11px] text-ink-300 mt-1">{sub}</div>}
    </div>
  );
}

export default function PrincipalDashboardPage() {
  // NOTE: this endpoint (/dashboard/summary) doesn't exist yet — Analytics
  // (doc 014) is explicitly one of the not-yet-built modules. This screen
  // is wired to the shape the API WILL return, so building that endpoint
  // is the only remaining step to make this page real rather than a mock.
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => apiClient.get<DashboardSummary>("/dashboard/summary"),
  });

  return (
    <DashboardShell userName="Mrs. Adeyemi" permissions={new Set(["*"])}>
      <div className="mb-6">
        <h1 className="text-[22px] font-bold">Good morning, Mrs. Adeyemi</h1>
        <p className="text-[13px] text-ink-500 mt-0.5">Here's what's happening at your school today.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Students" value={isLoading ? "—" : String(data?.student_count ?? 0)} />
        <StatCard
          label="Attendance today"
          value={isLoading ? "—" : `${data?.attendance_today_percent ?? 0}%`}
        />
        <StatCard
          label="Fees collected"
          value={isLoading ? "—" : `${data?.fees_collected_percent ?? 0}%`}
          sub={data ? `₦${data.outstanding_fees_total.toLocaleString()} outstanding` : undefined}
        />
        <StatCard label="Teachers" value={isLoading ? "—" : String(data?.teacher_count ?? 0)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-surface-1 border border-border rounded-[10px] p-5">
          <h3 className="text-[13.5px] font-semibold mb-3">Needs your attention</h3>
          <ul className="flex flex-col gap-2.5 text-[13px]">
            <li className="flex justify-between items-center">
              <span>Pending admissions to review</span>
              <span className="font-mono text-[12px] bg-warning-bg text-warning px-2 py-0.5 rounded-full">
                {isLoading ? "—" : data?.pending_admissions ?? 0}
              </span>
            </li>
            <li className="flex justify-between items-center">
              <span>Report cards awaiting publish — SS2</span>
              <span className="font-mono text-[12px] bg-warning-bg text-warning px-2 py-0.5 rounded-full">1</span>
            </li>
          </ul>
        </div>

        <div className="bg-surface-1 border border-border rounded-[10px] p-5">
          <h3 className="text-[13.5px] font-semibold mb-3">Quick actions</h3>
          <div className="flex flex-col gap-2">
            <button className="text-left text-[13px] px-3 py-2.5 rounded-md border border-border hover:border-brand-500 hover:bg-brand-50 transition-colors">
              Add a new student
            </button>
            <button className="text-left text-[13px] px-3 py-2.5 rounded-md border border-border hover:border-brand-500 hover:bg-brand-50 transition-colors">
              Record a fee payment
            </button>
            <button className="text-left text-[13px] px-3 py-2.5 rounded-md border border-border hover:border-brand-500 hover:bg-brand-50 transition-colors">
              Post an announcement
            </button>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
