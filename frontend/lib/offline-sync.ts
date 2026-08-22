/**
 * Drives the "connection returns -> automatic background sync" step of
 * doc 010's flow. Two triggers, deliberately not just one:
 *   - the browser's `online` event (fires when connectivity genuinely
 *     returns — the primary trigger)
 *   - a periodic interval (every 30s while the tab is open) as a fallback,
 *     since `online`/`offline` events are known to be unreliable on some
 *     mobile browsers (a device can regain a weak signal without the
 *     event firing cleanly)
 *
 * Each sync attempt sends the WHOLE unsynced queue in one batch to
 * POST /attendance/sync, which is itself idempotent (attendance/service.py's
 * upsert) — so a sync that's interrupted partway and retried never
 * double-applies anything, it just re-sends records that may already have
 * landed, which the server-side upsert handles as a no-op update.
 */
import { getUnsyncedRecords, markRecordsSynced } from "./offline-db";
import { apiClient } from "./api-client";

const SYNC_INTERVAL_MS = 30_000;

let syncInFlight = false;

export async function attemptSync(): Promise<{ synced: number } | null> {
  if (syncInFlight || !navigator.onLine) return null;

  const unsynced = await getUnsyncedRecords();
  if (unsynced.length === 0) return { synced: 0 };

  syncInFlight = true;
  try {
    const records = unsynced.map((r) => ({
      student_id: r.student_id,
      class_name: r.class_name,
      date: r.date,
      status: r.status,
      marked_at_device: r.marked_at_device,
    }));

    const result = await apiClient.post<{ synced: number }>("/attendance/sync", { records });

    // Only mark synced AFTER the server confirms the batch — if the
    // request fails partway (network drop mid-upload), nothing here gets
    // marked synced, so the next attempt naturally resends everything.
    await markRecordsSynced(unsynced.map((r) => r.key));

    return result;
  } catch {
    return null; // stays queued; the next trigger (interval or online event) retries
  } finally {
    syncInFlight = false;
  }
}

/** Call once, e.g. from a top-level layout effect — wires both sync triggers for the session. */
export function startOfflineSync(): () => void {
  const onOnline = () => void attemptSync();
  window.addEventListener("online", onOnline);

  const interval = setInterval(() => void attemptSync(), SYNC_INTERVAL_MS);

  // Attempt once immediately on start, in case records were queued in a
  // previous session and connectivity is already available now.
  void attemptSync();

  return () => {
    window.removeEventListener("online", onOnline);
    clearInterval(interval);
  };
}
