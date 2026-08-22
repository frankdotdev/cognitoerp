"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { apiClient } from "@/lib/api-client";

interface SchoolClass {
  id: string;
  name: string;
  sections: string[];
  display_order: number;
}

export default function ClassesPage() {
  const queryClient = useQueryClient();
  const [newClassName, setNewClassName] = useState("");
  const [newSections, setNewSections] = useState("");

  const { data: classes, isLoading } = useQuery({
    queryKey: ["school-classes"],
    queryFn: () => apiClient.get<SchoolClass[]>("/schools/me/classes"),
  });

  const createClass = useMutation({
    mutationFn: () =>
      apiClient.post("/schools/me/classes", {
        name: newClassName,
        sections: newSections.split(",").map((s) => s.trim()).filter(Boolean),
        display_order: (classes?.length ?? 0) + 1,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["school-classes"] });
      setNewClassName("");
      setNewSections("");
    },
  });

  const deleteClass = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/schools/me/classes/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["school-classes"] }),
  });

  return (
    <DashboardShell userName="Mrs. Adeyemi" permissions={new Set(["settings.edit"])}>
      <div className="mb-5">
        <h1 className="text-[22px] font-bold">Classes & sections</h1>
        <p className="text-[13px] text-ink-500 mt-0.5">Define your school's classes — these appear everywhere a class needs to be picked</p>
      </div>

      <div className="max-w-lg bg-surface-1 border border-border rounded-[10px] p-5 mb-5">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
            placeholder="Class name — e.g. SS2"
            className="flex-1 px-3.5 py-2.5 rounded-md border border-border text-[13px] outline-none focus:border-brand-500"
          />
          <input
            value={newSections}
            onChange={(e) => setNewSections(e.target.value)}
            placeholder="Sections — e.g. Gold, Silver"
            className="flex-1 px-3.5 py-2.5 rounded-md border border-border text-[13px] outline-none focus:border-brand-500"
          />
        </div>
        <button
          onClick={() => newClassName.trim() && createClass.mutate()}
          disabled={createClass.isPending || !newClassName.trim()}
          className="flex items-center gap-1.5 text-[12.5px] font-medium text-brand-700 hover:underline mt-3 disabled:opacity-50"
        >
          <Plus size={13} /> Add class
        </button>
      </div>

      {isLoading ? (
        <p className="text-[13px] text-ink-300">Loading…</p>
      ) : (classes ?? []).length === 0 ? (
        <div className="bg-surface-1 border border-border rounded-[10px] p-6 text-center text-[13px] text-ink-500">
          No classes set up yet — add your first one above (e.g. JSS1, JSS2, SS1…).
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {(classes ?? []).map((c) => (
            <div key={c.id} className="bg-surface-1 border border-border rounded-[10px] p-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-[14px] font-medium">{c.name}</div>
                {c.sections.length > 0 && (
                  <div className="flex gap-1.5 mt-1.5 flex-wrap">
                    {c.sections.map((s) => (
                      <span key={s} className="text-[10.5px] bg-surface-0 border border-border-soft px-2 py-0.5 rounded-full text-ink-500">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => deleteClass.mutate(c.id)} className="p-2 text-ink-300 hover:text-danger shrink-0">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
