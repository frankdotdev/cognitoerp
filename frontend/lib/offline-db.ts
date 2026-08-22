/**
 * Offline storage layer, implementing doc 010's design concretely:
 *   1. Marking attendance writes here FIRST, synchronously, before any
 *      network call — the UI shows "saved" immediately regardless of
 *      connectivity.
 *   2. A background sync process (see offline-sync.ts) drains this store
 *      to POST /attendance/sync whenever connectivity is available.
 *   3. Records are keyed by (studentId, date) client-side — matching the
 *      server's (school_id, student_id, date) unique constraint — so
 *      marking the same student twice before syncing overwrites the queued
 *      record instead of queuing a duplicate.
 *
 * Uses `idb` (a promise wrapper over the native IndexedDB API) rather than
 * raw IndexedDB — the native API predates promises and is painful to use
 * correctly by hand; `idb` is a thin wrapper with no behavior of its own.
 */
import { openDB, DBSchema, IDBPDatabase } from "idb";

interface QueuedAttendanceRecord {
  key: string; // `${student_id}:${date}` — primary key
  student_id: string;
  class_name: string;
  date: string; // "2026-08-06"
  status: "present" | "absent" | "late" | "excused";
  marked_at_device: string; // ISO timestamp — set when marked, not when synced
  // Stored as a string ("true"/"false"), not boolean — IndexedDB indexes on
  // booleans behave inconsistently across browser implementations, so the
  // index key is a string mirror of the real `synced` field below it.
  syncedFlag: "true" | "false";
  synced: boolean;
}

interface CachedRosterEntry {
  class_name: string; // primary key — one cached roster per class
  students: { id: string; full_name: string }[];
  cached_at: string; // ISO timestamp — surfaced in the UI so a teacher knows how stale a cold-start roster might be
}

interface CognitioOfflineDB extends DBSchema {
  attendance_queue: {
    key: string;
    value: QueuedAttendanceRecord;
    indexes: { "by-synced": string };
  };
  roster_cache: {
    key: string;
    value: CachedRosterEntry;
  };
}

let dbPromise: Promise<IDBPDatabase<CognitioOfflineDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<CognitioOfflineDB>("cognitio-erp-offline", 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const store = db.createObjectStore("attendance_queue", { keyPath: "key" });
          store.createIndex("by-synced", "syncedFlag");
        }
        if (oldVersion < 2) {
          db.createObjectStore("roster_cache", { keyPath: "class_name" });
        }
      },
    });
  }
  return dbPromise;
}

function recordKey(studentId: string, date: string): string {
  return `${studentId}:${date}`;
}

/**
 * Called the instant a teacher taps present/absent/late — before any
 * network request. This is the function that makes offline marking
 * actually work: the UI updating is not contingent on this succeeding
 * against a server, only against IndexedDB, which is local and fast enough
 * not to be a meaningful source of latency.
 */
export async function queueAttendanceRecord(
  record: Pick<QueuedAttendanceRecord, "student_id" | "class_name" | "date" | "status" | "marked_at_device">
): Promise<void> {
  const db = await getDB();
  await db.put("attendance_queue", {
    ...record,
    key: recordKey(record.student_id, record.date),
    synced: false,
    syncedFlag: "false",
  });
}

export async function getUnsyncedRecords(): Promise<QueuedAttendanceRecord[]> {
  const db = await getDB();
  const all = await db.getAll("attendance_queue");
  return all.filter((r) => !r.synced);
}

export async function markRecordsSynced(keys: string[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("attendance_queue", "readwrite");
  for (const key of keys) {
    const existing = await tx.store.get(key);
    if (existing) {
      await tx.store.put({ ...existing, synced: true, syncedFlag: "true" });
    }
  }
  await tx.done;
}

export async function getQueueSize(): Promise<number> {
  const unsynced = await getUnsyncedRecords();
  return unsynced.length;
}

/**
 * The piece that was actually missing (flagged explicitly in doc 020):
 * Mark Attendance previously fetched the roster live from GET /students on
 * every visit — fine online, but useless on a cold start while offline
 * (nothing to show if the very first network call fails). This persists
 * the roster to IndexedDB whenever it's successfully fetched, so a
 * subsequent offline visit has something real to render instead of an
 * empty state.
 */
export async function cacheRoster(className: string, students: { id: string; full_name: string }[]): Promise<void> {
  const db = await getDB();
  await db.put("roster_cache", { class_name: className, students, cached_at: new Date().toISOString() });
}

export async function getCachedRoster(className: string): Promise<CachedRosterEntry | undefined> {
  const db = await getDB();
  return db.get("roster_cache", className);
}
