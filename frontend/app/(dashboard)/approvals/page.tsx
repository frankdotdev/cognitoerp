"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, X, Package, Calendar, Users } from "lucide-react";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { TableSkeleton } from "@/components/shared/Skeleton";
import { apiClient } from "@/lib/api-client";

interface ApprovalItem {
  id: string;
  type: "parent_link" | "purchase_request" | "leave_request";
  summary: string;
  created_at: string;
}

const TYPE_CONFIG: Record<ApprovalItem["type"], { icon: typeof Users; label: string; endpoint: (id: string) => string }> = {
  parent_link: { icon: Users, label: "Parent link", endpoint: (id: string) => `/parents/children/links/${id}/approve` },
  purchase_request: { icon: Package, label: "Purchase request", endpoint: (id: string) => `/inventory/purchase-requests/${id}/approve` },
  leave_request: { icon: Calendar, label: "Leave request", endpoint: (id: string) => `/hr/leave-requests/${id}/approve` },
};

const REJECT_ENDPOINTS: Record<ApprovalItem["type"], (id: string) => string | null> = {
  parent_link: () => null, // no reject path built for parent links yet — only approve exists
  purchase_request: (id) => `/inventory/purchase-requests/${id}/reject`,
  leave_request: (id) => `/hr/leave-requests/${id}/reject`,
};

export default function ApprovalsPage() {
  const queryClient = useQueryClient();

  const { data: approvals, isLoading } = useQuery({
    queryKey: ["approvals"],
    queryFn: () => apiClient.get<ApprovalItem[]>("/schools/me/approvals"),
  });

  const approve = useMutation({
    mutationFn: (item: ApprovalItem) => apiClient.post(TYPE_CONFIG[item.type].endpoint(item.id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["approvals"] }),
  });

  const reject = useMutation({
    mutationFn: (item: ApprovalItem) => {
      const rejectFn = REJECT_ENDPOINTS[item.type];
      const endpoint = rejectFn ? rejectFn(item.id) : null;
      if (!endpoint) throw new Error("No reject action available for this type");
      return apiClient.post(endpoint);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["approvals"] }),
  });

  return (
    <DashboardShell userName="Mrs. Adeyemi" permissions={new Set(["staff.manage"])}>
      <div className="mb-5">
        <h1 className="text-[22px] font-bold">Approvals</h1>
        <p className="text-[13px] text-ink-500 mt-0.5">{approvals ? `${approvals.length} pending` : "\u00A0"}</p>
      </div>

      {isLoading ? (
        <TableSkeleton rows={3} />
      ) : (approvals ?? []).length === 0 ? (
        <div className="bg-surface-1 border border-border rounded-[10px] p-8 text-center text-[13px] text-ink-500">
          Nothing waiting on you right now.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {(approvals ?? []).map((item) => {
            const config = TYPE_CONFIG[item.type];
            const Icon = config.icon;
            const rejectFn = REJECT_ENDPOINTS[item.type];
            const canReject = rejectFn ? rejectFn(item.id) !== null : false;
            return (
              <div key={item.id} className="bg-surface-1 border border-border rounded-[10px] p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-md bg-surface-0 flex items-center justify-center shrink-0">
                  <Icon size={16} className="text-ink-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11.5px] text-ink-300">{config.label}</div>
                  <div className="text-[13.5px] font-medium truncate">{item.summary}</div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {canReject && (
                    <button
                      onClick={() => reject.mutate(item)}
                      disabled={reject.isPending}
                      className="w-8 h-8 rounded-md border border-border flex items-center justify-center text-danger hover:bg-danger-bg transition-colors"
                      aria-label="Reject"
                    >
                      <X size={15} />
                    </button>
                  )}
                  <button
                    onClick={() => approve.mutate(item)}
                    disabled={approve.isPending}
                    className="w-8 h-8 rounded-md bg-brand-600 hover:bg-brand-700 flex items-center justify-center text-white transition-colors"
                    aria-label="Approve"
                  >
                    <Check size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}
