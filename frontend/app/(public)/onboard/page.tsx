"use client";

/**
 * The onboarding wizard (doc 005). Three steps here — School Identity,
 * Principal Details, Plan — matching the launch-critical subset of the
 * doc's 5-step flow (branding customization and bulk import are real
 * follow-on screens, not part of getting a school able to log in for the
 * first time, so they're deliberately not gating this wizard).
 *
 * Submits once, at the end, to the real POST /schools/onboard endpoint —
 * not simulated. That endpoint atomically creates the school, seeds
 * default roles, and creates the first Super Admin account in one
 * transaction (schools/service.py) — this screen's only job is collecting
 * the input correctly and showing the result.
 */
import { useState } from "react";
import { apiClient } from "@/lib/api-client";

interface OnboardPayload {
  name: string;
  school_code: string;
  subdomain: string;
  motto?: string;
  address?: string;
  phone?: string;
  email?: string;
  principal_full_name: string;
  principal_email: string;
  principal_phone: string;
  plan: "foundation" | "academy" | "excellence" | "enterprise";
}

const STEPS = ["School Identity", "Principal Details", "Choose a Plan"] as const;

const PLANS = [
  { id: "foundation", name: "Foundation", students: "Up to 200 students", price: "₦25,000/month" },
  { id: "academy", name: "Academy", students: "Up to 450 students", price: "₦50,000/month" },
  { id: "excellence", name: "Excellence", students: "Up to 1,000 students", price: "₦100,000/month" },
] as const;

export default function OnboardingWizard() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Partial<OnboardPayload>>({ plan: "foundation" });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ name: string; subdomain: string } | null>(null);

  function update<K extends keyof OnboardPayload>(key: K, value: OnboardPayload[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function canProceed(): boolean {
    if (step === 0) return !!(form.name && form.school_code && form.subdomain);
    if (step === 1) return !!(form.principal_full_name && form.principal_email && form.principal_phone);
    return true;
  }

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);
    try {
      const school = await apiClient.post<{ name: string; subdomain: string }>(
        "/schools/onboard",
        form as OnboardPayload
      );
      setResult(school);
    } catch {
      setError("Couldn't create your school. Check your details and try again — school code and subdomain must be unique.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-0 px-4">
        <div className="w-full max-w-md text-center">
          <div className="w-14 h-14 rounded-full bg-brand-50 flex items-center justify-center mx-auto mb-5">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0E7C4A" strokeWidth="2.5">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h1 className="font-heading font-bold text-[22px] mb-2">{result.name} is live</h1>
          <p className="text-[14px] text-ink-500 mb-1">
            Your login details have been sent to the principal's email.
          </p>
          <p className="text-[13px] text-ink-300 mb-8 font-mono">{result.subdomain}.cognitioerp.com</p>
          <a
            href="/login"
            className="inline-block bg-brand-600 hover:bg-brand-700 text-white text-[14px] font-medium px-6 py-3 rounded-md transition-colors"
          >
            Go to sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-0 px-4 py-12 sm:py-16">
      <div className="w-full max-w-lg mx-auto">
        <div className="flex items-center gap-2 justify-center mb-8">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M12 1L14.5 9L22 12L14.5 15L12 23L9.5 15L2 12L9.5 9L12 1Z" fill="#0E7C4A" />
          </svg>
          <span className="font-heading font-bold text-[17px]">Cognitio ERP</span>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex-1 flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-semibold shrink-0 ${
                  i < step ? "bg-brand-600 text-white" : i === step ? "bg-brand-600 text-white" : "bg-surface-1 border border-border text-ink-300"
                }`}
              >
                {i < step ? "✓" : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={`h-px flex-1 ${i < step ? "bg-brand-600" : "bg-border"}`} />}
            </div>
          ))}
        </div>

        <div className="bg-surface-1 border border-border rounded-[14px] p-6 sm:p-7">
          <h1 className="font-heading font-bold text-[18px] mb-5">{STEPS[step]}</h1>

          {step === 0 && (
            <div className="flex flex-col gap-4">
              <Field label="School name" value={form.name ?? ""} onChange={(v) => update("name", v)} placeholder="Caritas Model College" />
              <Field
                label="School code"
                value={form.school_code ?? ""}
                onChange={(v) => update("school_code", v.toUpperCase())}
                placeholder="CMS"
                mono
                hint="Used in every student and staff ID — e.g. CMS-STU-2026-00341"
              />
              <Field
                label="Subdomain"
                value={form.subdomain ?? ""}
                onChange={(v) => update("subdomain", v.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="caritas-model"
                mono
                hint={`${form.subdomain || "yourschool"}.cognitioerp.com`}
              />
              <Field label="Motto (optional)" value={form.motto ?? ""} onChange={(v) => update("motto", v)} />
              <Field label="Address (optional)" value={form.address ?? ""} onChange={(v) => update("address", v)} />
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-4">
              <Field label="Principal's full name" value={form.principal_full_name ?? ""} onChange={(v) => update("principal_full_name", v)} />
              <Field label="Principal's email" value={form.principal_email ?? ""} onChange={(v) => update("principal_email", v)} type="email" hint="Login details are sent here" />
              <Field label="Principal's phone" value={form.principal_phone ?? ""} onChange={(v) => update("principal_phone", v)} type="tel" />
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-2.5">
              {PLANS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => update("plan", p.id)}
                  className={`text-left border rounded-[10px] p-4 transition-colors ${
                    form.plan === p.id ? "border-brand-600 bg-brand-50" : "border-border hover:border-brand-500"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-heading font-bold text-[14.5px]">{p.name}</span>
                    <span className="text-[13px] font-semibold text-brand-700">{p.price}</span>
                  </div>
                  <div className="text-[12.5px] text-ink-500 mt-0.5">{p.students}</div>
                </button>
              ))}
              <p className="text-[11.5px] text-ink-300 mt-1">30-day free trial on every plan — no card required to start.</p>
            </div>
          )}

          {error && <p className="text-[12.5px] text-danger mt-4">{error}</p>}

          <div className="flex gap-3 mt-6">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-4 py-2.5 rounded-md border border-border text-[13.5px] font-medium text-ink-700"
              >
                Back
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button
                onClick={() => canProceed() && setStep(step + 1)}
                disabled={!canProceed()}
                className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-[14px] font-medium py-2.5 rounded-md transition-colors"
              >
                Continue
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-[14px] font-medium py-2.5 rounded-md transition-colors"
              >
                {isSubmitting ? "Creating your school…" : "Create school"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, hint, mono, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string; mono?: boolean; type?: string;
}) {
  return (
    <div>
      <label className="block text-[12.5px] font-medium text-ink-700 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3.5 py-2.5 rounded-md border border-border text-[13.5px] outline-none focus:border-brand-500 ${mono ? "font-mono" : ""}`}
      />
      {hint && <p className="text-[11px] text-ink-300 mt-1">{hint}</p>}
    </div>
  );
}
