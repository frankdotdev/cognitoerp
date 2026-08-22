"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect, ReactNode } from "react";
import { ThemeProvider, SchoolTheme } from "@/lib/theme-provider";
import { SchoolContextProvider } from "@/lib/school-context";
import { startOfflineSync } from "@/lib/offline-sync";

export function Providers({ children, schoolTheme }: { children: ReactNode; schoolTheme: SchoolTheme | null }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
  }));

  useEffect(() => startOfflineSync(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <SchoolContextProvider>
        <ThemeProvider theme={schoolTheme}>{children}</ThemeProvider>
      </SchoolContextProvider>
    </QueryClientProvider>
  );
}
