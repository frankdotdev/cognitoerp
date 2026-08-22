"use client";

/**
 * Next.js's file-convention error boundary — catches any render error
 * thrown by a screen under this route group. Thin re-export; the actual
 * UI lives in components/shared/ErrorBoundary.tsx so it can be reused in
 * other route groups ((auth), (public)) without duplicating the markup.
 */
export { DashboardErrorBoundary as default } from "@/components/shared/ErrorBoundary";
