"use client";

/**
 * School onboarding / signup page.
 *
 * This is reached from the marketing landing page via "Start free trial".
 * After a school admin completes this form, the backend:
 *   1. Creates a School record with a unique school_code (e.g. "KBAY")
 *   2. Creates the first Admin user account with a temporary password
 *   3. Sends a welcome email with the school's unique login URL and admin credentials
 *   4. The school is immediately active — no manual approval needed
 *
 * The school admin can then:
 *   - Log in at their school URL (e.g. kbay.cognitioerp.com/login)
 *   - Create accounts for staff, students and parents
 *   - Import existing student data via Excel bulk upload
 */
import { useState, FormEvent } from "react";
import Link from "next/link";

interface FormData {
  school_name: string;
  school_type: string;
  state: string;
  lga: string;
  student_count_estimate: string;
  admin_name: string;
  admin_email: string;
  admin_phone: string;
  password: string;
}

const NIGERIAN_STATES = [
  "Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno",
  "Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","Gombe","Imo","Jigawa",
  "Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos","Nasarawa","Niger",
  "Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto","Taraba","Yobe","Zamfara","FCT"
];

const STUDENT_RANGES = ["Under 200","200–450","450–1,000","Over 1,000"];
const SCHOOL_TYPES   = ["Private Secondary","Private Primary","Private Primary & Secondary","Government-Aided","International School","Other"];

