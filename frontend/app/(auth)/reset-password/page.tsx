"use client";

/**
 * Forced on every first login (must_change_password: true from
 * /auth/login). No "skip" option — per doc 003, nothing else in the app
 * is reachable until this completes. school_id comes from useSchoolContext
 * (the real fix for the subdomain-resolution gap); identity_code comes
 * from the query param the login page now passes forward.
 */
import { useState, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { useSchoolContext } from "@/lib/school-context";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const identityCode = searchParams.get("identity_code") ?? "";
  const { school, isLoading: schoolLoading } = useSchoolContext();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const meetsMinLength = newPassword.length >= 8;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!school) return setError("Couldn't determine your school — try signing in again.");
    if (!identityCode) return setError("Missing identity code — go back and sign in again.");
    if (!meetsMinLength) return setError("New password must be at least 8 characters.");
    if (!passwordsMatch) return setError("Passwords don't match.");

    setIsSubmitting(true);
    try {
      await apiClient.post("/auth/reset-password", {
        school_id: school.id,
        identity_code: identityCode,
        current_password: currentPassword,
        new_password: newPassword,
      });
      router.push("/login"); // sign in fresh with the new password
    } catch {
      setError("Couldn't update your password. Check your current password and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (schoolLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-0">
        <p className="text-[13px] text-ink-300">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-0 px-4">
      <div className="w-full max-w-[380px]">
        <div className="bg-surface-1 border border-border rounded-[14px] p-7">
          <h1 className="font-heading font-bold text-[19px] mb-1">Set a new password</h1>
          <p className="text-[13px] text-ink-500 mb-6">
            You're using a temporary password. Choose a new one to continue.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-[12.5px] font-medium text-ink-700 mb-1.5">Current (temporary) password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-md border border-border text-[13.5px] outline-none focus:border-brand-500"
                required
              />
            </div>
            <div>
              <label className="block text-[12.5px] font-medium text-ink-700 mb-1.5">New password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-md border border-border text-[13.5px] outline-none focus:border-brand-500"
                required
              />
              <p className="text-[11.5px] text-ink-300 mt-1">At least 8 characters.</p>
            </div>
            <div>
              <label className="block text-[12.5px] font-medium text-ink-700 mb-1.5">Confirm new password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-md border border-border text-[13.5px] outline-none focus:border-brand-500"
                required
              />
            </div>

            {error && <p className="text-[12.5px] text-danger">{error}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-[14px] font-medium py-2.5 rounded-md transition-colors"
            >
              {isSubmitting ? "Updating…" : "Update password and continue"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  // useSearchParams requires a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface-0" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
