"use client";

/**
 * The screen doc 010 is actually about — marking a class's attendance,
 * offline-capable. Distinct from /attendance (the read-only calendar) —
 * this is the write path a teacher uses every morning.
 *
 * Roster now comes from the real GET /students endpoint (was a hardcoded
 * demo list) — React Query caches it client-side with a long staleTime,
 * which covers "already loaded this session" offline use. True
 * ahead-of-time offline roster caching (persisting the roster into
 * IndexedDB itself, per doc 010's "cached the moment the teacher logs in"
 * design) is a further step beyond this — this fix addresses the
 * placeholder-data gap, not yet the full prefetch-on-login behavior.
 *
 * Every tap writes to IndexedDB immediately (queueAttendanceRecord) and
 * the UI updates from LOCAL state, not from a server response — this is
 * the concrete difference between "offline-first" and "offline-tolerant."
 * A sync-status pill shows the queue size so a teacher can SEE that
 * pending records exist and will send once connectivity returns, rather
 * than wondering if their taps actually saved.
 */
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { WifiOff, Check, RefreshCw } from "lucide-react";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { TableSkeleton } from "@/components/shared/Skeleton";
import { queueAttendanceRecord, getQueueSize, cacheRoster, getCachedRoster } from "@/lib/offline-db";
import { attemptSync } from "@/lib/offline-sync";
import { apiClient } from "@/lib/api-client";

interface Student {
  id: string;
  full_name: string;
  class_name: string;
}
interface PaginatedStudents {
  items: Student[];
}

type Status = "present" | "absent" | "late" | "excused";

const STATUS_CONFIG: Record<Status, { label: string; className: string }> = {
  present: { label: "Present", className: "bg-brand-600 text-white border-brand-600" },
  absent: { label: "Absent", className: "bg-danger text-white border-danger" },
  late: { label: "Late", className: "bg-warning text-white border-warning" },
  excused: { label: "Excused", className: "bg-ink-300 text-white border-ink-300" },
};

