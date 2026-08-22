"use client";

/**
 * Settings > Branding (doc 015). This is the screen where the product's
 * central promise — "every school runs its own branded instance" — becomes
 * something a principal actually does, not just a marketing claim. Saving
 * here updates the live theme immediately (theme_version bump), which
 * ThemeProvider picks up on next load — no rebuild, no waiting on Cognitio.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { AssetUploader } from "@/components/shared/AssetUploader";
import { apiClient } from "@/lib/api-client";

interface SchoolTheme {
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  logo_url: string | null;
  report_card_template: string;
  dark_mode_enabled: boolean;
}

interface SchoolProfile {
  name: string;
  school_code: string;
  motto: string | null;
  address: string | null;
  principal_name: string | null;
  plan: string;
}

const PRESET_COLORS = ["#0E7C4A", "#185FA5", "#993C1D", "#534AB7", "#B8791A", "#1E7A6E"];

export default function SettingsPage() {
  const [tab, setTab] = useState<"profile" | "branding">("profile");
  const queryClient = useQueryClient();

  const { data: school } = useQuery({
    queryKey: ["my-school"],
    queryFn: () => apiClient.get<SchoolProfile>("/schools/me"),
  });

  const { data: theme } = useQuery({
    queryKey: ["my-theme"],
    queryFn: () => apiClient.get<SchoolTheme>("/schools/me/theme"),
  });

  const [draftColor, setDraftColor] = useState<string | null>(null);

  const updateTheme = useMutation({
    mutationFn: (changes: Partial<SchoolTheme>) => apiClient.patch("/schools/me/theme", changes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-theme"] }),
  });

  const activeColor = draftColor ?? theme?.primary_color ?? "#0E7C4A";

  return (
    <DashboardShell userName="Mrs. Adeyemi" permissions={new Set(["settings.edit"])}>
      <div className="mb-5">
        <h1 className="text-[22px] font-bold">Settings</h1>
        <p className="text-[13px] text-ink-500 mt-0.5">Your school's identity, applied everywhere automatically</p>
      </div>

      <div className="flex gap-1 mb-6 border-b border-border overflow-x-auto">
        {(["profile", "branding"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 px-4 py-2.5 text-[13.5px] font-medium border-b-2 -mb-px transition-colors ${
              tab === t ? "border-brand-600 text-brand-700" : "border-transparent text-ink-500"
            }`}
          >
            {t === "profile" ? "School Profile" : "Branding"}
          </button>
        ))}
      </div>

      {tab === "profile" && school && (
        <div className="max-w-lg bg-surface-1 border border-border rounded-[10px] p-5 flex flex-col gap-4">
          <div>
            <label className="block text-[12.5px] font-medium text-ink-700 mb-1.5">School name</label>
            <input
              defaultValue={school.name}
              className="w-full px-3.5 py-2.5 rounded-md border border-border text-[13.5px] outline-none focus:border-brand-500"
            />
          </div>
          <div>
            <label className="block text-[12.5px] font-medium text-ink-700 mb-1.5">Motto</label>
            <input
              defaultValue={school.motto ?? ""}
              placeholder="e.g. Knowledge, Character, Service"
              className="w-full px-3.5 py-2.5 rounded-md border border-border text-[13.5px] outline-none focus:border-brand-500"
            />
          </div>
          <div>
            <label className="block text-[12.5px] font-medium text-ink-700 mb-1.5">Address</label>
            <input
              defaultValue={school.address ?? ""}
              className="w-full px-3.5 py-2.5 rounded-md border border-border text-[13.5px] outline-none focus:border-brand-500"
            />
          </div>
          <div>
            <label className="block text-[12.5px] font-medium text-ink-700 mb-1.5">Principal</label>
            <input
              defaultValue={school.principal_name ?? ""}
              className="w-full px-3.5 py-2.5 rounded-md border border-border text-[13.5px] outline-none focus:border-brand-500"
            />
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border-soft text-[12.5px] text-ink-500">
            <span>School code</span>
            <span className="font-mono">{school.school_code}</span>
          </div>
          <button className="self-start bg-brand-600 hover:bg-brand-700 text-white text-[13.5px] font-medium px-4 py-2.5 rounded-md transition-colors">
            Save changes
          </button>
        </div>
      )}

      {tab === "branding" && theme && (
        <div className="max-w-lg flex flex-col gap-6">
          <div className="bg-surface-1 border border-border rounded-[10px] p-5">
            <div className="text-[12.5px] font-medium text-ink-700 mb-3">School color</div>
            <div className="flex gap-2.5 flex-wrap mb-3">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setDraftColor(c)}
                  style={{ background: c }}
                  className={`w-9 h-9 rounded-md border-2 transition-transform ${
                    activeColor === c ? "border-ink-900 scale-105" : "border-transparent"
                  }`}
                  aria-label={c}
                />
              ))}
            </div>
            <p className="text-[11.5px] text-ink-300 mb-3">
              This becomes your school's accent color everywhere — dashboards, report cards, emails, the parent portal.
            </p>
            <button
              onClick={() => draftColor && updateTheme.mutate({ primary_color: draftColor })}
              disabled={!draftColor || updateTheme.isPending}
              className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-[13px] font-medium px-4 py-2 rounded-md transition-colors"
            >
              {updateTheme.isPending ? "Saving…" : "Apply color"}
            </button>
          </div>

          <div className="bg-surface-1 border border-border rounded-[10px] p-5 flex flex-col gap-5">
            <AssetUploader
              category="logos"
              label="School logo"
              currentPreviewUrl={theme.logo_url}
              onUploaded={() => queryClient.invalidateQueries({ queryKey: ["my-theme"] })}
            />
            <AssetUploader
              category="stamps"
              label="School stamp"
              onUploaded={() => queryClient.invalidateQueries({ queryKey: ["my-theme"] })}
            />
            <AssetUploader
              category="signatures"
              label="Principal's signature"
              onUploaded={() => queryClient.invalidateQueries({ queryKey: ["my-theme"] })}
            />
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
