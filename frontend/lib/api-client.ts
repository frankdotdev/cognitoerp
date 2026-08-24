/**
 * Thin fetch wrapper — every screen goes through this rather than calling
 * fetch() directly, so auth headers, base URL, and error handling live in
 * one place. Token storage/refresh logic (reading the access token, and
 * transparently retrying once on a 401 after refreshing) is the next thing
 * to fill in here — stubbed for now with a TODO rather than faked, since a
 * fake "it works" would hide the real auth wiring still needed.
 */
declare const process: { env: Record<string, string | undefined> };

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

interface RequestOptions {
  params?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

function buildUrl(path: string, params?: RequestOptions["params"]): string {
  const url = new URL(API_BASE_URL + path);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) url.searchParams.set(key, String(value));
    });
  }
  return url.toString();
}

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  // TODO: read access token from auth store, attach as Authorization: Bearer <token>.
  const res = await fetch(buildUrl(path, options.params), {
    method,
    headers: { "Content-Type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new Error(errorBody?.error?.message ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) => request<T>("GET", path, options),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, { body }),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, { body }),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, { body }),
  delete: <T>(path: string) => request<T>("DELETE", path),
};
