/**
 * A parent with children at more than one Cognitio school (doc 008's known
 * simplification: each school is a separate tenant with its own login —
 * see that doc's "Status" section). Full single-login cross-school
 * aggregation would require a deliberate, carefully-scoped exception to
 * tenant isolation (e.g. a verified-phone-number guardian directory
 * living outside any one school's data) — a real architectural decision
 * that deserves its own design pass, not something bolted on here.
 *
 * What this DOES provide honestly: a local "My Schools" bookmark list, so
 * a parent can save each school they have a login at and switch between
 * them quickly — genuinely useful, not a simulation of something bigger.
 * Stored per-browser (localStorage), since each school subdomain is a
 * separate origin and can't share this list with the others automatically.
 */
const STORAGE_KEY = "cognitio-my-schools";

export interface SavedSchool {
  subdomain: string;
  schoolName: string;
  savedAt: string;
}

export function getSavedSchools(): SavedSchool[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveSchool(subdomain: string, schoolName: string): void {
  const existing = getSavedSchools().filter((s) => s.subdomain !== subdomain);
  const updated = [...existing, { subdomain, schoolName, savedAt: new Date().toISOString() }];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function removeSchool(subdomain: string): void {
  const updated = getSavedSchools().filter((s) => s.subdomain !== subdomain);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}
