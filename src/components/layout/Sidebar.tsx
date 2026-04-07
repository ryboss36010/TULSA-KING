"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import SportIcon from "@/components/icons/SportIcon";
import {
  HomeIcon,
  TicketIcon,
  ChartIcon,
  WalletIcon,
} from "@/components/icons/NavIcons";
import { createClient } from "@/lib/supabase/client";
import { getSportLabel, isOutrightSport } from "@/lib/types";
import EventSearch from "@/components/search/EventSearch";

// All sports in order of priority
const ALL_SPORTS = [
  { key: "americanfootball_nfl", label: "NFL" },
  { key: "basketball_nba", label: "NBA" },
  { key: "baseball_mlb", label: "MLB" },
  { key: "icehockey_nhl", label: "NHL" },
  { key: "americanfootball_ncaaf", label: "College Football" },
  { key: "basketball_ncaab", label: "College Basketball" },
  { key: "baseball_ncaa", label: "College Baseball" },
  { key: "soccer_usa_mls", label: "MLS" },
  { key: "mma_mixed_martial_arts", label: "UFC / MMA" },
  { key: "boxing_boxing", label: "Boxing" },
];

const FUTURES_NAV = [
  { key: "americanfootball_nfl_super_bowl_winner", label: "Super Bowl" },
  { key: "basketball_nba_championship_winner", label: "NBA Champion" },
  { key: "baseball_mlb_world_series_winner", label: "World Series" },
  { key: "icehockey_nhl_championship_winner", label: "Stanley Cup" },
  { key: "americanfootball_ncaaf_championship_winner", label: "CFP Champion" },
  { key: "golf_masters_tournament_winner", label: "The Masters" },
  { key: "golf_pga_championship_winner", label: "PGA Championship" },
];

const QUICK_LINKS = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/my-bets", label: "My Bets", Icon: TicketIcon },
  { href: "/dashboard", label: "Dashboard", Icon: ChartIcon },
  { href: "/ledger", label: "Ledger", Icon: WalletIcon },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [gameCounts, setGameCounts] = useState<Record<string, number>>({});
  const [liveCounts, setLiveCounts] = useState<Record<string, number>>({});
  const [showMore, setShowMore] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function fetchCounts() {
      // Get all upcoming + live games grouped by sport
      const { data } = await supabase
        .from("games")
        .select("sport, status")
        .in("status", ["upcoming", "live"]);

      if (data) {
        const counts: Record<string, number> = {};
        const live: Record<string, number> = {};
        for (const g of data) {
          if (isOutrightSport(g.sport)) continue;
          counts[g.sport] = (counts[g.sport] || 0) + 1;
          if (g.status === "live") {
            live[g.sport] = (live[g.sport] || 0) + 1;
          }
        }
        setGameCounts(counts);
        setLiveCounts(live);
      }
    }

    fetchCounts();
    const interval = setInterval(fetchCounts, 30000);
    return () => clearInterval(interval);
  }, []);

  // Split sports: those with events first (sorted by count desc), then empty ones
  const withEvents = ALL_SPORTS.filter((s) => (gameCounts[s.key] || 0) > 0);
  const withoutEvents = ALL_SPORTS.filter(
    (s) => (gameCounts[s.key] || 0) === 0
  );

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

      {/* Search */}
      <div className="px-3 pt-3">
        <EventSearch />
      </div>

      <div className="border-t border-[var(--border)] mx-3 mt-3" />

      {/* Sports with events — shown first */}
      {withEvents.length > 0 && (
        <div className="p-3">
          <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2 px-3">
            Active Sports
          </p>
          <div className="space-y-0.5">
            {withEvents.map((sport) => (
              <SportNavItem
                key={sport.key}
                sport={sport}
                pathname={pathname}
                gameCount={gameCounts[sport.key] || 0}
                liveCount={liveCounts[sport.key] || 0}
              />
            ))}
          </div>
        </div>
      )}

      {/* Sports without events — collapsed by default */}
      {withoutEvents.length > 0 && (
        <div className="px-3 pb-3">
          <button
            onClick={() => setShowMore(!showMore)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider w-full hover:text-[var(--text-secondary)] transition"
          >
            <span>More Sports</span>
            <svg
              className={`w-3 h-3 transition-transform ${showMore ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
          {showMore && (
            <div className="space-y-0.5 mt-1">
              {withoutEvents.map((sport) => (
                <SportNavItem
                  key={sport.key}
                  sport={sport}
                  pathname={pathname}
                  gameCount={0}
                  liveCount={0}
                />
              ))}
            </div>
          )}
        </div>
      )}

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

function SportNavItem({
  sport,
  pathname,
  gameCount,
  liveCount,
}: {
  sport: { key: string; label: string };
  pathname: string;
  gameCount: number;
  liveCount: number;
}) {
  const isActive = pathname === `/sports/${sport.key}`;

  return (
    <Link
      href={`/sports/${sport.key}`}
      className={`flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm transition ${
        isActive
          ? "bg-[var(--bg-button)] text-white font-medium"
          : "text-[var(--text-secondary)] hover:bg-[var(--bg-button)] hover:text-white"
      }`}
    >
      <SportIcon sport={sport.key} className="w-4 h-4" />
      <span className="flex-1">{sport.label}</span>
      <div className="flex items-center gap-1.5">
        {liveCount > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-red-500 font-bold">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            {liveCount}
          </span>
        )}
        {gameCount > 0 && (
          <span className="text-[10px] text-[var(--text-muted)] font-medium">
            {gameCount}
          </span>
        )}
      </div>
    </Link>
  );
}
