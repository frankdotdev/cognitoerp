"use client";

/**
 * Login screen — warm paper design system.
 *
 * Flow:
 *   1. User navigates to their school's URL (e.g. kingsbay.cognitioerp.com)
 *   2. The page resolves the school from the subdomain via useSchoolContext
 *   3. User enters their identity code + password → POST /auth/login
 *   4. If must_change_password → forced reset page
 *   5. Otherwise → role-based dashboard redirect
 */
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { useSchoolContext } from "@/lib/school-context";

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  must_change_password: boolean;
}

export default function LoginPage() {
  const router = useRouter();
  const { school, isLoading: schoolLoading, notFound } = useSchoolContext();
  const [identityCode, setIdentityCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!school) return;
    setIsSubmitting(true);
    try {
      const result = await apiClient.post<LoginResponse>("/auth/login", {
        school_id: school.id,
        identity_code: identityCode.trim().toUpperCase(),
        password,
      });

      if (result.must_change_password) {
        router.push(`/reset-password?identity_code=${encodeURIComponent(identityCode.trim().toUpperCase())}`);
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("That identity code or password isn't right.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (schoolLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--paper)]">
        <div className="text-center">
          <div className="text-[var(--green)] text-2xl mb-3">✦</div>
          <p className="font-mono text-[12px] text-[var(--ink-300)]">Loading…</p>
        </div>
      </div>
    );
  }

  if (notFound || !school) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--paper)] px-4">
        <div className="max-w-sm text-center">
          <Link href="/" className="flex items-center gap-2 justify-center font-heading font-bold text-[20px] text-[var(--ink-900)] mb-6">
            <span className="text-[var(--green)]">✦</span>cognitio
          </Link>
          <h1 className="font-heading font-semibold text-[20px] mb-2">School not found</h1>
          <p className="text-[13.5px] text-[var(--ink-500)] leading-relaxed">
            We couldn't find a school at this address. Check the link your school gave you, or{" "}
            <Link href="/" className="text-[var(--green)] underline underline-offset-2">
              visit cognitioerp.com
            </Link>{" "}
            to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--paper)] px-4 py-12">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 font-heading font-bold text-[20px] text-[var(--ink-900)] mb-2">
        <span className="text-[var(--green)]">✦</span>cognitio
      </Link>
      <p className="font-mono text-[12px] text-[var(--ink-300)] mb-8">{school.name}</p>

      {/* Card */}
      <div className="w-full max-w-[390px] bg-[var(--paper-raised)] border border-[var(--border)] rounded-2xl p-8 shadow-[0_4px_32px_-8px_rgba(27,22,17,0.12)]">
        <h1 className="font-heading font-semibold text-[22px] mb-1">Sign in</h1>
        <p className="text-[13.5px] text-[var(--ink-500)] mb-7">
          Use the identity code your school gave you.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-[12px] font-medium text-[var(--ink-700)] mb-1.5 uppercase tracking-wide font-mono">
              Identity code
            </label>
            <input
              value={identityCode}
              onChange={(e) => setIdentityCode(e.target.value)}
              placeholder={`${school.school_code}-STU-2026-00341`}
              className="w-full px-4 py-3 rounded-xl border border-[var(--border)] font-mono text-[13.5px] bg-[var(--paper)] outline-none focus:border-[var(--green)] focus:ring-2 focus:ring-[var(--green-tint)] transition-all placeholder:text-[var(--ink-300)]"
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[12px] font-medium text-[var(--ink-700)] uppercase tracking-wide font-mono">
                Password
              </label>
              <Link href="/reset-password" className="text-[12px] text-[var(--green)] hover:underline">
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-[var(--border)] text-[13.5px] bg-[var(--paper)] outline-none focus:border-[var(--green)] focus:ring-2 focus:ring-[var(--green-tint)] transition-all"
              required
            />
          </div>

          {error && (
            <div className="text-[12.5px] text-[var(--fail-text)] bg-[var(--fail-bg)] border border-[var(--fail-text)]/20 px-4 py-2.5 rounded-xl">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-1 bg-[var(--green)] hover:bg-[var(--green-deep)] disabled:opacity-60 text-white text-[14px] font-medium py-3 rounded-xl transition-colors"
          >
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-center text-[12px] text-[var(--ink-300)] mt-6 leading-relaxed">
          First time here? Use the temporary password your school sent you.<br />
          It'll prompt you to set your own password on first sign-in.
        </p>
      </div>

      {/* Back link */}
      <Link href="/" className="mt-6 text-[12.5px] text-[var(--ink-300)] hover:text-[var(--ink-500)] transition-colors">
        ← Back to cognitioerp.com
      </Link>
    </div>
  );
}
