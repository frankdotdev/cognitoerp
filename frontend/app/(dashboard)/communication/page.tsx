"use client";

/**
 * Communication screen (doc 012). Two tabs, not an open chat: Announcements
 * (read-only for most roles) and Help Desk (ticketed, tracked to
 * resolution). Deliberately no free-form group-message UI at all.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { apiClient } from "@/lib/api-client";

interface Announcement {
  id: string;
  title: string;
  body: string;
  created_at: string;
}

interface Ticket {
  id: string;
  subject: string;
  category: string;
  status: string;
  created_at: string;
}

function TicketStatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: "bg-warning-bg text-warning",
    in_progress: "bg-brand-50 text-brand-700",
    resolved: "bg-surface-0 text-ink-500",
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${styles[status] ?? styles.open}`}>
      {status.replace("_", " ")}
    </span>
  );
}

export default function CommunicationPage() {
  const [tab, setTab] = useState<"announcements" | "tickets">("announcements");

  const { data: announcements, isLoading: loadingAnnouncements } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => apiClient.get<Announcement[]>("/communication/announcements"),
    enabled: tab === "announcements",
  });

  const { data: tickets, isLoading: loadingTickets } = useQuery({
    queryKey: ["tickets"],
    queryFn: () => apiClient.get<Ticket[]>("/communication/tickets"),
    enabled: tab === "tickets",
  });

  return (
    <DashboardShell userName="Mrs. Adeyemi" permissions={new Set(["*"])}>
      <div className="mb-5">
        <h1 className="text-[22px] font-bold">Communication</h1>
        <p className="text-[13px] text-ink-500 mt-0.5">Announcements and support requests</p>
      </div>

      <div className="flex gap-1 mb-5 border-b border-border">
        {(["announcements", "tickets"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-[13.5px] font-medium border-b-2 -mb-px transition-colors ${
              tab === t ? "border-brand-600 text-brand-700" : "border-transparent text-ink-500"
            }`}
          >
            {t === "announcements" ? "Announcements" : "Help Desk"}
          </button>
        ))}
      </div>

      {tab === "announcements" && (
        <div className="flex flex-col gap-3">
          {loadingAnnouncements && <p className="text-[13px] text-ink-300">Loading…</p>}
          {!loadingAnnouncements && (announcements ?? []).length === 0 && (
            <div className="bg-surface-1 border border-border rounded-[10px] p-6 text-center text-[13px] text-ink-500">
              No announcements yet.
            </div>
          )}
          {(announcements ?? []).map((a) => (
            <div key={a.id} className="bg-surface-1 border border-border rounded-[10px] p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="font-heading font-bold text-[14.5px]">{a.title}</h3>
                <span className="text-[11px] text-ink-300 shrink-0">
                  {new Date(a.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="text-[13px] text-ink-500 leading-relaxed">{a.body}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "tickets" && (
        <div className="flex flex-col gap-2">
          {loadingTickets && <p className="text-[13px] text-ink-300">Loading…</p>}
          {!loadingTickets && (tickets ?? []).length === 0 && (
            <div className="bg-surface-1 border border-border rounded-[10px] p-6 text-center text-[13px] text-ink-500">
              No tickets yet.
            </div>
          )}
          {(tickets ?? []).map((t) => (
            <div key={t.id} className="bg-surface-1 border border-border rounded-[10px] p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[13.5px] font-medium truncate">{t.subject}</div>
                <div className="text-[11.5px] text-ink-300 capitalize">{t.category}</div>
              </div>
              <TicketStatusPill status={t.status} />
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
