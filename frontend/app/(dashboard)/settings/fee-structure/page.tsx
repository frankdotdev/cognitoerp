"use client";

/**
 * Fee structure setup (doc 009). Where a school defines "SS2 Term 1 =
 * ₦45,000 tuition + ₦5,000 PTA levy" — the input to bulk invoice
 * generation (POST /finance/invoices/generate), which reads these rows.
 */
import { useState, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { FormField, inputClass } from "@/components/shared/FormField";
import { TableSkeleton } from "@/components/shared/Skeleton";
import { apiClient } from "@/lib/api-client";

interface FeeStructure {
  id: string;
  class_name: string;
  term: string;
  fee_category: string;
  amount: number;
  due_date: string;
}

const CLASSES = ["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"];

export default function FeeStructurePage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ class_name: "SS2", term: "2026-Term1", fee_category: "Tuition", amount: "", due_date: "" });
  const [error, setError] = useState<string | null>(null);

  const { data: fees, isLoading } = useQuery({
    queryKey: ["fee-structures"],
    queryFn: () => apiClient.get<FeeStructure[]>("/finance/fee-structures"),
  });

  const generateInvoices = useMutation({
    mutationFn: (payload: { class_name: string; term: string }) => apiClient.post("/finance/invoices/generate", payload),
  });

  const createFee = useMutation({
    mutationFn: (payload: typeof form) =>
      apiClient.post("/finance/fee-structures", { ...payload, amount: Number(payload.amount) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fee-structures"] });
      setShowForm(false);
      setForm({ class_name: "SS2", term: "2026-Term1", fee_category: "Tuition", amount: "", due_date: "" });
    },
    onError: () => setError("Couldn't save this fee. Check the amount and due date."),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.amount || Number(form.amount) <= 0) return setError("Enter an amount greater than zero.");
    if (!form.due_date) return setError("Set a due date.");
    createFee.mutate(form);
  }

  // Group by class + term so a school sees "SS2 Term 1: ₦50,000 total" at a glance.
  const grouped = (fees ?? []).reduce<Record<string, { items: FeeStructure[]; total: number }>>((acc, fee) => {
    const key = `${fee.class_name} — ${fee.term}`;
    if (!acc[key]) acc[key] = { items: [], total: 0 };
    acc[key].items.push(fee);
    acc[key].total += fee.amount;
    return acc;
  }, {});

  return (
    <DashboardShell userName="Mrs. Adeyemi" permissions={new Set(["fees.edit"])}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[22px] font-bold">Fee structure</h1>
          <p className="text-[13px] text-ink-500 mt-0.5">What each class owes, per term</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-[13.5px] font-medium px-4 py-2.5 rounded-md transition-colors">
          <Plus size={15} /> Add fee
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-surface-1 border border-border rounded-[10px] p-5 mb-5 max-w-lg flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Class">
              <select value={form.class_name} onChange={(e) => setForm({ ...form, class_name: e.target.value })} className={inputClass()}>
                {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </FormField>
            <FormField label="Term" hint="e.g. 2026-Term1">
              <input value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })} className={inputClass()} />
            </FormField>
          </div>
          <FormField label="Fee category" hint="e.g. Tuition, PTA Levy, Boarding">
            <input value={form.fee_category} onChange={(e) => setForm({ ...form, fee_category: e.target.value })} className={inputClass()} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Amount (₦)">
              <input type="number" min={0} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputClass()} />
            </FormField>
            <FormField label="Due date">
              <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className={inputClass()} />
            </FormField>
          </div>
          {error && <p className="text-[12.5px] text-danger">{error}</p>}
          <button type="submit" disabled={createFee.isPending} className="self-start bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-[13px] font-medium px-4 py-2.5 rounded-md">
            {createFee.isPending ? "Saving…" : "Save fee"}
          </button>
        </form>
      )}

      {isLoading ? (
        <TableSkeleton />
      ) : Object.keys(grouped).length === 0 ? (
        <div className="bg-surface-1 border border-border rounded-[10px] p-6 text-center text-[13px] text-ink-500">
          No fee structure set up yet — add one above to start invoicing.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {Object.entries(grouped).map(([key, { items, total }]) => {
            const [className, term] = key.split(" — ");
            return (
              <div key={key} className="bg-surface-1 border border-border rounded-[10px] p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-heading font-bold text-[14.5px]">{key}</span>
                  <span className="text-[13px] font-semibold text-brand-700">₦{total.toLocaleString()}</span>
                </div>
                {items.map((f) => (
                  <div key={f.id} className="flex justify-between text-[12.5px] py-1.5 border-t border-border-soft first:border-0">
                    <span className="text-ink-500">{f.fee_category}</span>
                    <span>₦{f.amount.toLocaleString()}</span>
                  </div>
                ))}
                <button
                  onClick={() => { if (className && term) generateInvoices.mutate({ class_name: className, term }); }}
                  disabled={generateInvoices.isPending}
                  className="text-[12px] font-medium text-brand-700 hover:underline mt-3 disabled:opacity-50"
                >
                  {generateInvoices.isPending ? "Generating…" : `Generate invoices for ${className}`}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}
