"use client";

/**
 * Grading scheme setup (doc 011). Defines the component weights (CA1/CA2/
 * Exam and their max scores) and grade boundaries a school uses — this is
 * what results/service.py validates every score entry against, so a
 * school MUST configure this before any teacher can enter a score
 * (the backend already returns a clear 422 if they haven't).
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { FormSkeleton } from "@/components/shared/Skeleton";
import { apiClient } from "@/lib/api-client";

interface GradingScheme {
  id: string;
  name: string;
  component_weights: Record<string, number>;
  grade_boundaries: { grade: string; min: number; max: number }[];
  is_active: boolean;
}

const DEFAULT_COMPONENTS: [string, number][] = [["CA1", 20], ["CA2", 20], ["Exam", 60]];
const DEFAULT_BOUNDARIES = [
  { grade: "A", min: 70, max: 100 },
  { grade: "B", min: 60, max: 69 },
  { grade: "C", min: 50, max: 59 },
  { grade: "D", min: 40, max: 49 },
  { grade: "F", min: 0, max: 39 },
];

export default function GradingSchemePage() {
  const queryClient = useQueryClient();
  const { data: scheme, isLoading } = useQuery({
    queryKey: ["grading-scheme"],
    queryFn: () => apiClient.get<GradingScheme | null>("/results/grading-scheme"),
  });

  const [components, setComponents] = useState<[string, number][]>(DEFAULT_COMPONENTS);
  const [boundaries, setBoundaries] = useState(DEFAULT_BOUNDARIES);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => {
      const weightsObj = Object.fromEntries(components);
      return apiClient.post("/results/grading-scheme", {
        name: "Default",
        component_weights: weightsObj,
        grade_boundaries: boundaries,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["grading-scheme"] }),
    onError: () => setError("Couldn't save the grading scheme."),
  });

  const totalWeight = components.reduce((sum, [, max]) => sum + max, 0);

  function handleSave() {
    setError(null);
    if (totalWeight !== 100) return setError(`Components must add up to 100 — currently ${totalWeight}.`);
    save.mutate();
  }

  if (isLoading) {
    return (
      <DashboardShell userName="Mrs. Adeyemi" permissions={new Set(["settings.edit"])}>
        <FormSkeleton />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell userName="Mrs. Adeyemi" permissions={new Set(["settings.edit"])}>
      <div className="mb-5">
        <h1 className="text-[22px] font-bold">Grading scheme</h1>
        <p className="text-[13px] text-ink-500 mt-0.5">
          {scheme ? "Currently active — changing this starts a new scheme for future terms" : "Not configured yet — set this up before teachers can enter scores"}
        </p>
      </div>

      <div className="max-w-lg bg-surface-1 border border-border rounded-[10px] p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[12.5px] font-medium text-ink-700">Score components</p>
          <span className={`text-[11.5px] font-medium ${totalWeight === 100 ? "text-brand-700" : "text-danger"}`}>
            Total: {totalWeight}/100
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {components.map(([name, max], i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={name}
                onChange={(e) => setComponents(components.map((c, idx) => (idx === i ? [e.target.value, c[1]] : c)))}
                className="flex-1 px-3 py-2 rounded-md border border-border text-[13px] outline-none focus:border-brand-500"
              />
              <input
                type="number"
                value={max}
                onChange={(e) => setComponents(components.map((c, idx) => (idx === i ? [c[0], Number(e.target.value)] : c)))}
                className="w-20 px-3 py-2 rounded-md border border-border text-[13px] outline-none focus:border-brand-500"
              />
              <button onClick={() => setComponents(components.filter((_, idx) => idx !== i))} className="p-2 text-ink-300 hover:text-danger">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={() => setComponents([...components, ["New", 0]])}
          className="flex items-center gap-1.5 text-[12px] font-medium text-brand-700 hover:underline mt-3"
        >
          <Plus size={13} /> Add component
        </button>
      </div>

      <div className="max-w-lg bg-surface-1 border border-border rounded-[10px] p-5 mb-5">
        <p className="text-[12.5px] font-medium text-ink-700 mb-3">Grade boundaries</p>
        <div className="flex flex-col gap-2">
          {boundaries.map((b, i) => (
            <div key={i} className="flex items-center gap-2 text-[13px]">
              <input
                value={b.grade}
                onChange={(e) => setBoundaries(boundaries.map((row, idx) => (idx === i ? { ...row, grade: e.target.value } : row)))}
                className="w-14 px-2 py-1.5 rounded-md border border-border text-center outline-none focus:border-brand-500"
              />
              <span className="text-ink-300">from</span>
              <input
                type="number"
                value={b.min}
                onChange={(e) => setBoundaries(boundaries.map((row, idx) => (idx === i ? { ...row, min: Number(e.target.value) } : row)))}
                className="w-16 px-2 py-1.5 rounded-md border border-border outline-none focus:border-brand-500"
              />
              <span className="text-ink-300">to</span>
              <input
                type="number"
                value={b.max}
                onChange={(e) => setBoundaries(boundaries.map((row, idx) => (idx === i ? { ...row, max: Number(e.target.value) } : row)))}
                className="w-16 px-2 py-1.5 rounded-md border border-border outline-none focus:border-brand-500"
              />
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-[12.5px] text-danger mb-3">{error}</p>}

      <button onClick={handleSave} disabled={save.isPending} className="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-[13.5px] font-medium px-5 py-2.5 rounded-md transition-colors">
        {save.isPending ? "Saving…" : "Save grading scheme"}
      </button>
    </DashboardShell>
  );
}
