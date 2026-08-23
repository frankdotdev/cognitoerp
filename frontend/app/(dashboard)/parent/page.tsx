"use client";

/**
 * Parent dashboard (doc 008): per-child attendance, results, fees,
 * homework, messages, calendar — with a lightweight child switcher rather
 * than a re-login, since one parent can have several children.
 */
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { School as SchoolIcon, CreditCard, ExternalLink } from "lucide-react";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { useSchoolContext } from "@/lib/school-context";
import { getSavedSchools, saveSchool, SavedSchool } from "@/lib/my-schools";
import { apiClient } from "@/lib/api-client";

interface ChildLink {
  id: string;
  student_id: string;
  status: string;
}

interface ChildSummary {
  student_id: string;
  full_name: string;
  class_name: string;
  attendance_percent: number | null;
  outstanding_fees: number;
  latest_report_card_published: boolean;
}

interface Invoice {
  id: string;
  student_id: string;
  term: string;
  total_amount: number;
  discount_amount?: number;
  amount_paid: number;
  due_date: string;
  status: string;
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    paid: "bg-brand-50 text-brand-700",
    partial: "bg-warning-bg text-warning",
    unpaid: "bg-danger-bg text-danger",
    overdue: "bg-danger-bg text-danger",
  };
  return (
    <span className={`text-[10.5px] font-semibold px-2.5 py-1 rounded-full ${styles[status] ?? styles.unpaid}`}>
      {status}
    </span>
  );
}

