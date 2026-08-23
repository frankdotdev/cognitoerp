"use client";

/**
 * Results screen (doc 011). Teacher-facing gradebook: pick a class and
 * subject, enter CA/Exam scores per student, save. Roster comes from
 * GET /students endpoint and grading scheme from GET /results/grading-scheme.
 */
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { TableSkeleton } from "@/components/shared/Skeleton";
import { BulkResultsImportModal } from "@/components/shared/BulkResultsImportModal";
import { apiClient } from "@/lib/api-client";

interface Student {
  id: string;
  full_name: string;
}
interface PaginatedStudents {
  items: Student[];
}
interface GradingScheme {
  component_weights: Record<string, number>;
}
interface TeacherAssignment {
  class_name: string;
  subject: string | null;
  is_class_teacher: boolean;
}
interface SchoolClass {
  name: string;
}

const DEFAULT_CLASSES = ["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"];
const DEFAULT_SUBJECTS = ["Mathematics", "English", "Basic Science", "Social Studies", "Biology", "Chemistry", "Physics"];

export default function ResultsPage() {
  const [myClassesOnly, setMyClassesOnly] = useState(true);
  const [classFilter, setClassFilter] = useState("SS2");
  const [subject, setSubject] = useState("Mathematics");
  const [term, setTerm] = useState("2026-Term1");
  const [scores, setScores] = useState<Record<string, Record<string, string>>>({});
  const [savedRow, setSavedRow] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const queryClient = useQueryClient();

  const { data: teacherAssignments } = useQuery<TeacherAssignment[]>({
    queryKey: ["teacher-assignments"],
    queryFn: () => apiClient.get<TeacherAssignment[]>("/teachers/me/assignments").catch(() => []),
  });

  const { data: schoolClassesData } = useQuery<SchoolClass[]>({
    queryKey: ["school-classes"],
    queryFn: () => apiClient.get<SchoolClass[]>("/schools/me/classes").catch(() => []),
  });

  const availableClasses = useMemo(() => {
    if (myClassesOnly && teacherAssignments && teacherAssignments.length > 0) {
      const assigned = Array.from(new Set(teacherAssignments.map((a) => a.class_name)));
      if (assigned.length > 0) return assigned;
    }
    if (schoolClassesData && schoolClassesData.length > 0) {
      return schoolClassesData.map((c) => c.name);
    }
    return DEFAULT_CLASSES;
  }, [myClassesOnly, teacherAssignments, schoolClassesData]);

  const availableSubjects = useMemo(() => {
    if (myClassesOnly && teacherAssignments && teacherAssignments.length > 0) {
      const assigned = teacherAssignments
        .filter((a) => a.class_name === classFilter && a.subject)
        .map((a) => a.subject as string);
      if (assigned.length > 0) return Array.from(new Set(assigned));
    }
    return DEFAULT_SUBJECTS;
  }, [myClassesOnly, teacherAssignments, classFilter]);

  const { data: roster, isLoading: rosterLoading } = useQuery({
    queryKey: ["roster", classFilter],
    queryFn: () => apiClient.get<PaginatedStudents>("/students", { params: { class_name: classFilter, page_size: 100 } }),
  });

  const { data: scheme } = useQuery({
    queryKey: ["grading-scheme"],
    queryFn: () => apiClient.get<GradingScheme | null>("/results/grading-scheme"),
  });

  const components = scheme ? Object.entries(scheme.component_weights) : [];

  const saveScore = useMutation({
    mutationFn: (payload: { student_id: string; subject: string; term: string; component: string; score: number }) =>
      apiClient.post("/results/scores", payload),
  });

  function setScore(studentId: string, component: string, value: string) {
    setScores((prev) => ({ ...prev, [studentId]: { ...prev[studentId], [component]: value } }));
  }

  async function handleSaveRow(studentId: string) {
    const row = scores[studentId] ?? {};
    for (const [key] of components) {
      const raw = row[key];
      if (raw !== undefined && raw !== "") {
        await saveScore.mutateAsync({ student_id: studentId, subject, term, component: key, score: Number(raw) });
      }
    }
    setSavedRow(studentId);
    setTimeout(() => setSavedRow((s) => (s === studentId ? null : s)), 1500);
  }

  return (
    <DashboardShell userName="Mr. Bassey" permissions={new Set(["results.enter", "results.publish"])}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[22px] font-bold">Results</h1>
          <p className="text-[13px] text-ink-500 mt-0.5">Enter scores by subject and term</p>
        </div>
        <button
          onClick={() => setShowImport(true)}
          className="flex items-center gap-2 border border-border text-[13.5px] font-medium text-ink-700 px-4 py-2.5 rounded-md hover:border-brand-500 transition-colors shrink-0"
        >
          <Upload size={15} /> Import past results
        </button>
      </div>

      {!scheme ? (
        <div className="bg-warning-bg border border-warning/30 rounded-[10px] p-4 mb-5 text-[13px] text-warning">
          No grading scheme configured yet — set one up in Settings before entering scores.
        </div>
      ) : (
        <div className="space-y-3 mb-5">
          <div className="flex items-center gap-2 text-[12.5px] text-ink-500">
            <input
              type="checkbox"
              id="myClassesOnly"
              checked={myClassesOnly}
              onChange={(e) => setMyClassesOnly(e.target.checked)}
              className="rounded border-border"
            />
            <label htmlFor="myClassesOnly" className="cursor-pointer">
              Show assigned classes & subjects only
            </label>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={availableClasses.includes(classFilter) ? classFilter : availableClasses[0] || ""}
              onChange={(e) => setClassFilter(e.target.value)}
              className="px-3.5 py-2.5 rounded-md border border-border bg-surface-1 text-[13px] outline-none focus:border-brand-500"
            >
              {availableClasses.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={availableSubjects.includes(subject) ? subject : availableSubjects[0] || ""}
              onChange={(e) => setSubject(e.target.value)}
              className="px-3.5 py-2.5 rounded-md border border-border bg-surface-1 text-[13px] outline-none focus:border-brand-500"
            >
              {availableSubjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="px-3.5 py-2.5 rounded-md border border-border bg-surface-1 text-[13px] outline-none focus:border-brand-500 font-mono"
            />
          </div>
        </div>
      )}

      {scheme && (rosterLoading ? (
        <TableSkeleton rows={5} />
      ) : (roster?.items ?? []).length === 0 ? (
        <div className="bg-surface-1 border border-border rounded-[10px] p-6 text-center text-[13px] text-ink-500">
          No students in {classFilter} yet.
        </div>
      ) : (
        <div className="bg-surface-1 border border-border rounded-[10px] overflow-x-auto">
          <table className="w-full text-[13px] min-w-[480px]">
            <thead>
              <tr className="border-b border-border bg-surface-0">
                <th className="text-left px-4 py-3 font-medium text-ink-500 sticky left-0 bg-surface-0">Student</th>
                {components.map(([key, max]) => (
                  <th key={key} className="text-left px-3 py-3 font-medium text-ink-500 whitespace-nowrap">
                    {key} <span className="text-ink-300 font-normal">/{max}</span>
                  </th>
                ))}
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {(roster?.items ?? []).map((student) => (
                <tr key={student.id} className="border-b border-border-soft last:border-0">
                  <td className="px-4 py-2.5 font-medium sticky left-0 bg-surface-1 whitespace-nowrap">{student.full_name}</td>
                  {components.map(([key, max]) => (
                    <td key={key} className="px-3 py-2.5">
                      <input
                        type="number"
                        min={0}
                        max={max}
                        value={scores[student.id]?.[key] ?? ""}
                        onChange={(e) => setScore(student.id, key, e.target.value)}
                        className="w-16 px-2 py-1.5 rounded-md border border-border text-[12.5px] outline-none focus:border-brand-500"
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2.5">
                    <button onClick={() => handleSaveRow(student.id)} className="text-[12px] font-medium text-brand-700 hover:underline whitespace-nowrap">
                      {savedRow === student.id ? "Saved" : "Save"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <p className="text-[11.5px] text-ink-300 mt-3">
        Scores are validated against your school's grading scheme when saved — a component over its max is rejected.
      </p>

      {showImport && (
        <BulkResultsImportModal
          onClose={() => setShowImport(false)}
          onImported={() => queryClient.invalidateQueries({ queryKey: ["roster"] })}
        />
      )}
    </DashboardShell>
  );
}
