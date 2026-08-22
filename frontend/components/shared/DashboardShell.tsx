"use client";

/**
 * DashboardShell — warm-paper design system version.
 *
 * Desktop (md+):  warm sidebar (--sidebar-bg #F7F2EA) with ink-900 text and
 *                 green active state — matching the landing page mockup exactly.
 *
 * Mobile (<md):  bottom tab bar (first 4 items) + "More" slide-over — same
 *                logic as before but now matches the paper design.
 */
import { ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid, Users, GraduationCap, CalendarCheck, Wallet,
  FileText, MessageSquare, Settings, Search, Bell, Menu, X,
  BookOpen, ClipboardCheck,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutGrid;
  requiredPermission?: string;
  comingSoon?: boolean;
}

const ALL_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard",     href: "/dashboard",     icon: LayoutGrid },
  { label: "Students",      href: "/students",      icon: Users,           requiredPermission: "students.view" },
  { label: "Teachers",      href: "/teachers",      icon: GraduationCap,   requiredPermission: "teachers.view" },
  { label: "Attendance",    href: "/attendance",    icon: CalendarCheck,   requiredPermission: "attendance.view" },
  { label: "Finance",       href: "/finance",       icon: Wallet,          requiredPermission: "fees.view" },
  { label: "Results",       href: "/results",       icon: FileText,        requiredPermission: "results.view" },
  { label: "Communication", href: "/communication", icon: MessageSquare },
  { label: "Learning",      href: "/learning",      icon: BookOpen,        comingSoon: true },
  { label: "Assessments",   href: "/assessments",   icon: ClipboardCheck,  comingSoon: true },
  { label: "Settings",      href: "/settings",      icon: Settings,        requiredPermission: "settings.edit" },
];

const MOBILE_TAB_COUNT = 4;

interface DashboardShellProps {
  children: ReactNode;
  userName: string;
  permissions: Set<string>;
}

export function DashboardShell({ children, userName, permissions }: DashboardShellProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const hasAccess = (item: NavItem) =>
    !item.requiredPermission || permissions.has("*") || permissions.has(item.requiredPermission);

  const visibleItems = ALL_NAV_ITEMS.filter(hasAccess);
  const tabItems  = visibleItems.slice(0, MOBILE_TAB_COUNT);
  const moreItems = visibleItems.slice(MOBILE_TAB_COUNT);

  const initials = userName.split(" ").map((n) => n[0]).slice(0, 2).join("");

  return (
    <div className="min-h-screen md:grid md:grid-cols-[220px_1fr]">

      {/* ── Desktop sidebar ─────────────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col bg-[var(--sidebar-bg)] border-r border-[var(--border)] px-4 py-5 fixed left-0 top-0 h-screen w-[220px]">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2 px-2 pb-6 font-heading font-bold text-[16px] text-[var(--ink-900)]">
          <span className="text-[var(--green)] text-[15px]">✦</span>cognitio
        </Link>

        {/* Nav sections */}
        <div className="mb-2">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-300)] px-2 mb-1.5">
            Main
          </div>
          <nav className="flex flex-col gap-0.5">
            {visibleItems.slice(0, 4).map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-full text-[13px] transition-colors ${
                    active
                      ? "bg-[var(--green-tint)] text-[var(--green-deep)] font-medium"
                      : "text-[var(--ink-700)] hover:bg-[var(--border-soft)]"
                  }`}
                >
                  <Icon size={14} className="shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-300)] px-2 mb-1.5 mt-3">
            Operate
          </div>
          <nav className="flex flex-col gap-0.5">
            {visibleItems.slice(4).map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-full text-[13px] transition-colors ${
                    active
                      ? "bg-[var(--green-tint)] text-[var(--green-deep)] font-medium"
                      : "text-[var(--ink-700)] hover:bg-[var(--border-soft)]"
                  }`}
                >
                  <Icon size={14} className="shrink-0" />
                  {item.label}
                  {item.comingSoon && (
                    <span className="ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded bg-[var(--border)] text-[var(--ink-300)]">
                      Soon
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User avatar bottom */}
        <div className="mt-auto pt-4 border-t border-[var(--border)] flex items-center gap-2.5 px-2">
          <div className="w-8 h-8 rounded-full bg-[var(--green-tint)] flex items-center justify-center text-[12px] font-heading font-bold text-[var(--green-deep)] shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="text-[12px] font-medium text-[var(--ink-900)] truncate">{userName}</div>
          </div>
        </div>
      </aside>

      {/* ── Right column ────────────────────────────────────────────────────── */}
      <div className="flex flex-col min-w-0 md:ml-[220px]">

        {/* Top bar */}
        <header className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-[var(--border)] bg-[var(--paper-raised)] sticky top-0 z-30">
          {/* Mobile logo */}
          <Link href="/dashboard" className="flex items-center gap-2 md:hidden font-heading font-bold text-[15px] shrink-0 text-[var(--ink-900)]">
            <span className="text-[var(--green)]">✦</span>cognitio
          </Link>

          {/* Search */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--paper)] text-[12.5px] text-[var(--ink-300)] w-full max-w-64">
            <Search size={14} className="shrink-0" />
            <span className="truncate">Search students, staff…</span>
          </div>
          <button className="sm:hidden p-2 -m-2 text-[var(--ink-500)]" aria-label="Search">
            <Search size={18} />
          </button>

          {/* Right controls */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <Bell size={17} className="text-[var(--ink-500)]" />
            <div className="w-8 h-8 rounded-full bg-[var(--green-tint)] flex items-center justify-center text-[12px] font-heading font-bold text-[var(--green-deep)] shrink-0">
              {initials}
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 p-4 sm:p-6 pb-20 md:pb-8 bg-[var(--paper)] min-w-0">
          {children}
        </main>
      </div>

      {/* ── Mobile bottom tab bar ────────────────────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-[var(--paper-raised)] border-t border-[var(--border)] flex items-stretch z-40"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {tabItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-1 py-2.5 text-[10.5px] transition-colors ${
                active ? "text-[var(--green-deep)] font-medium" : "text-[var(--ink-300)]"
              }`}
            >
              <Icon size={19} />
              <span className="truncate max-w-full px-1">{item.label}</span>
            </Link>
          );
        })}
        {moreItems.length > 0 && (
          <button
            onClick={() => setMoreOpen(true)}
            className="flex-1 min-w-0 flex flex-col items-center justify-center gap-1 py-2.5 text-[10.5px] text-[var(--ink-300)]"
          >
            <Menu size={19} />
            <span>More</span>
          </button>
        )}
      </nav>

      {/* Mobile full-screen slide-over */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-[var(--paper-raised)] flex flex-col">
          <div className="flex items-center justify-between px-4 py-4 border-b border-[var(--border)]">
            <span className="font-heading font-bold text-[16px]">Menu</span>
            <button onClick={() => setMoreOpen(false)} aria-label="Close menu" className="p-2 -m-2 text-[var(--ink-500)]">
              <X size={20} />
            </button>
          </div>
          <nav className="flex flex-col p-2">
            {moreItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl text-[14px] text-[var(--ink-900)] hover:bg-[var(--paper)]"
                >
                  <Icon size={18} className="text-[var(--ink-500)] shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </div>
  );
}
