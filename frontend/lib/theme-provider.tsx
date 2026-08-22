"use client";

/**
 * Reads the active school's theme (from the API — see docs/015) and applies
 * it as CSS custom properties on <html>, which every Tailwind `brand-*`
 * class references. This is THE mechanism behind "every school runs its own
 * branded instance" from the landing page: change a color in Settings,
 * every screen reflects it on next load, no rebuild or redeploy.
 *
 * Defaults to Cognitio's own green identity until a school's theme loads.
 */
import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export interface SchoolTheme {
  primaryColor: string;   // brand-600
  secondaryColor: string; // brand-700 equivalent / sidebar accent
  accentColor: string;    // brand-500
  logoUrl: string | null;
  darkModeEnabled: boolean;
}

const ASTER_DEFAULT_THEME: SchoolTheme = {
  primaryColor: "#0E7C4A",
  secondaryColor: "#0B6B40",
  accentColor: "#12A25C",
  logoUrl: null,
  darkModeEnabled: false,
};

const ThemeContext = createContext<SchoolTheme>(ASTER_DEFAULT_THEME);

export function useSchoolTheme() {
  return useContext(ThemeContext);
}

function hexToRgbTuple(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `${r} ${g} ${b}`;
}

// Derives a lighter tint (brand-50/100) from the school's primary color so
// schools only ever have to pick ONE brand color, not a whole palette.
function deriveTint(hex: string, mixWithWhitePercent: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  const mix = (channel: number) => Math.round(channel + (255 - channel) * mixWithWhitePercent);
  return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

export function ThemeProvider({ theme, children }: { theme: SchoolTheme | null; children: ReactNode }) {
  const active = theme ?? ASTER_DEFAULT_THEME;

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--brand-600", active.primaryColor);
    root.style.setProperty("--brand-700", active.secondaryColor);
    root.style.setProperty("--brand-500", active.accentColor);
    root.style.setProperty("--brand-100", deriveTint(active.primaryColor, 0.82));
    root.style.setProperty("--brand-50", deriveTint(active.primaryColor, 0.92));
    root.classList.toggle("dark", active.darkModeEnabled);
  }, [active]);

  return <ThemeContext.Provider value={active}>{children}</ThemeContext.Provider>;
}
