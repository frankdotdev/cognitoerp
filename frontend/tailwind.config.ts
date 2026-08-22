import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        /* ── Paper palette ─────────────────────────────────────────── */
        paper: {
          DEFAULT: "var(--paper)",
          raised:  "var(--paper-raised)",
        },
        sidebar: "var(--sidebar-bg)",

        /* ── Ink scale ─────────────────────────────────────────────── */
        ink: {
          900: "var(--ink-900)",
          700: "var(--ink-700)",
          500: "var(--ink-500)",
          300: "var(--ink-300)",
           50: "#FAF6F0",
        },

        /* ── Border ────────────────────────────────────────────────── */
        border: {
          DEFAULT: "var(--border)",
          soft:    "var(--border-soft)",
        },

        /* ── Green ─────────────────────────────────────────────────── */
        green: {
          DEFAULT: "var(--green)",
          deep:    "var(--green-deep)",
          tint:    "var(--green-tint)",
        },

        /* ── Accent swatches ───────────────────────────────────────── */
        tan:     { 100: "var(--tan-100)" },
        mint:    { 100: "var(--mint-100)" },
        credits: "var(--credits-bg)",

        /* ── Brand aliases (used throughout dashboard) ──────────────── */
        brand: {
          50:  "var(--green-tint)",
          100: "var(--mint-100)",
          500: "var(--green)",
          600: "var(--green-deep)",
          700: "#0B5B33",
        },

        /* ── Surface aliases (dashboard bg levels) ──────────────────── */
        "surface-0": "var(--paper)",
        "surface-1": "var(--paper-raised)",
        "surface-2": "var(--sidebar-bg)",

        /* ── Status ─────────────────────────────────────────────────── */
        "warning-bg": "var(--warning-bg)",
        warning:      "var(--warning)",
        "danger-bg":  "var(--danger-bg)",
        danger:       "var(--danger)",
      },

      fontFamily: {
        sans:    ["Inter", "sans-serif"],
        body:    ["Inter", "sans-serif"],
        serif:   ["Lora", "Georgia", "serif"],
        heading: ["Lora", "Georgia", "serif"],
        mono:    ["IBM Plex Mono", "monospace"],
      },

      maxWidth: {
        site: "1180px",
      },
    },
  },
  plugins: [],
};

export default config;
