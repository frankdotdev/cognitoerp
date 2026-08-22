"use client";

/**
 * Inventory screen. Two views: Items (with a one-tap low-stock filter,
 * since that's the question a school actually asks — "what do we need to
 * reorder" — not "show me everything") and Purchase Requests.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { DataTable, Column } from "@/components/shared/DataTable";
import { apiClient } from "@/lib/api-client";

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  reorder_level: number;
  location: string | null;
  status: string;
}

interface PurchaseRequest {
  id: string;
  item_name: string;
  quantity_requested: number;
  status: string;
}

export default function InventoryPage() {
  const [tab, setTab] = useState<"items" | "requests">("items");
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const { data: items, isLoading } = useQuery({
    queryKey: ["inventory-items", lowStockOnly],
    queryFn: () => apiClient.get<InventoryItem[]>("/inventory/items", { params: { low_stock_only: lowStockOnly } }),
    enabled: tab === "items",
  });

  const { data: requests } = useQuery({
    queryKey: ["purchase-requests"],
    queryFn: () => apiClient.get<PurchaseRequest[]>("/inventory/purchase-requests"),
    enabled: tab === "requests",
  });

  const columns: Column<InventoryItem>[] = [
    { key: "name", header: "Item", render: (i) => <span className="font-medium">{i.name}</span> },
    { key: "category", header: "Category", render: (i) => <span className="capitalize">{i.category}</span> },
    {
      key: "quantity",
      header: "Quantity",
      render: (i) => (
        <span className="flex items-center gap-1.5">
          {i.quantity} {i.unit}
          {i.quantity <= i.reorder_level && <AlertTriangle size={12} className="text-warning" />}
        </span>
      ),
    },
    { key: "location", header: "Location", render: (i) => i.location ?? "—" },
  ];

  return (
    <DashboardShell userName="Mrs. Adeyemi" permissions={new Set(["*"])}>
      <div className="mb-5">
        <h1 className="text-[22px] font-bold">Inventory</h1>
        <p className="text-[13px] text-ink-500 mt-0.5">Furniture, ICT equipment, and lab supplies</p>
      </div>

      <div className="flex gap-1 mb-4 border-b border-border">
        {(["items", "requests"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-[13.5px] font-medium border-b-2 -mb-px transition-colors ${
              tab === t ? "border-brand-600 text-brand-700" : "border-transparent text-ink-500"
            }`}
          >
            {t === "items" ? "Items" : "Purchase Requests"}
          </button>
        ))}
      </div>

      {tab === "items" && (
        <>
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setLowStockOnly(!lowStockOnly)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-md text-[13px] font-medium border transition-colors ${
                lowStockOnly
                  ? "bg-warning-bg text-warning border-warning/30"
                  : "bg-surface-1 text-ink-700 border-border hover:border-brand-500"
              }`}
            >
              <AlertTriangle size={13} />
              Low stock only
            </button>
          </div>
          <DataTable
            columns={columns}
            rows={items ?? []}
            isLoading={isLoading}
            emptyMessage={lowStockOnly ? "Nothing is low on stock right now." : "No inventory items yet."}
            page={1}
            pageSize={50}
            totalCount={items?.length ?? 0}
            onPageChange={() => {}}
          />
        </>
      )}

      {tab === "requests" && (
        <div className="flex flex-col gap-2">
          {(requests ?? []).map((r) => (
            <div key={r.id} className="bg-surface-1 border border-border rounded-[10px] p-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-[13.5px] font-medium">{r.item_name}</div>
                <div className="text-[11.5px] text-ink-300">Qty: {r.quantity_requested}</div>
              </div>
              <span className="text-[10.5px] font-semibold px-2.5 py-1 rounded-full bg-warning-bg text-warning capitalize shrink-0">
                {r.status}
              </span>
            </div>
          ))}
          {(requests ?? []).length === 0 && (
            <div className="bg-surface-1 border border-border rounded-[10px] p-6 text-center text-[13px] text-ink-500">
              No purchase requests yet.
            </div>
          )}
        </div>
      )}
    </DashboardShell>
  );
}
