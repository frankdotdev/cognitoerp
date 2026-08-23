"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { apiClient } from "@/lib/api-client";

const CATEGORIES = [
  { key: "attendance", label: "Attendance alerts", hint: "When your child is marked absent or late" },
  { key: "fees", label: "Fee reminders", hint: "Upcoming and overdue payments" },
  { key: "results", label: "Results", hint: "When report cards are published" },
  { key: "announcements", label: "School announcements", hint: "General school-wide notices" },
];

type Channel = "in_app" | "email" | "sms";

export default function NotificationPreferencesPage() {
  const [prefs, setPrefs] = useState<Record<string, { channel: Channel; enabled: boolean }>>(
    Object.fromEntries(CATEGORIES.map((c) => [c.key, { channel: "in_app" as Channel, enabled: true }]))
  );
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (payload: { category: string; channel: Channel; enabled: boolean }) =>
      apiClient.put("/notifications/preferences", payload),
  });

  function updatePref(category: string, changes: Partial<{ channel: Channel; enabled: boolean }>) {
    const current = prefs[category] ?? { channel: "in_app" as Channel, enabled: true };
    const next: { channel: Channel; enabled: boolean } = {
      channel: changes.channel ?? current.channel,
      enabled: changes.enabled ?? current.enabled,
    };
    setPrefs((prev) => ({ ...prev, [category]: next }));
    save.mutate({ category, ...next });
    setSavedKey(category);
    setTimeout(() => setSavedKey((k) => (k === category ? null : k)), 1500);
  }

  return (
    <DashboardShell userName="Mr. Okafor" permissions={new Set(["own_children.view"])}>
      <div className="mb-5">
        <h1 className="text-[22px] font-bold">Notification preferences</h1>
        <p className="text-[13px] text-ink-500 mt-0.5">Choose how you'd like to hear about each kind of update</p>
      </div>

      <div className="max-w-lg flex flex-col gap-3">
        {CATEGORIES.map((cat) => {
          const pref = prefs[cat.key] ?? { channel: "in_app" as Channel, enabled: true };
          return (
            <div key={cat.key} className="bg-surface-1 border border-border rounded-[10px] p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="text-[13.5px] font-medium">{cat.label}</div>
                  <div className="text-[11.5px] text-ink-300 mt-0.5">{cat.hint}</div>
                </div>
                <button
                  onClick={() => updatePref(cat.key, { enabled: !pref.enabled })}
                  className={`shrink-0 w-9 h-5 rounded-full relative transition-colors ${pref.enabled ? "bg-brand-600" : "bg-border"}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${pref.enabled ? "translate-x-4" : "translate-x-0.5"}`} />
                </button>
              </div>
              {pref.enabled && (
                <div className="flex gap-1.5">
                  {(["in_app", "email", "sms"] as Channel[]).map((ch) => (
                    <button
                      key={ch}
                      onClick={() => updatePref(cat.key, { channel: ch })}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                        pref.channel === ch ? "bg-brand-600 text-white border-brand-600" : "bg-surface-0 text-ink-500 border-border"
                      }`}
                    >
                      {ch === "in_app" ? "In-app" : ch.toUpperCase()}
                    </button>
                  ))}
                  {savedKey === cat.key && <span className="text-[11px] text-brand-700 self-center ml-1">Saved</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </DashboardShell>
  );
}
