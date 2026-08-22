"use client";

/**
 * Report card preview. Deliberately styled to look right on paper as well
 * as screen (a print stylesheet, not just a screen view) since this is the
 * one document a parent may actually print — pulls the school's branding
 * (logo, colors) from ThemeProvider so it's genuinely the SCHOOL'S report
 * card, not a generic Cognitio template with the school's name typed in.
 */
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Printer, Download, Loader2 } from "lucide-react";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { useSchoolTheme } from "@/lib/theme-provider";
import { apiClient } from "@/lib/api-client";

interface Student {
  id: string;
  full_name: string;
  class_name: string;
  section: string | null;
  admission_number: string;
}

interface ReportCard {
  id: string;
  term: string;
  subject_scores: Record<string, { total: number; grade: string }>;
  overall_average: number;
  class_position: number | null;
  attendance_percent: number | null;
  teacher_comment: string | null;
  published: boolean;
}

export default function ReportCardPage() {
  const params = useParams();
  const studentId = params.id as string;
  const theme = useSchoolTheme();

  const { data: student } = useQuery({
    queryKey: ["student", studentId],
    queryFn: () => apiClient.get<Student>(`/students/${studentId}`),
  });

  const { data: reportCards } = useQuery({
    queryKey: ["report-cards", studentId],
    queryFn: () => apiClient.get<ReportCard[]>(`/results/report-cards/${studentId}`),
  });

  const latest = reportCards?.[0];

  const generatePdf = useMutation({
    mutationFn: () => apiClient.post<{ download_url: string }>(`/results/report-cards/${latest?.id}/generate-pdf`),
    onSuccess: (result) => {
      window.open(result.download_url, "_blank");
    },
  });

  return (
    <DashboardShell userName="Mrs. Adeyemi" permissions={new Set(["results.view"])}>
      <div className="flex items-center justify-between mb-5 print:hidden">
        <h1 className="text-[22px] font-bold">Report card</h1>
        <div className="flex gap-2">
          <button
            onClick={() => generatePdf.mutate()}
            disabled={!latest || generatePdf.isPending}
            className="flex items-center gap-2 border border-border text-[13px] font-medium px-3.5 py-2 rounded-md text-ink-700 hover:border-brand-500 disabled:opacity-50"
          >
            {generatePdf.isPending ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {generatePdf.isPending ? "Generating…" : "Download PDF"}
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 border border-border text-[13px] font-medium px-3.5 py-2 rounded-md text-ink-700 hover:border-brand-500"
          >
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      {!student || !latest ? (
        <div className="bg-surface-1 border border-border rounded-[10px] p-8 text-center text-[13px] text-ink-500">
          No published report card available yet.
        </div>
      ) : (
        <div className="bg-white border border-border rounded-[10px] max-w-2xl mx-auto p-6 sm:p-8 print:border-0 print:shadow-none print:max-w-none">
          <div className="flex items-center gap-3 pb-5 mb-5 border-b-2" style={{ borderColor: theme.primaryColor }}>
            {theme.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={theme.logoUrl} alt="School logo" className="w-12 h-12 object-contain" />
            )}
            <div>
              <div className="font-heading font-bold text-[16px]" style={{ color: theme.primaryColor }}>
                Report Card
              </div>
              <div className="text-[12px] text-ink-500">{latest.term}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6 text-[12.5px]">
            <div><span className="text-ink-300">Student:</span> <span className="font-medium">{student.full_name}</span></div>
            <div><span className="text-ink-300">Admission No:</span> <span className="font-mono">{student.admission_number}</span></div>
            <div><span className="text-ink-300">Class:</span> {student.class_name}{student.section ? ` — ${student.section}` : ""}</div>
            {latest.attendance_percent !== null && (
              <div><span className="text-ink-300">Attendance:</span> {latest.attendance_percent}%</div>
            )}
          </div>

          <table className="w-full text-[12.5px] mb-5">
            <thead>
              <tr className="border-b-2 border-ink-900">
                <th className="text-left py-2">Subject</th>
                <th className="text-right py-2">Score</th>
                <th className="text-right py-2">Grade</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(latest.subject_scores).map(([subject, s]) => (
                <tr key={subject} className="border-b border-border-soft">
                  <td className="py-2">{subject}</td>
                  <td className="text-right py-2">{s.total}</td>
                  <td className="text-right py-2 font-medium">{s.grade}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-between text-[13.5px] font-semibold pb-5 mb-5 border-b border-border">
            <span>Overall average</span>
            <span>{latest.overall_average}%{latest.class_position && ` — Position ${latest.class_position} in class`}</span>
          </div>

          {latest.teacher_comment && (
            <div className="mb-6">
              <div className="text-[11.5px] text-ink-300 mb-1">Class teacher's comment</div>
              <p className="text-[13px] italic">{latest.teacher_comment}</p>
            </div>
          )}

          <div className="flex justify-between pt-5 mt-6 border-t border-border-soft text-[11px] text-ink-300">
            <span>Generated by Cognitio ERP</span>
            <span>{new Date().toLocaleDateString()}</span>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
