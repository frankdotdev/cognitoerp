"use client";

/**
 * Finance screen (doc 009): outstanding fees at a glance, filterable by
 * status. The stat row uses the same StatCard shape as the Principal
 * dashboard deliberately — Finance and Principal should never show
 * different numbers for the same underlying data (doc 014's requirement).
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { DataTable, Column } from "@/components/shared/DataTable";
import { apiClient } from "@/lib/api-client";

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

function RecordPaymentModal({
  invoices,
  onClose,
}: {
  invoices: Invoice[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const eligibleInvoices = invoices.filter((i) => i.status !== "paid");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(
    eligibleInvoices[0]?.id || ""
  );
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");

  const recordPaymentMutation = useMutation({
    mutationFn: async () => {
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error("Please enter a valid positive payment amount.");
      }
      return apiClient.post("/finance/payments/manual", {
        invoice_id: selectedInvoiceId,
        amount: parsedAmount,
        idempotency_key: crypto.randomUUID(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      onClose();
    },
    onError: (err: any) => {
      setError(err?.response?.data?.detail || err.message || "Failed to record payment.");
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-surface-1 border border-border rounded-[10px] p-6 max-w-md w-full shadow-lg">
        <h3 className="font-heading font-bold text-[18px] mb-4">Record Payment</h3>

        {error && (
          <div className="mb-4 text-[12px] bg-danger-bg text-danger p-2.5 rounded-md border border-danger/20">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-[11.5px] font-medium text-ink-300 mb-1">
              Select Invoice
            </label>
            <select
              value={selectedInvoiceId}
              onChange={(e) => setSelectedInvoiceId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-md border border-border bg-surface-1 text-[13px] outline-none focus:border-brand-500"
            >
              {eligibleInvoices.length === 0 ? (
                <option value="">No unpaid invoices found</option>
              ) : (
                eligibleInvoices.map((inv) => {
                  const balance = inv.total_amount - (inv.discount_amount || 0) - inv.amount_paid;
                  return (
                    <option key={inv.id} value={inv.id}>
                      {inv.term} — Balance: ₦{balance.toLocaleString()}
                    </option>
                  );
                })
              )}
            </select>
          </div>

          <div>
            <label className="block text-[11.5px] font-medium text-ink-300 mb-1">
              Amount (₦)
            </label>
            <input
              type="number"
              min="1"
              placeholder="e.g. 50000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-md border border-border bg-surface-1 text-[13px] outline-none focus:border-brand-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md text-[13px] font-medium border border-border hover:bg-surface-2 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={recordPaymentMutation.isPending || !selectedInvoiceId}
            onClick={() => recordPaymentMutation.mutate()}
            className="px-4 py-2 rounded-md text-[13px] font-medium bg-brand-600 hover:bg-brand-700 text-white transition-colors disabled:opacity-50"
          >
            {recordPaymentMutation.isPending ? "Recording..." : "Record Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FinancePage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [showModal, setShowModal] = useState(false);

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["invoices", statusFilter],
    queryFn: () =>
      apiClient.get<Invoice[]>("/finance/invoices", {
        params: { status_filter: statusFilter || undefined },
      }),
  });

  const outstanding = (invoices ?? []).reduce(
    (sum, inv) => sum + (inv.total_amount - (inv.discount_amount || 0) - inv.amount_paid),
    0
  );
  const collected = (invoices ?? []).reduce((sum, inv) => sum + inv.amount_paid, 0);

  const columns: Column<Invoice>[] = [
    { key: "term", header: "Term", render: (i) => i.term },
    { key: "total_amount", header: "Total", render: (i) => `₦${i.total_amount.toLocaleString()}` },
    { key: "amount_paid", header: "Paid", render: (i) => `₦${i.amount_paid.toLocaleString()}` },
    { key: "due_date", header: "Due", render: (i) => new Date(i.due_date).toLocaleDateString() },
    { key: "status", header: "Status", render: (i) => <StatusPill status={i.status} /> },
  ];

  return (
    <DashboardShell userName="Mrs. Adeyemi" permissions={new Set(["*"])}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[22px] font-bold">Finance</h1>
          <p className="text-[13px] text-ink-500 mt-0.5">Fee collection across the current session</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-brand-600 hover:bg-brand-700 text-white font-medium text-[13px] px-4 py-2 rounded-md transition-colors"
        >
          Record Payment
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <div className="bg-surface-1 border border-border rounded-[10px] p-4">
          <div className="text-[11.5px] text-ink-300 mb-1.5">Collected</div>
          <div className="font-heading font-bold text-[18px] sm:text-[20px]">₦{collected.toLocaleString()}</div>
        </div>
        <div className="bg-surface-1 border border-border rounded-[10px] p-4">
          <div className="text-[11.5px] text-ink-300 mb-1.5">Outstanding</div>
          <div className="font-heading font-bold text-[18px] sm:text-[20px]">₦{outstanding.toLocaleString()}</div>
        </div>
        <div className="bg-surface-1 border border-border rounded-[10px] p-4 col-span-2 sm:col-span-1">
          <div className="text-[11.5px] text-ink-300 mb-1.5">Invoices</div>
          <div className="font-heading font-bold text-[18px] sm:text-[20px]">{invoices?.length ?? 0}</div>
        </div>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {["", "unpaid", "partial", "paid", "overdue"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`shrink-0 px-3.5 py-2 rounded-md text-[13px] font-medium border transition-colors ${
              statusFilter === s
                ? "bg-brand-600 text-white border-brand-600"
                : "bg-surface-1 text-ink-700 border-border hover:border-brand-500"
            }`}
          >
            {s === "" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={invoices ?? []}
        isLoading={isLoading}
        emptyMessage="No invoices match this filter."
        page={1}
        pageSize={25}
        totalCount={invoices?.length ?? 0}
        onPageChange={() => {}}
      />

      {showModal && (
        <RecordPaymentModal
          invoices={invoices ?? []}
          onClose={() => setShowModal(false)}
        />
      )}
    </DashboardShell>
  );
}
