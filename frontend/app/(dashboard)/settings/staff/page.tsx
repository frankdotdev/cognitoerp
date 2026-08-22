"use client";

/**
 * Staff account creation (Settings > Staff) — the piece that makes
 * "the admin sets up the principal's account" a real workflow, not just a
 * conversation. Whoever ran onboarding (often the school's IT-minded
 * person, not necessarily the principal) uses this to issue a proper,
 * appropriately-scoped login for the Principal, Registrar, Accountant,
 * Librarian, or ICT Admin — each gets their own Identity Code and a
 * welcome email, exactly like a teacher or student would.
 */
import { useState, FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { FormField, inputClass } from "@/components/shared/FormField";
import { apiClient } from "@/lib/api-client";

const ROLES = ["Principal", "Vice Principal", "Registrar", "Accountant", "Librarian", "ICT Admin"];

export default function StaffAccountsPage() {
  const [fullName, setFullName] = useState("");
  const [roleName, setRoleName] = useState("Principal");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ identity_code: string; full_name: string; role_name: string } | null>(null);

  const create = useMutation({
    mutationFn: () => apiClient.post<{ identity_code: string; full_name: string; role_name: string }>(
      "/schools/me/staff-accounts", { full_name: fullName, role_name: roleName, email: email || undefined, phone: phone || undefined }
    ),
    onSuccess: (result) => {
      setCreated(result);
      setFullName(""); setEmail(""); setPhone("");
    },
    onError: () => setError("Couldn't create this account — check the details and try again."),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (fullName.trim().length < 2) return setError("Enter a full name.");
    if (!email && !phone) return setError("Provide at least an email or phone number so they can receive their login.");
    create.mutate();
  }

  return (
    <DashboardShell userName="Mrs. Adeyemi" permissions={new Set(["staff.manage"])}>
      <div className="mb-5">
        <h1 className="text-[22px] font-bold">Staff accounts</h1>
        <p className="text-[13px] text-ink-500 mt-0.5">
          Create a login for the Principal, Registrar, Accountant, Librarian, or ICT Admin — each gets their own
          sign-in code and a welcome email.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-lg bg-surface-1 border border-border rounded-[10px] p-5 flex flex-col gap-4">
        <FormField label="Full name" required>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass()} />
        </FormField>
        <FormField label="Role" required>
          <select value={roleName} onChange={(e) => setRoleName(e.target.value)} className={inputClass()}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Email" hint="Used to send their login">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass()} />
          </FormField>
          <FormField label="Phone">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass()} />
          </FormField>
        </div>

        {error && <p className="text-[12.5px] text-danger">{error}</p>}

        <button type="submit" disabled={create.isPending} className="self-start bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-[13.5px] font-medium px-4 py-2.5 rounded-md">
          {create.isPending ? "Creating…" : "Create account"}
        </button>
      </form>

      {created && (
        <div className="max-w-lg bg-brand-50 border border-brand-100 rounded-[10px] p-4 mt-4">
          <p className="text-[13px] font-medium text-brand-700 mb-1">
            {created.full_name}'s {created.role_name} account is ready
          </p>
          <p className="text-[12px] text-brand-700">
            Sign-in code: <span className="font-mono">{created.identity_code}</span> — their password was sent by email.
          </p>
        </div>
      )}
    </DashboardShell>
  );
}