export default function MarkAttendancePage() {
  const [classFilter, setClassFilter] = useState("SS2");
  const [marks, setMarks] = useState<Record<string, Status>>({});
  const [queueSize, setQueueSize] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const [cachedRoster, setCachedRoster] = useState<{ id: string; full_name: string }[] | null>(null);
  const [rosterCachedAt, setRosterCachedAt] = useState<string | null>(null);

  const { data: roster, isLoading: rosterLoading, isError: rosterError } = useQuery({
    queryKey: ["roster", classFilter],
    queryFn: async () => {
      const result = await apiClient.get<PaginatedStudents>("/students", { params: { class_name: classFilter, page_size: 100 } });
      // Persist to IndexedDB on every successful fetch — this is what
      // makes a COLD offline start (app opened with no connection at all,
      // not just connection lost mid-session) still show a real roster
      // instead of nothing, per doc 010's original "cached the moment the
      // teacher logs in" design.
      await cacheRoster(classFilter, result.items.map((s) => ({ id: s.id, full_name: s.full_name })));
      return result;
    },
    // Long staleTime: once a teacher has loaded today's roster, it should
    // keep working from cache for the rest of the offline session rather
    // than trying (and failing) to refetch every few seconds while offline.
    staleTime: 12 * 60 * 60 * 1000,
    retry: false, // fail fast to the IndexedDB fallback below rather than retrying a dead network repeatedly
  });

  // Cold-start fallback: the live fetch above failed (e.g. app opened
  // offline before ever syncing) — fall back to whatever roster was
  // cached from the last successful online visit, if any.
  useEffect(() => {
    if (rosterError) {
      getCachedRoster(classFilter).then((cached) => {
        if (cached) {
          setCachedRoster(cached.students);
          setRosterCachedAt(cached.cached_at);
        }
      });
    } else {
      setCachedRoster(null);
    }
  }, [rosterError, classFilter]);

  const effectiveRoster = roster?.items ?? cachedRoster ?? [];

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    refreshQueueSize();
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  async function refreshQueueSize() {
    setQueueSize(await getQueueSize());
  }

  async function mark(studentId: string, status: Status) {
    setMarks((prev) => ({ ...prev, [studentId]: status })); // instant UI update — never waits on the network
    await queueAttendanceRecord({
      student_id: studentId,
      class_name: classFilter,
      date: today,
      status,
      marked_at_device: new Date().toISOString(),
    });
    await refreshQueueSize();
  }

  async function handleSyncNow() {
    setSyncing(true);
    await attemptSync();
    await refreshQueueSize();
    setSyncing(false);
  }

  return (
    <DashboardShell userName="Mr. Bassey" permissions={new Set(["attendance.mark"])}>
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-[22px] font-bold">Mark attendance</h1>
          <p className="text-[13px] text-ink-500 mt-0.5">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
        </div>
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="px-3 py-2 rounded-md border border-border bg-surface-1 text-[13px] outline-none focus:border-brand-500 shrink-0"
        >
          {["JSS1", "JSS2", "SS1", "SS2", "SS3"].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Sync status — always visible, never hidden, so a teacher on a bad
          connection sees exactly what's pending rather than wondering. */}
      <div className={`flex items-center justify-between gap-3 rounded-[10px] border px-4 py-3 mb-5 ${
        !isOnline ? "bg-warning-bg border-warning/30" : queueSize > 0 ? "bg-surface-0 border-border" : "bg-brand-50 border-brand-100"
      }`}>
        <div className="flex items-center gap-2 text-[12.5px]">
          {!isOnline ? (
            <>
              <WifiOff size={15} className="text-warning shrink-0" />
              <span className="text-warning font-medium">Offline — saving on this device</span>
            </>
          ) : queueSize > 0 ? (
            <>
              <RefreshCw size={15} className={`text-ink-500 shrink-0 ${syncing ? "animate-spin" : ""}`} />
              <span className="text-ink-700">{queueSize} record{queueSize !== 1 ? "s" : ""} waiting to sync</span>
            </>
          ) : (
            <>
              <Check size={15} className="text-brand-700 shrink-0" />
              <span className="text-brand-700 font-medium">All synced</span>
            </>
          )}
        </div>
        {isOnline && queueSize > 0 && (
          <button onClick={handleSyncNow} disabled={syncing} className="text-[12px] font-medium text-brand-700 hover:underline shrink-0 disabled:opacity-50">
            Sync now
          </button>
        )}
      </div>

      {cachedRoster && !roster && (
        <div className="bg-surface-0 border border-border rounded-[10px] px-4 py-2.5 mb-3 text-[12px] text-ink-500">
          Showing a saved roster from {rosterCachedAt ? new Date(rosterCachedAt).toLocaleString() : "an earlier visit"} — reconnect to refresh.
        </div>
      )}

      {rosterLoading ? (
        <TableSkeleton rows={5} />
      ) : effectiveRoster.length === 0 ? (
        <div className="bg-surface-1 border border-border rounded-[10px] p-6 text-center text-[13px] text-ink-500">
          {rosterError ? "No saved roster for this class yet — connect once to load it." : `No students in ${classFilter} yet.`}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {effectiveRoster.map((student) => (
            <div key={student.id} className="bg-surface-1 border border-border rounded-[10px] p-3.5 flex items-center justify-between gap-3">
              <span className="text-[13.5px] font-medium min-w-0 truncate">{student.full_name}</span>
              <div className="flex gap-1.5 shrink-0">
                {(Object.keys(STATUS_CONFIG) as Status[]).map((status) => {
                  const active = marks[student.id] === status;
                  return (
                    <button
                      key={status}
                      onClick={() => mark(student.id, status)}
                      className={`w-9 h-9 sm:w-auto sm:px-3 rounded-md border text-[11px] font-semibold transition-colors flex items-center justify-center ${
                        active ? STATUS_CONFIG[status].className : "bg-surface-0 border-border text-ink-300"
                      }`}
                      aria-label={STATUS_CONFIG[status].label}
                    >
                      <span className="sm:hidden">{status.charAt(0).toUpperCase()}</span>
                      <span className="hidden sm:inline">{STATUS_CONFIG[status].label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
