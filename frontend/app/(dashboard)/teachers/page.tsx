"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, UserX } from "lucide-react";
import Link from "next/link";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { DataTable, Column } from "@/components/shared/DataTable";
import { TableSkeleton } from "@/components/shared/Skeleton";
import { apiClient } from "@/lib/api-client";

interface Teacher {
  id: string;
  staff_id: string;
  full_name: string;
  subjects: string[];
  status: string;
}

function OffboardModal({ teacher, onClose, onDone }: { teacher: Teacher; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("resigned");

  const offboard = useMutation({
    mutationFn: () => apiClient.post(`/teachers/${teacher.id}/offboard`, { reason }),
    onSuccess: () => {
      onDone();
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
      <div className="bg-surface-1 rounded-[14px] w-full max-w-sm p-6">
        <h2 className="font-heading font-bold text-[16px] mb-1.5">Offboard {teacher.full_name}</h2>
        <p className="text-[12.5px] text-ink-500 mb-4">
          Their login will be revoked immediately, on every device. Every record they've entered (scores, attendance)
          stays exactly as it is — nothing is deleted.
        </p>
        <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full px-3 py-2.5 rounded-md border border-border text-[13px] mb-4">
          <option value="resigned">Resigned</option>
          <option value="terminated">Terminated</option>
          <option value="other">Other</option>
        </select>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 border border-border rounded-md py-2.5 text-[13px] font-medium">Cancel</button>
          <button
            onClick={() => offboard.mutate()}
            disabled={offboard.isPending}
            className="flex-1 bg-danger text-white rounded-md py-2.5 text-[13px] font-medium disabled:opacity-60"
          >
            {offboard.isPending ? "Offboarding…" : "Confirm offboard"}
          </button>
        </div>
        <p className="text-[11px] text-ink-300 mt-3">
          If they teach a class, reassign it from the class's Settings afterward — see Unassigned Classes.
        </p>
      </div>
    </div>
  );
}

export default function TeachersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [offboarding, setOffboarding] = useState<Teacher | null>(null);

  const { data: teachers, isLoading } = useQuery({
    queryKey: ["teachers"],
    queryFn: () => apiClient.get<Teacher[]>("/teachers"),
  });

  const filtered = (teachers ?? []).filter((t) => t.full_name.toLowerCase().includes(search.toLowerCase()));

  const columns: Column<Teacher>[] = [
    { key: "full_name", header: "Name", render: (t) => <span className="font-medium">{t.full_name}</span> },
    { key: "staff_id", header: "Staff ID", render: (t) => <span className="font-mono text-[12px]">{t.staff_id}</span> },
    { key: "subjects", header: "Subjects", render: (t) => t.subjects.length ? t.subjects.join(", ") : "—" },
    {
      key: "status", header: "Status",
      render: (t) => (
        <span className={`text-[10.5px] font-semibold px-2.5 py-1 rounded-full ${t.status === "active" ? "bg-brand-50 text-brand-700" : "bg-surface-0 text-ink-500"}`}>
          {t.status.replace("_", " ")}
        </span>
      ),
    },
    {
      key: "actions", header: "",
      render: (t) => t.status === "active" ? (
        <button
          onClick={(e) => { e.stopPropagation(); setOffboarding(t); }}
          className="flex items-center gap-1.5 text-[12px] font-medium text-danger hover:underline"
        >
          <UserX size={13} /> Offboard
        </button>
      ) : null,
    },
  ];

  return (
    <DashboardShell userName="Mrs. Adeyemi" permissions={new Set(["teachers.view", "teachers.edit"])}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[22px] font-bold">Teachers</h1>
          <p className="text-[13px] text-ink-500 mt-0.5">{teachers?.length ?? 0} teaching staff</p>
        </div>
        <Link href="/teachers/new" className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-[13.5px] font-medium px-4 py-2.5 rounded-md transition-colors">
          <Plus size={15} /> Add teacher
        </Link>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name…"
        className="px-3.5 py-2.5 rounded-md border border-border bg-surface-1 text-[13px] w-72 outline-none focus:border-brand-500 mb-4"
      />

      {isLoading ? (
        <TableSkeleton />
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          emptyMessage="No teachers match your search."
          page={1}
          pageSize={50}
          totalCount={filtered.length}
          onPageChange={() => {}}
        />
      )}

      {offboarding && (
        <OffboardModal
          teacher={offboarding}
          onClose={() => setOffboarding(null)}
          onDone={() => queryClient.invalidateQueries({ queryKey: ["teachers"] })}
        />
      )}
    </DashboardShell>
  );
}
