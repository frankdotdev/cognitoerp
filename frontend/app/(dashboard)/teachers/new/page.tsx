"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { FormField, inputClass } from "@/components/shared/FormField";
import { apiClient } from "@/lib/api-client";

const SUBJECT_OPTIONS = ["Mathematics", "English", "Basic Science", "Social Studies", "French", "Physical Education", "Computer Studies"];

export default function NewTeacherPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [qualification, setQualification] = useState("");
  const [employmentDate, setEmploymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [subjects, setSubjects] = useState<string[]>([]);
  const [errors, setErrors] = useState<{ full_name?: string; employment_date?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function toggleSubject(subject: string) {
    setSubjects((prev) => (prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject]));
  }

  function validate(): boolean {
    const next: typeof errors = {};
    if (fullName.trim().length < 2) next.full_name = "Enter the teacher's full name.";
    if (!employmentDate) next.employment_date = "Employment date is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await apiClient.post("/teachers", {
        full_name: fullName,
        qualification: qualification || undefined,
        employment_date: employmentDate,
        subjects,
      });
      router.push("/teachers");
    } catch {
      setSubmitError("Couldn't save this teacher. Check the details and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <DashboardShell userName="Mrs. Adeyemi" permissions={new Set(["teachers.edit"])}>
      <div className="mb-5">
        <h1 className="text-[22px] font-bold">Add teacher</h1>
        <p className="text-[13px] text-ink-500 mt-0.5">A staff ID and login will be generated automatically</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-lg bg-surface-1 border border-border rounded-[10px] p-5 flex flex-col gap-4">
        <FormField label="Full name" required error={errors.full_name}>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass(!!errors.full_name)} placeholder="e.g. Mr. Chukwuemeka Bassey" />
        </FormField>

        <FormField label="Qualification">
          <input value={qualification} onChange={(e) => setQualification(e.target.value)} className={inputClass()} placeholder="e.g. B.Sc Mathematics, PGDE" />
        </FormField>

        <FormField label="Employment date" required error={errors.employment_date}>
          <input type="date" value={employmentDate} onChange={(e) => setEmploymentDate(e.target.value)} className={inputClass(!!errors.employment_date)} />
        </FormField>

        <FormField label="Subjects">
          <div className="flex flex-wrap gap-2">
            {SUBJECT_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleSubject(s)}
                className={`px-3 py-1.5 rounded-md text-[12.5px] font-medium border transition-colors ${
                  subjects.includes(s) ? "bg-brand-600 text-white border-brand-600" : "bg-surface-0 text-ink-700 border-border hover:border-brand-500"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </FormField>

        {submitError && <p className="text-[12.5px] text-danger">{submitError}</p>}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={() => router.back()} className="px-4 py-2.5 rounded-md border border-border text-[13.5px] font-medium text-ink-700">
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting} className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-[13.5px] font-medium py-2.5 rounded-md transition-colors">
            {isSubmitting ? "Saving…" : "Add teacher"}
          </button>
        </div>
      </form>
    </DashboardShell>
  );
}
