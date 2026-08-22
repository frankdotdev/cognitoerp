"use client";

/**
 * Resolves and provides the current school from the URL — the actual fix
 * for the launch-blocking gap: previously every screen that needed
 * school_id read a placeholder (window.__ASTER_SCHOOL_ID__) that nothing
 * ever set. This calls the real GET /schools/resolve endpoint (backed by
 * the subdomain-resolution middleware, core/subdomain.py) once per
 * session and makes the result available anywhere via useSchoolContext().
 */
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { apiClient } from "./api-client";

interface ResolvedSchool {
  id: string;
  name: string;
  school_code: string;
  subdomain: string;
  plan: string;
}

interface SchoolContextValue {
  school: ResolvedSchool | null;
  isLoading: boolean;
  notFound: boolean;
}

const SchoolContext = createContext<SchoolContextValue>({ school: null, isLoading: true, notFound: false });

export function useSchoolContext() {
  return useContext(SchoolContext);
}

export function SchoolContextProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SchoolContextValue>({ school: null, isLoading: true, notFound: false });

  useEffect(() => {
    apiClient
      .get<ResolvedSchool | null>("/schools/resolve")
      .then((school) => setState({ school, isLoading: false, notFound: school === null }))
      .catch(() => setState({ school: null, isLoading: false, notFound: true }));
  }, []);

  return <SchoolContext.Provider value={state}>{children}</SchoolContext.Provider>;
}
