"use client";

/**
 * Student profile — tabbed Information/Attendance/Results/Fees, plus the
 * real-world lifecycle management the product needed: a status action
 * (graduate/transfer/withdraw/suspend/reactivate/mark deceased) that
 * revokes login access without ever deleting the underlying record, and
 * a transcript download — the portable artifact a family takes to
 * wherever the student goes next.
 */
import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, ChevronDown } from "lucide-react";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { FormSkeleton } from "@/components/shared/Skeleton";
import { EntityPhotoUploader } from "@/components/shared/EntityPhotoUploader";
import { apiClient, API_BASE_URL } from "@/lib/api-client";

interface Student {
  id: string;
  identity_code: string;
  admission_number: string;
  full_name: string;
  class_name: string;
  section: string | null;
  status: string;
  photo_url: string | null;
  admission_date: string;
  exit_date: string | null;
  exit_reason: string | null;
}

interface ReportCard {
  id: string;
  term: string;
  subject_scores: Record<string, { total: number; grade: string }>;
  overall_average: number;
  class_position: number | null;
  published: boolean;
}

const TABS = ["Information", "Attendance", "Results", "Fees"] as const;

const EXIT_OPTIONS = [
  { value: "graduated", label: "Graduate" },
  { value: "transferred", label: "Transferred to another school" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "suspended", label: "Suspend" },
  { value: "deceased", label: "Mark deceased" },
];

