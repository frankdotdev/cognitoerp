"use client";

/**
 * The Students list screen. Wired to the real PaginatedResponse envelope,
 * links each row to the real profile page, and now has an Import action
 * for bulk Excel upload (BulkImportModal) alongside the single-student
 * Add flow.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { DataTable, Column } from "@/components/shared/DataTable";
import { TableSkeleton } from "@/components/shared/Skeleton";
import { BulkImportModal } from "@/components/shared/BulkImportModal";
import { apiClient } from "@/lib/api-client";

interface Student {
  id: string;
  identity_code: string;
  admission_number: string;
  full_name: string;
  class_name: string;
  section: string | null;
  status: string;
}

interface PaginatedStudents {
  items: Student[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-brand-50 text-brand-700",
    graduated: "bg-surface-0 text-ink-500",
    withdrawn: "bg-danger-bg text-danger",
    suspended: "bg-warning-bg text-warning",
  };
  return (
    <span className={`text-[10.5px] font-semibold px-2.5 py-1 rounded-full ${styles[status] ?? styles.active}`}>
      {status}
    </span>
  );
}

export default function StudentsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [showImport, setShowImport] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["students", { page, search, classFilter }],
    queryFn: () =>
      apiClient.get<PaginatedStudents>("/students", {
        params: { page, page_size: 25, search: search || undefined, class_name: classFilter || undefined },
      }),
  });

  const columns: Column<Student>[] = [
    { key: "full_name", header: "Name", sortable: true, render: (s) => <span className="font-medium">{s.full_name}</span> },
    { key: "admission_number", header: "Admission No.", render: (s) => <span className="font-mono text-[12px]">{s.admission_number}</span> },
    { key: "class_name", header: "Class", render: (s) => `${s.class_name}${s.section ? " — " + s.section : ""}` },
    { key: "status", header: "Status", render: (s) => <StatusPill status={s.status} /> },
  ];

  return (
    <DashboardShell userName="Mrs. Adeyemi" permissions={new Set(["*"])}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-[22px] font-bold">Students</h1>
          <p className="text-[13px] text-ink-500 mt-0.5">{data ? `${data.total} enrolled` : "\u00A0"}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 border border-border text-[13.5px] font-medium text-ink-700 px-4 py-2.5 rounded-md hover:border-brand-500 transition-colors"
          >
            <Upload size={15} /> Import
          </button>
          <Link href="/students/new" className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-[13.5px] font-medium px-4 py-2.5 rounded-md transition-colors">
            <Plus size={15} /> Add student
          </Link>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by name or admission number…"
          className="px-3.5 py-2.5 rounded-md border border-border bg-surface-1 text-[13px] w-72 outline-none focus:border-brand-500"
        />
        <select
          value={classFilter}
          onChange={(e) => { setClassFilter(e.target.value); setPage(1); }}
          className="px-3.5 py-2.5 rounded-md border border-border bg-surface-1 text-[13px] outline-none focus:border-brand-500"
        >
          <option value="">All classes</option>
          <option value="JSS1">JSS1</option>
          <option value="JSS2">JSS2</option>
          <option value="SS1">SS1</option>
          <option value="SS2">SS2</option>
          <option value="SS3">SS3</option>
        </select>
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : (
        <DataTable
          columns={columns}
          rows={data?.items ?? []}
          emptyMessage="No students match your search."
          onRowClick={(s) => router.push(`/students/${s.id}`)}
          page={data?.page ?? page}
          pageSize={data?.page_size ?? 25}
          totalCount={data?.total ?? 0}
          onPageChange={setPage}
        />
      )}

      {showImport && (
        <BulkImportModal
          onClose={() => setShowImport(false)}
          onImported={() => queryClient.invalidateQueries({ queryKey: ["students"] })}
        />
      )}
    </DashboardShell>
  );
}
