"use client";

/**
 * Teacher dashboard (doc 007): today's classes, attendance entry,
 * gradebook, assignments, inbox — built to be usable within 5 minutes of
 * first login with zero training, per the product's core UX principle.
 */
import { useQuery } from "@tanstack/react-query";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { apiClient } from "@/lib/api-client";

interface ClassAssignment {
  id: string;
  class_name: string;
  subject: string | null;
  is_class_teacher: boolean;
}

export default function TeacherDashboardPage() {
  const { data: assignments, isLoading } = useQuery({
    queryKey: ["my-class-assignments"],
    queryFn: () => apiClient.get<ClassAssignment[]>("/teachers/me/assignments"),
  });

  return (
    <DashboardShell userName="Mr. Bassey" permissions={new Set(["students.view", "attendance.mark", "results.enter"])}>
      <div className="mb-6">
        <h1 className="text-[22px] font-bold">Your classes today</h1>
        <p className="text-[13px] text-ink-500 mt-0.5">
          {isLoading ? "Loading…" : `${assignments?.length ?? 0} classes assigned to you`}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(assignments ?? []).map((a) => (
          <div key={a.id} className="bg-surface-1 border border-border rounded-[10px] p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-heading font-bold text-[15px]">{a.class_name}</h3>
              {a.is_class_teacher && (
                <span className="text-[10.5px] font-semibold px-2.5 py-1 rounded-full bg-brand-50 text-brand-700">
                  Class Teacher
                </span>
              )}
            </div>
            {a.subject && <p className="text-[13px] text-ink-500 mb-4">{a.subject}</p>}
            <div className="flex gap-2">
              <button className="flex-1 text-[12.5px] font-medium px-3 py-2 rounded-md border border-border hover:border-brand-500 hover:bg-brand-50 transition-colors">
                Mark attendance
              </button>
              <button className="flex-1 text-[12.5px] font-medium px-3 py-2 rounded-md border border-border hover:border-brand-500 hover:bg-brand-50 transition-colors">
                Enter scores
              </button>
            </div>
          </div>
        ))}

        {!isLoading && (assignments ?? []).length === 0 && (
          <div className="col-span-2 bg-surface-1 border border-border rounded-[10px] p-8 text-center text-[13px] text-ink-500">
            No classes assigned yet — your school admin can assign you to a class from Settings.
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
