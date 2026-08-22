"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { FormField, inputClass } from "@/components/shared/FormField";
import { apiClient } from "@/lib/api-client";

export default function LinkChildPage() {
  const router = useRouter();
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<"approved" | "pending" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const link = await apiClient.post<{ status: string }>("/parents/children/link", {
        admission_number: admissionNumber.trim(),
        date_of_birth: dateOfBirth,
      });
      setResult(link.status === "approved" ? "approved" : "pending");
    } catch {
      setError("Couldn't find a student with that admission number. Check with the school office if this continues.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (result) {
    return (
      <DashboardShell userName="Mr. Okafor" permissions={new Set(["own_children.view"])}>
        <div className="max-w-md mx-auto mt-8 text-center">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${result === "approved" ? "bg-brand-50" : "bg-warning-bg"}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={result === "approved" ? "#0E7C4A" : "#B8791A"} strokeWidth="2.5">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h1 className="font-heading font-bold text-[17px] mb-1.5">
            {result === "approved" ? "Child linked" : "Request submitted"}
          </h1>
          <p className="text-[13px] text-ink-500 mb-6">
            {result === "approved"
              ? "You can now see this child's attendance, results, and fees on your dashboard."
              : "The details didn't fully match our records, so the school office will review and confirm this shortly."}
          </p>
          <button onClick={() => router.push("/parent")} className="bg-brand-600 hover:bg-brand-700 text-white text-[13.5px] font-medium px-5 py-2.5 rounded-md">
            Go to dashboard
          </button>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell userName="Mr. Okafor" permissions={new Set(["own_children.view"])}>
      <div className="mb-5">
        <h1 className="text-[22px] font-bold">Link a child</h1>
        <p className="text-[13px] text-ink-500 mt-0.5">Enter your child's admission number and date of birth to see their information</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-md bg-surface-1 border border-border rounded-[10px] p-5 flex flex-col gap-4">
        <FormField label="Admission number" required hint="Found on your child's ID card or admission letter">
          <input value={admissionNumber} onChange={(e) => setAdmissionNumber(e.target.value)} className={inputClass()} placeholder="e.g. CMS-ADMN-2026-00341" />
        </FormField>
        <FormField label="Child's date of birth" required>
          <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className={inputClass()} />
        </FormField>

        {error && <p className="text-[12.5px] text-danger">{error}</p>}

        <button type="submit" disabled={isSubmitting || !admissionNumber || !dateOfBirth} className="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-[13.5px] font-medium py-2.5 rounded-md transition-colors">
          {isSubmitting ? "Checking…" : "Link child"}
        </button>
      </form>
    </DashboardShell>
  );
}
