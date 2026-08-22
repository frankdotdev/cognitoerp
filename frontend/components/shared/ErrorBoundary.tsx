"use client";

/**
 * Fixes a systemic gap: no screen previously had any error boundary, so a
 * thrown render error would produce a blank white screen with no
 * indication anything went wrong — the worst possible outcome for a
 * school administrator mid-task. Used via Next.js's error.tsx file
 * convention in each route group (see app/(dashboard)/error.tsx).
 */
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export function DashboardErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // In production this should also report to Sentry (docs/017) — logged
    // here for now so the failure is at least visible during development.
    console.error("Dashboard render error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-0 px-4">
      <div className="max-w-sm text-center">
        <div className="w-12 h-12 rounded-full bg-danger-bg flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={20} className="text-danger" />
        </div>
        <h1 className="font-heading font-bold text-[17px] mb-1.5">Something went wrong</h1>
        <p className="text-[13px] text-ink-500 mb-6">
          This page hit an unexpected error. Your data hasn't been affected — try again, or go back to the dashboard.
        </p>
        <div className="flex gap-2 justify-center">
          <button
            onClick={reset}
            className="bg-brand-600 hover:bg-brand-700 text-white text-[13px] font-medium px-4 py-2.5 rounded-md transition-colors"
          >
            Try again
          </button>
          <a
            href="/dashboard"
            className="border border-border text-[13px] font-medium px-4 py-2.5 rounded-md text-ink-700"
          >
            Go to dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