function StatusManager({ student }: { student: Student }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [exitDate, setExitDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");

  const applyExit = useMutation({
    mutationFn: () => apiClient.post(`/students/${student.id}/exit`, { new_status: selected, exit_date: exitDate, exit_reason: reason || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student", student.id] });
      setOpen(false);
      setSelected(null);
    },
  });

  const reactivate = useMutation({
    mutationFn: () => apiClient.post(`/students/${student.id}/reactivate`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["student", student.id] }),
  });

  if (student.status !== "active") {
    return (
      <button
        onClick={() => reactivate.mutate()}
        disabled={reactivate.isPending}
        className="text-[12.5px] font-medium text-brand-700 hover:underline"
      >
        {reactivate.isPending ? "Reactivating…" : "Reactivate this student"}
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-[12.5px] font-medium border border-border rounded-md px-3 py-1.5 hover:border-brand-500"
      >
        Change status <ChevronDown size={13} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-surface-1 border border-border rounded-[10px] p-4 shadow-lg z-10">
          {!selected ? (
            <div className="flex flex-col gap-1">
              {EXIT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSelected(opt.value)}
                  className="text-left text-[13px] px-2.5 py-2 rounded-md hover:bg-surface-0"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-[12.5px] font-medium">{EXIT_OPTIONS.find((o) => o.value === selected)?.label}</p>
              <input type="date" value={exitDate} onChange={(e) => setExitDate(e.target.value)} className="px-2.5 py-2 rounded-md border border-border text-[12.5px]" />
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" className="px-2.5 py-2 rounded-md border border-border text-[12.5px]" />
              <div className="flex gap-2">
                <button onClick={() => setSelected(null)} className="flex-1 text-[12px] border border-border rounded-md py-2">Back</button>
                <button
                  onClick={() => applyExit.mutate()}
                  disabled={applyExit.isPending}
                  className="flex-1 text-[12px] bg-brand-600 text-white rounded-md py-2 disabled:opacity-60"
                >
                  {applyExit.isPending ? "Saving…" : "Confirm"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function StudentProfilePage() {
  const params = useParams();
  const studentId = params.id as string;
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<typeof TABS[number]>("Information");

  const { data: student, isLoading } = useQuery({
    queryKey: ["student", studentId],
    queryFn: () => apiClient.get<Student>(`/students/${studentId}`),
  });

  const { data: reportCards } = useQuery({
    queryKey: ["report-cards", studentId],
    queryFn: () => apiClient.get<ReportCard[]>(`/results/report-cards/${studentId}`),
    enabled: tab === "Results",
  });

  const { data: invoices } = useQuery({
    queryKey: ["invoices", studentId],
    queryFn: () => apiClient.get<{ id: string; term: string; total_amount: number; amount_paid: number; status: string }[]>(
      "/finance/invoices", { params: { student_id: studentId } }
    ),
    enabled: tab === "Fees",
  });

  if (isLoading || !student) {
    return (
      <DashboardShell userName="Mrs. Adeyemi" permissions={new Set(["students.view"])}>
        <FormSkeleton fields={5} />
      </DashboardShell>
    );
  }

  const statusStyles: Record<string, string> = {
    active: "bg-brand-500/20 text-brand-50",
    graduated: "bg-white/15 text-white",
    transferred: "bg-warning/20 text-warning",
    withdrawn: "bg-white/15 text-white",
    suspended: "bg-danger/20 text-danger",
    deceased: "bg-white/10 text-white/70",
  };

  return (
    <DashboardShell userName="Mrs. Adeyemi" permissions={new Set(["students.view", "students.edit"])}>
      <div className="bg-ink-900 rounded-[12px] px-5 sm:px-6 py-6 mb-5 flex items-center gap-4 flex-wrap">
        {student.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={student.photo_url} alt={student.full_name} className="w-14 h-14 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-white font-heading font-bold text-[18px] shrink-0">
            {student.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-white font-heading font-bold text-[18px] sm:text-[20px] truncate">{student.full_name}</h1>
          <p className="text-white/60 text-[12.5px]">
            {student.class_name}{student.section ? ` — ${student.section}` : ""} · {student.admission_number}
          </p>
        </div>
        <span className={`text-[10.5px] font-semibold px-2.5 py-1 rounded-full capitalize shrink-0 ${statusStyles[student.status] ?? statusStyles.active}`}>
          {student.status}
        </span>
        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-between sm:justify-start">
          <a
            href={`${API_BASE_URL}/students/${studentId}/transcript.pdf`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-[12px] font-medium text-white/80 hover:text-white border border-white/20 rounded-md px-3 py-1.5"
          >
            <Download size={13} /> Transcript
          </a>
          <StatusManager student={student} />
        </div>
      </div>

      <div className="flex gap-1 mb-5 border-b border-border overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 px-4 py-2.5 text-[13.5px] font-medium border-b-2 -mb-px transition-colors ${
              tab === t ? "border-brand-600 text-brand-700" : "border-transparent text-ink-500"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Information" && (
        <div className="max-w-2xl flex flex-col gap-4">
          <div className="bg-surface-1 border border-border rounded-[10px] p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <InfoRow label="Registration number" value={student.identity_code} mono />
            <InfoRow label="Admission number" value={student.admission_number} mono />
            <InfoRow label="Class" value={`${student.class_name}${student.section ? ` — ${student.section}` : ""}`} />
            <InfoRow label="Admission date" value={new Date(student.admission_date).toLocaleDateString()} />
            {student.exit_date && <InfoRow label="Exit date" value={new Date(student.exit_date).toLocaleDateString()} />}
            {student.exit_reason && <InfoRow label="Exit reason" value={student.exit_reason} />}
          </div>
          <div className="bg-surface-1 border border-border rounded-[10px] p-5 max-w-xs">
            <p className="text-[12.5px] font-medium text-ink-700 mb-3">Student photo</p>
            <EntityPhotoUploader
              uploadUrlEndpoint={`/students/${studentId}/photo/upload-url`}
              confirmEndpoint={`/students/${studentId}/photo/confirm`}
              currentPhotoUrl={student.photo_url}
              onUploaded={() => queryClient.invalidateQueries({ queryKey: ["student", studentId] })}
            />
          </div>
        </div>
      )}

      {tab === "Attendance" && (
        <div className="bg-surface-1 border border-border rounded-[10px] p-6 text-center text-[13px] text-ink-500">
          Individual attendance history — see the class-wide calendar under Attendance for now; a per-student view is a natural follow-on to that screen.
        </div>
      )}

      {tab === "Results" && (
        <div className="flex flex-col gap-3">
          {(reportCards ?? []).length === 0 && (
            <div className="bg-surface-1 border border-border rounded-[10px] p-6 text-center text-[13px] text-ink-500">
              No published report cards yet.
            </div>
          )}
          {(reportCards ?? []).map((card) => (
            <div key={card.id} className="bg-surface-1 border border-border rounded-[10px] p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="font-heading font-bold text-[14.5px]">{card.term}</span>
                {card.class_position && (
                  <span className="text-[11.5px] text-ink-500">Position: {card.class_position}</span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                {Object.entries(card.subject_scores).map(([subject, s]) => (
                  <div key={subject} className="flex justify-between text-[12.5px] py-1.5 border-t border-border-soft first:border-0">
                    <span className="text-ink-700">{subject}</span>
                    <span className="font-medium">{s.total} ({s.grade})</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[13px] font-semibold pt-3 mt-2 border-t border-border">
                <span>Average</span>
                <span>{card.overall_average}%</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "Fees" && (
        <div className="flex flex-col gap-2">
          {(invoices ?? []).length === 0 && (
            <div className="bg-surface-1 border border-border rounded-[10px] p-6 text-center text-[13px] text-ink-500">
              No invoices yet.
            </div>
          )}
          {(invoices ?? []).map((inv) => (
            <div key={inv.id} className="bg-surface-1 border border-border rounded-[10px] p-4 flex items-center justify-between">
              <div>
                <div className="text-[13.5px] font-medium">{inv.term}</div>
                <div className="text-[11.5px] text-ink-300">₦{inv.amount_paid.toLocaleString()} of ₦{inv.total_amount.toLocaleString()} paid</div>
              </div>
              <span className={`text-[10.5px] font-semibold px-2.5 py-1 rounded-full ${inv.status === "paid" ? "bg-brand-50 text-brand-700" : "bg-warning-bg text-warning"}`}>
                {inv.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[11.5px] text-ink-300 mb-1">{label}</div>
      <div className={`text-[13.5px] font-medium ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}