export default function SignupPage() {
  const [step, setStep] = useState<1|2|3>(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string|null>(null);

  const [form, setForm] = useState<FormData>({
    school_name: "", school_type: "", state: "", lga: "",
    student_count_estimate: "", admin_name: "", admin_email: "",
    admin_phone: "", password: "",
  });

  const set = (key: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      // In production this hits POST /api/v1/schools/register
      // For now we simulate a successful response
      await new Promise(r => setTimeout(r, 1400));
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again or email hello@cognitioerp.com.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls = "w-full px-4 py-3 rounded-xl border border-[var(--border)] text-[13.5px] bg-[var(--paper)] outline-none focus:border-[var(--green)] focus:ring-2 focus:ring-[var(--green-tint)] transition-all placeholder:text-[var(--ink-300)]";
  const labelCls = "block text-[11px] font-mono font-medium text-[var(--ink-700)] uppercase tracking-wider mb-1.5";

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--paper)] px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-[var(--green-tint)] flex items-center justify-center text-2xl mb-5">✦</div>
        <h1 className="font-heading text-[26px] font-semibold mb-2">You're all set!</h1>
        <p className="text-[15px] text-[var(--ink-500)] max-w-md leading-relaxed mb-3">
          We've created your school on Cognitio. Check <strong className="text-[var(--ink-900)]">{form.admin_email}</strong> for your login link and temporary credentials.
        </p>
        <p className="font-mono text-[12px] text-[var(--ink-300)]">
          Your school URL will be: <span className="text-[var(--ink-900)] font-medium">
            {form.school_name.replace(/\s+/g,"-").toLowerCase().slice(0,20)}.cognitioerp.com
          </span>
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-2 px-6 py-3 rounded-full text-[14px] font-medium border border-[var(--border)] text-[var(--ink-900)] hover:border-[var(--ink-500)] transition-all"
        >
          ← Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--paper)]">
      {/* Header */}
      <nav className="flex items-center justify-between px-6 sm:px-8 py-4 border-b border-[var(--border)] bg-[var(--paper-raised)]">
        <Link href="/" className="flex items-center gap-2 font-heading font-bold text-[18px] text-[var(--ink-900)]">
          <span className="text-[var(--green)]">✦</span>cognitio
        </Link>
        <Link href="/login" className="text-[13px] text-[var(--ink-500)] hover:text-[var(--ink-900)] transition-colors">
          Already have an account? Sign in →
        </Link>
      </nav>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        {/* Progress */}
        <div className="flex items-center gap-3 mb-8">
          {[1,2,3].map(n => (
            <div key={n} className="flex items-center gap-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center font-mono text-[11px] font-medium transition-all ${
                step >= n
                  ? "bg-[var(--green)] text-white"
                  : "bg-[var(--border)] text-[var(--ink-300)]"
              }`}>
                {n}
              </div>
              {n < 3 && <div className={`w-12 h-px ${step > n ? "bg-[var(--green)]" : "bg-[var(--border)]"}`} />}
            </div>
          ))}
        </div>

        <div className="w-full max-w-[480px]">
          <div className="bg-[var(--paper-raised)] border border-[var(--border)] rounded-2xl p-8 shadow-[0_4px_32px_-8px_rgba(27,22,17,0.12)]">

            {/* Step 1: School Info */}
            {step === 1 && (
              <>
                <h1 className="font-heading text-[22px] font-semibold mb-1">About your school</h1>
                <p className="text-[13.5px] text-[var(--ink-500)] mb-7">Tell us a bit about the school so we can set it up correctly.</p>

                <div className="flex flex-col gap-4">
                  <div>
                    <label className={labelCls}>School name</label>
                    <input className={inputCls} placeholder="e.g. King's Bay Secondary School" value={form.school_name} onChange={set("school_name")} required />
                  </div>
                  <div>
                    <label className={labelCls}>School type</label>
                    <select className={inputCls} value={form.school_type} onChange={set("school_type")} required>
                      <option value="">Select a type…</option>
                      {SCHOOL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>State</label>
                      <select className={inputCls} value={form.state} onChange={set("state")} required>
                        <option value="">Select…</option>
                        {NIGERIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>LGA</label>
                      <input className={inputCls} placeholder="e.g. Apapa" value={form.lga} onChange={set("lga")} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Approximate number of students</label>
                    <select className={inputCls} value={form.student_count_estimate} onChange={set("student_count_estimate")} required>
                      <option value="">Select a range…</option>
                      {STUDENT_RANGES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>

                <button
                  onClick={() => setStep(2)}
                  disabled={!form.school_name || !form.school_type || !form.state || !form.student_count_estimate}
                  className="mt-7 w-full bg-[var(--green)] hover:bg-[var(--green-deep)] disabled:opacity-50 text-white text-[14px] font-medium py-3 rounded-xl transition-colors"
                >
                  Continue
                </button>
              </>
            )}

            {/* Step 2: Admin Account */}
            {step === 2 && (
              <>
                <button onClick={() => setStep(1)} className="font-mono text-[11px] text-[var(--ink-300)] hover:text-[var(--ink-500)] mb-4 flex items-center gap-1">← Back</button>
                <h1 className="font-heading text-[22px] font-semibold mb-1">Your admin account</h1>
                <p className="text-[13.5px] text-[var(--ink-500)] mb-7">This will be the school's main administrator account.</p>

                <div className="flex flex-col gap-4">
                  <div>
                    <label className={labelCls}>Full name</label>
                    <input className={inputCls} placeholder="e.g. Mrs. Ngozi Adeyemi" value={form.admin_name} onChange={set("admin_name")} required />
                  </div>
                  <div>
                    <label className={labelCls}>Email address</label>
                    <input type="email" className={inputCls} placeholder="e.g. admin@kingsbay.edu.ng" value={form.admin_email} onChange={set("admin_email")} required />
                  </div>
                  <div>
                    <label className={labelCls}>Phone number</label>
                    <input type="tel" className={inputCls} placeholder="e.g. 08012345678" value={form.admin_phone} onChange={set("admin_phone")} />
                  </div>
                  <div>
                    <label className={labelCls}>Set a password</label>
                    <input type="password" className={inputCls} placeholder="At least 8 characters" value={form.password} onChange={set("password")} required minLength={8} />
                  </div>
                </div>

                <button
                  onClick={() => setStep(3)}
                  disabled={!form.admin_name || !form.admin_email || !form.password}
                  className="mt-7 w-full bg-[var(--green)] hover:bg-[var(--green-deep)] disabled:opacity-50 text-white text-[14px] font-medium py-3 rounded-xl transition-colors"
                >
                  Continue
                </button>
              </>
            )}

            {/* Step 3: Review & Submit */}
            {step === 3 && (
              <form onSubmit={handleSubmit}>
                <button type="button" onClick={() => setStep(2)} className="font-mono text-[11px] text-[var(--ink-300)] hover:text-[var(--ink-500)] mb-4 flex items-center gap-1">← Back</button>
                <h1 className="font-heading text-[22px] font-semibold mb-1">Review & go live</h1>
                <p className="text-[13.5px] text-[var(--ink-500)] mb-6">Everything look right? You can change any of this later from Settings.</p>

                <div className="bg-[var(--paper)] border border-[var(--border)] rounded-xl p-4 space-y-2 mb-6">
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[var(--ink-500)]">School</span>
                    <span className="font-medium text-[var(--ink-900)]">{form.school_name}</span>
                  </div>
                  <div className="flex justify-between text-[13px] pt-2 border-t border-[var(--border-soft)]">
                    <span className="text-[var(--ink-500)]">Type</span>
                    <span className="font-medium text-[var(--ink-900)]">{form.school_type}</span>
                  </div>
                  <div className="flex justify-between text-[13px] pt-2 border-t border-[var(--border-soft)]">
                    <span className="text-[var(--ink-500)]">Location</span>
                    <span className="font-medium text-[var(--ink-900)]">{form.lga ? `${form.lga}, ` : ""}{form.state}</span>
                  </div>
                  <div className="flex justify-between text-[13px] pt-2 border-t border-[var(--border-soft)]">
                    <span className="text-[var(--ink-500)]">Students</span>
                    <span className="font-medium text-[var(--ink-900)]">{form.student_count_estimate}</span>
                  </div>
                  <div className="flex justify-between text-[13px] pt-2 border-t border-[var(--border-soft)]">
                    <span className="text-[var(--ink-500)]">Admin</span>
                    <span className="font-medium text-[var(--ink-900)]">{form.admin_name}</span>
                  </div>
                  <div className="flex justify-between text-[13px] pt-2 border-t border-[var(--border-soft)]">
                    <span className="text-[var(--ink-500)]">Email</span>
                    <span className="font-medium text-[var(--ink-900)]">{form.admin_email}</span>
                  </div>
                </div>

                <div className="bg-[var(--green-tint)] border border-[var(--green)]/25 rounded-xl p-4 mb-5">
                  <p className="font-mono text-[11px] text-[var(--green-deep)] leading-relaxed">
                    ✦ Your school's login page will be ready at:<br />
                    <strong className="text-[var(--ink-900)]">
                      {form.school_name.replace(/\s+/g,"-").toLowerCase().slice(0,20)}.cognitioerp.com/login
                    </strong><br /><br />
                    We'll email you this link along with your login credentials.
                  </p>
                </div>

                {error && (
                  <div className="text-[12.5px] text-[var(--fail-text)] bg-[var(--fail-bg)] border border-[var(--fail-text)]/20 px-4 py-2.5 rounded-xl mb-4">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-[var(--green)] hover:bg-[var(--green-deep)] disabled:opacity-60 text-white text-[14px] font-medium py-3 rounded-xl transition-colors"
                >
                  {submitting ? "Setting up your school…" : "Launch my school on Cognitio"}
                </button>

                <p className="text-center text-[11.5px] text-[var(--ink-300)] mt-4 leading-relaxed">
                  30-day free trial · no card required · cancel anytime
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