export default function ParentDashboardPage() {
  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  const { school } = useSchoolContext();
  const [savedSchools, setSavedSchools] = useState<SavedSchool[]>([]);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  useEffect(() => {
    if (school) {
      saveSchool(school.subdomain, school.name);
      setSavedSchools(getSavedSchools());
    }
  }, [school]);

  const { data: children } = useQuery({
    queryKey: ["my-children"],
    queryFn: () => apiClient.get<ChildLink[]>("/parents/children"),
  });

  const currentChildId = activeChildId ?? children?.[0]?.student_id ?? null;

  const { data: summary, isLoading } = useQuery({
    queryKey: ["child-summary", currentChildId],
    queryFn: () => apiClient.get<ChildSummary>(`/parents/children/${currentChildId}/summary`),
    enabled: !!currentChildId,
  });

  const { data: childInvoices, isLoading: invoicesLoading } = useQuery<Invoice[]>({
    queryKey: ["child-invoices", currentChildId],
    queryFn: () => apiClient.get(`/finance/invoices`, { params: { student_id: currentChildId || undefined } }),
    enabled: !!currentChildId,
  });

  const initPaymentMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      setPayingInvoiceId(invoiceId);
      setPayError(null);
      return apiClient.post<{ authorization_url: string; reference: string }>(
        `/finance/invoices/${invoiceId}/initialize-payment`
      );
    },
    onSuccess: (data) => {
      if (data?.authorization_url) {
        window.location.href = data.authorization_url;
      }
    },
    onError: (err: any) => {
      setPayError(err?.response?.data?.detail || err.message || "Failed to initialize payment gateway.");
      setPayingInvoiceId(null);
    },
  });

  return (
    <DashboardShell userName="Mr. Okafor" permissions={new Set(["own_children.view"])}>
      {savedSchools.length > 1 && (
        <div className="relative mb-4">
          <button
            onClick={() => setShowSwitcher(!showSwitcher)}
            className="flex items-center gap-1.5 text-[12px] font-medium text-ink-500 border border-border rounded-md px-2.5 py-1.5 hover:border-brand-500"
          >
            <SchoolIcon size={12} /> {school?.name ?? "Switch school"}
          </button>
          {showSwitcher && (
            <div className="absolute left-0 top-full mt-1.5 w-64 bg-surface-1 border border-border rounded-[10px] p-1.5 shadow-lg z-10">
              {savedSchools.map((s) => (
                <a
                  key={s.subdomain}
                  href={`https://${s.subdomain}.cognitioerp.com/login`}
                  className={`block px-3 py-2 rounded-md text-[13px] ${s.subdomain === school?.subdomain ? "bg-brand-50 text-brand-700 font-medium" : "hover:bg-surface-0"}`}
                >
                  {s.schoolName}
                </a>
              ))}
              <p className="text-[10.5px] text-ink-300 px-3 pt-2 pb-1 border-t border-border-soft mt-1">
                Each school needs its own sign-in — this just remembers where your children are enrolled.
              </p>
            </div>
          )}
        </div>
      )}
      {children && children.length > 1 && (
        <div className="flex gap-2 mb-5">
          {children.map((c) => (
            <button
              key={c.student_id}
              onClick={() => setActiveChildId(c.student_id)}
              className={`px-3.5 py-2 rounded-md text-[13px] font-medium border transition-colors ${
                currentChildId === c.student_id
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-surface-1 text-ink-700 border-border hover:border-brand-500"
              }`}
            >
              Child {c.student_id.slice(0, 6)}
            </button>
          ))}
        </div>
      )}

      {!children || children.length === 0 ? (
        <div className="bg-surface-1 border border-border rounded-[10px] p-8 text-center">
          <p className="text-[14px] font-medium mb-1">No children linked yet</p>
          <p className="text-[13px] text-ink-500 mb-4">
            Link your child using their admission number and date of birth to see their attendance, results, and fees.
          </p>
          <button className="bg-brand-600 hover:bg-brand-700 text-white text-[13.5px] font-medium px-4 py-2.5 rounded-md">
            Link a child
          </button>
        </div>
      ) : isLoading || !summary ? (
        <p className="text-[13px] text-ink-500">Loading…</p>
      ) : (
        <>
          <div className="mb-6">
            <h1 className="text-[22px] font-bold">{summary.full_name}</h1>
            <p className="text-[13px] text-ink-500 mt-0.5">{summary.class_name}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            <div className="bg-surface-1 border border-border rounded-[10px] p-4">
              <div className="text-[11.5px] text-ink-300 mb-1.5">Attendance</div>
              <div className="font-heading font-bold text-[20px]">
                {summary.attendance_percent !== null ? `${summary.attendance_percent}%` : "—"}
              </div>
            </div>
            <div className="bg-surface-1 border border-border rounded-[10px] p-4">
              <div className="text-[11.5px] text-ink-300 mb-1.5">Outstanding fees</div>
              <div className="font-heading font-bold text-[20px]">
                ₦{summary.outstanding_fees.toLocaleString()}
              </div>
            </div>
            <div className="bg-surface-1 border border-border rounded-[10px] p-4">
              <div className="text-[11.5px] text-ink-300 mb-1.5">Latest report card</div>
              <div className="font-heading font-bold text-[16px]">
                {summary.latest_report_card_published ? "Published" : "Not yet published"}
              </div>
            </div>
          </div>

          {payError && (
            <div className="mb-4 text-[12px] bg-danger-bg text-danger p-3 rounded-md border border-danger/20">
              {payError}
            </div>
          )}

          <div className="bg-surface-1 border border-border rounded-[10px] p-5">
            <h3 className="font-heading font-bold text-[16px] mb-3">Invoices & Payments</h3>
            {invoicesLoading ? (
              <p className="text-[13px] text-ink-500">Loading invoices…</p>
            ) : !childInvoices || childInvoices.length === 0 ? (
              <p className="text-[13px] text-ink-500">No invoices issued for this child yet.</p>
            ) : (
              <div className="divide-y divide-border-soft">
                {childInvoices.map((inv) => {
                  const balance = inv.total_amount - (inv.discount_amount || 0) - inv.amount_paid;
                  return (
                    <div key={inv.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-[14px]">{inv.term}</span>
                          <StatusPill status={inv.status} />
                        </div>
                        <div className="text-[12px] text-ink-500">
                          Total: ₦{inv.total_amount.toLocaleString()} | Paid: ₦{inv.amount_paid.toLocaleString()} | Due: {new Date(inv.due_date).toLocaleDateString()}
                        </div>
                      </div>

                      {inv.status !== "paid" && balance > 0 && (
                        <button
                          disabled={payingInvoiceId === inv.id}
                          onClick={() => initPaymentMutation.mutate(inv.id)}
                          className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white font-medium text-[13px] px-3.5 py-2 rounded-md transition-colors shrink-0 disabled:opacity-50"
                        >
                          <CreditCard size={14} />
                          {payingInvoiceId === inv.id ? "Redirecting..." : `Pay Online (₦${balance.toLocaleString()})`}
                          <ExternalLink size={12} className="opacity-80" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </DashboardShell>
  );
}
