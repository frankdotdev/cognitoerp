"use client";

/**
 * Launcher placeholder for Cognitio Assess (the CBT product). Same pattern as
 * Learning — see that file's docstring for the SSO-handoff design this
 * becomes once Cognitio Assess actually exists.
 */
import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck } from "lucide-react";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { apiClient } from "@/lib/api-client";

interface School {
  cbt_enabled: boolean;
}

export default function AssessmentsPage() {
  const { data: school } = useQuery({
    queryKey: ["my-school"],
    queryFn: () => apiClient.get<School>("/schools/me"),
  });

  return (
    <DashboardShell userName="Mrs. Adeyemi" permissions={new Set(["*"])}>
      <div className="max-w-md mx-auto mt-10 text-center">
        <div className="w-14 h-14 rounded-full bg-brand-50 flex items-center justify-center mx-auto mb-5">
          <ClipboardCheck size={22} className="text-brand-700" />
        </div>
        <h1 className="font-heading font-bold text-[19px] mb-2">Assessments is coming to Cognitio</h1>
        <p className="text-[13.5px] text-ink-500 mb-6">
          Give students a quiz, practice test, or exam directly from a class — built as its own CBT product
          (Cognitio Assess), connected with one login. Assignments given from Results or a future Learning course will
          launch straight into it.
        </p>
        {school?.cbt_enabled ? (
          <p className="text-[12.5px] text-brand-700 font-medium">Your plan includes this — it'll appear here automatically at launch.</p>
        ) : (
          <p className="text-[12.5px] text-ink-300">Ask your school administrator about adding Assessments to your plan.</p>
        )}
      </div>
    </DashboardShell>
  );
}
