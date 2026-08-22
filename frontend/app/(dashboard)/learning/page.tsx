"use client";

/**
 * Launcher placeholder for Cognitio LMS (the LMS — a separate product, same
 * ecosystem, per the architecture doc). Once Cognitio LMS exists, this becomes
 * a redirect carrying the current session's token to its subdomain (SSO,
 * no second login) — everything else in the ERP (this nav entry, the
 * permission gating) is already correct and doesn't change when that
 * happens. Until then, this page does two honest things: explains what's
 * coming, and — if the school hasn't enabled the LMS addon — offers the
 * upgrade path, since Learning/Assessments are each separately-priced
 * products a school opts into via their Cognitio plan or standalone.
 */
import { useQuery } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { apiClient } from "@/lib/api-client";

interface School {
  lms_enabled: boolean;
}

export default function LearningPage() {
  const { data: school } = useQuery({
    queryKey: ["my-school"],
    queryFn: () => apiClient.get<School>("/schools/me"),
  });

  return (
    <DashboardShell userName="Mrs. Adeyemi" permissions={new Set(["*"])}>
      <div className="max-w-md mx-auto mt-10 text-center">
        <div className="w-14 h-14 rounded-full bg-brand-50 flex items-center justify-center mx-auto mb-5">
          <BookOpen size={22} className="text-brand-700" />
        </div>
        <h1 className="font-heading font-bold text-[19px] mb-2">Learning is coming to Cognitio</h1>
        <p className="text-[13.5px] text-ink-500 mb-6">
          Course content, lesson videos, assignments, and AI-assisted lesson support — built as its own product
          (Cognitio LMS), connected to your school data with one login, no separate sign-in.
        </p>
        {school?.lms_enabled ? (
          <p className="text-[12.5px] text-brand-700 font-medium">Your plan includes this — it'll appear here automatically at launch.</p>
        ) : (
          <p className="text-[12.5px] text-ink-300">Ask your school administrator about adding Learning to your plan.</p>
        )}
      </div>
    </DashboardShell>
  );
}
