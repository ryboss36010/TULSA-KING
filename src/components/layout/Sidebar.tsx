"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SportIcon from "@/components/icons/SportIcon";

const SPORT_NAV = [
  { key: "americanfootball_nfl", label: "NFL" },
  { key: "basketball_nba", label: "NBA" },
  { key: "baseball_mlb", label: "MLB" },
  { key: "icehockey_nhl", label: "NHL" },
  { key: "soccer_epl", label: "Premier League" },
  { key: "soccer_uefa_champs_league", label: "Champions League" },
  { key: "mma_mixed_martial_arts", label: "UFC / MMA" },
  { key: "boxing_boxing", label: "Boxing" },
  { key: "americanfootball_ncaaf", label: "College Football" },
  { key: "basketball_ncaab", label: "College Basketball" },
  { key: "soccer_usa_mls", label: "MLS" },
  { key: "motorsport_formula_one_world_championship", label: "Formula 1" },
];

const FUTURES_NAV = [
  { key: "golf_masters_tournament_winner", label: "The Masters" },
  { key: "basketball_nba_championship_winner", label: "NBA Champion" },
  { key: "americanfootball_nfl_super_bowl_winner", label: "Super Bowl" },
  { key: "icehockey_nhl_championship_winner", label: "Stanley Cup" },
  { key: "baseball_mlb_world_series_winner", label: "World Series" },
  { key: "americanfootball_ncaaf_championship_winner", label: "CFP Champion" },
  { key: "golf_pga_championship_winner", label: "PGA Championship" },
];

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
    </svg>
  );
}

function TicketIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function WalletIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  );
}

const QUICK_LINKS = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/my-bets", label: "My Bets", Icon: TicketIcon },
  { href: "/dashboard", label: "Dashboard", Icon: ChartIcon },
  { href: "/ledger", label: "Ledger", Icon: WalletIcon },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex flex-col w-56 shrink-0 bg-[var(--bg-secondary)] border-r border-[var(--border)] h-[calc(100vh-56px)] sticky top-14 overflow-y-auto no-scrollbar">
      {/* Quick links */}
      <div className="p-3 space-y-0.5">
        {QUICK_LINKS.map((link) => {
          const isActive =
            link.href === "/"
              ? pathname === "/"
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                isActive
                  ? "bg-[var(--bg-button)] text-white"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-button)] hover:text-white"
              }`}
            >
              <link.Icon className="w-4 h-4" />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="border-t border-[var(--border)] mx-3" />

      {/* Sports */}
      <div className="p-3">
        <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2 px-3">
          Sports
        </p>
        <div className="space-y-0.5">
          {SPORT_NAV.map((sport) => {
            const isActive = pathname === `/sports/${sport.key}`;
            return (
              <Link
                key={sport.key}
                href={`/sports/${sport.key}`}
                className={`flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm transition ${
                  isActive
                    ? "bg-[var(--bg-button)] text-white font-medium"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-button)] hover:text-white"
                }`}
              >
                <SportIcon sport={sport.key} className="w-4 h-4" />
                <span>{sport.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="border-t border-[var(--border)] mx-3" />

      {/* Futures */}
      <div className="p-3">
        <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2 px-3">
          Futures
        </p>
        <div className="space-y-0.5">
          {FUTURES_NAV.map((sport) => {
            const isActive = pathname === `/sports/${sport.key}`;
            return (
              <Link
                key={sport.key}
                href={`/sports/${sport.key}`}
                className={`flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm transition ${
                  isActive
                    ? "bg-[var(--bg-button)] text-white font-medium"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-button)] hover:text-white"
                }`}
              >
                <SportIcon sport={sport.key} className="w-4 h-4" />
                <span>{sport.label}</span>
                <span className="ml-auto text-[10px] text-[var(--accent-green)] font-semibold">
                  F
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Browse all link */}
      <div className="p-3 mt-auto">
        <Link
          href="/sports"
          className="block text-center text-sm text-[var(--text-muted)] hover:text-[var(--accent-green)] transition py-2"
        >
          Browse All Sports
        </Link>
      </div>
    </aside>
  );
}
