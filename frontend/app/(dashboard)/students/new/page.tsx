"use client";

/**
 * Student create form — the gap flagged in review: the list screen existed
 * with no way to add a student through the UI. Calls the real
 * POST /students endpoint. Validation happens client-side for immediate
 * feedback AND server-side (Pydantic) regardless — this form's validation
 * is a UX convenience, never the actual security/integrity boundary.
 */
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { FormField, inputClass } from "@/components/shared/FormField";
import { apiClient } from "@/lib/api-client";

const CLASSES = ["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"];

interface FormState {
  full_name: string;
  date_of_birth: string;
  gender: string;
  class_name: string;
  section: string;
  admission_date: string;
  guardian_name: string;
  guardian_phone: string;
  guardian_email: string;
}

const INITIAL: FormState = {
  full_name: "", date_of_birth: "", gender: "", class_name: "JSS1", section: "",
  admission_date: new Date().toISOString().slice(0, 10), guardian_name: "", guardian_phone: "", guardian_email: "",
};

export default function NewStudentPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (form.full_name.trim().length < 2) next.full_name = "Enter the student's full name.";
    if (!form.class_name) next.class_name = "Select a class.";
    if (!form.admission_date) next.admission_date = "Admission date is required.";
    if (form.guardian_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.guardian_email)) {
      next.guardian_email = "That doesn't look like a valid email address.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await apiClient.post("/students", {
        ...form,
        date_of_birth: form.date_of_birth || undefined,
        gender: form.gender || undefined,
        section: form.section || undefined,
        guardian_name: form.guardian_name || undefined,
        guardian_phone: form.guardian_phone || undefined,
        guardian_email: form.guardian_email || undefined,
      });
      router.push("/students");
    } catch {
      setSubmitError("Couldn't save this student. Check the details and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <DashboardShell userName="Mrs. Adeyemi" permissions={new Set(["students.create"])}>
      <div className="mb-5">
        <h1 className="text-[22px] font-bold">Add student</h1>
        <p className="text-[13px] text-ink-500 mt-0.5">A registration number and login will be generated automatically</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-lg bg-surface-1 border border-border rounded-[10px] p-5 flex flex-col gap-4">
        <FormField label="Full name" required error={errors.full_name}>
          <input value={form.full_name} onChange={(e) => update("full_name", e.target.value)} className={inputClass(!!errors.full_name)} placeholder="e.g. Amaka Obi" />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Date of birth">
            <input type="date" value={form.date_of_birth} onChange={(e) => update("date_of_birth", e.target.value)} className={inputClass()} />
          </FormField>
          <FormField label="Gender">
            <select value={form.gender} onChange={(e) => update("gender", e.target.value)} className={inputClass()}>
              <option value="">—</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Class" required error={errors.class_name}>
            <select value={form.class_name} onChange={(e) => update("class_name", e.target.value)} className={inputClass(!!errors.class_name)}>
              {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </FormField>
          <FormField label="Section">
            <input value={form.section} onChange={(e) => update("section", e.target.value)} className={inputClass()} placeholder="e.g. Gold" />
          </FormField>
        </div>

        <FormField label="Admission date" required error={errors.admission_date}>
          <input type="date" value={form.admission_date} onChange={(e) => update("admission_date", e.target.value)} className={inputClass(!!errors.admission_date)} />
        </FormField>

        <div className="pt-2 border-t border-border-soft">
          <p className="text-[12.5px] font-medium text-ink-700 mb-3">Guardian details (optional)</p>
          <div className="flex flex-col gap-4">
            <FormField label="Guardian name">
              <input value={form.guardian_name} onChange={(e) => update("guardian_name", e.target.value)} className={inputClass()} />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Phone">
                <input value={form.guardian_phone} onChange={(e) => update("guardian_phone", e.target.value)} className={inputClass()} />
              </FormField>
              <FormField label="Email" error={errors.guardian_email}>
                <input value={form.guardian_email} onChange={(e) => update("guardian_email", e.target.value)} className={inputClass(!!errors.guardian_email)} />
              </FormField>
            </div>
          </div>
        </div>

        {submitError && <p className="text-[12.5px] text-danger">{submitError}</p>}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={() => router.back()} className="px-4 py-2.5 rounded-md border border-border text-[13.5px] font-medium text-ink-700">
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting} className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-[13.5px] font-medium py-2.5 rounded-md transition-colors">
            {isSubmitting ? "Saving…" : "Add student"}
          </button>
        </div>
      </form>
    </DashboardShell>
  );
}
