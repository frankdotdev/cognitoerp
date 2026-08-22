import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Cognitio ERP — The Intelligence Infrastructure for Education",
  description:
    "Cognitio ERP brings admissions, academics, finance, attendance, communication, and analytics together in one secure, cloud-based operating system — built for schools across Africa.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.png" type="image/png" />
        <meta name="theme-color" content="#128A52" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,500;0,600;0,700;1,400;1,500&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans bg-[#FAF6F0] text-[#1B1611] antialiased selection:bg-[#128A52] selection:text-white">
        <Providers schoolTheme={null}>{children}</Providers>
      </body>
    </html>
  );
}
