"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Game, OddsApiSport } from "@/lib/types";
import { getSportLabel, isOutrightSport } from "@/lib/types";
import SportIcon from "@/components/icons/SportIcon";
import { WORKER_URL } from "@/lib/config";

interface SearchResult {
  type: "game" | "sport";
  game?: Game;
  sport?: OddsApiSport;
}

export default function EventSearch() {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [allSports, setAllSports] = useState<OddsApiSport[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingSport, setFetchingSport] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();

  // Load all available sports from the worker on first focus
  useEffect(() => {
    if (!isOpen || allSports.length > 0) return;

    async function loadSports() {
      try {
        const resp = await fetch(`${WORKER_URL}/all-sports`);
        const data: OddsApiSport[] = await resp.json();
        if (Array.isArray(data)) {
          setAllSports(data);
        }
      } catch (e) {
        console.error("Failed to load sports:", e);
      }
    }

    loadSports();
  }, [isOpen]);

  // Search as user types
  useEffect(() => {
    if (!query.trim()) {
      // Show active sports when empty
      const active = allSports
        .filter((s) => s.active)
        .sort((a, b) => a.title.localeCompare(b.title));
      setResults(active.map((s) => ({ type: "sport" as const, sport: s })));
      return;
    }

    const q = query.toLowerCase();
    setLoading(true);

    async function search() {
      // Search Supabase games
      const { data: games } = await supabase
        .from("games")
        .select("*")
        .in("status", ["upcoming", "live"])
        .or(
          `home_team.ilike.%${q}%,away_team.ilike.%${q}%,sport.ilike.%${q}%`
        )
        .order("start_time", { ascending: true })
        .limit(20);

      // Also search sports list
      const matchingSports = allSports.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.key.toLowerCase().includes(q) ||
          s.group.toLowerCase().includes(q)
      );

      const combined: SearchResult[] = [];

      // Add matching games first
      if (games) {
        for (const game of games) {
          combined.push({ type: "game", game });
        }
      }

      // Add matching sports that aren't already represented by games
      const gameSports = new Set(games?.map((g) => g.sport) || []);
      for (const sport of matchingSports) {
        if (!gameSports.has(sport.key)) {
          combined.push({ type: "sport", sport });
        }
      }

      setResults(combined);
      setLoading(false);
    }

    const timer = setTimeout(search, 200);
    return () => clearTimeout(timer);
  }, [query, allSports]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // On-demand fetch: when user clicks a sport that has no games synced yet
  async function handleFetchSport(sport: OddsApiSport) {
    setFetchingSport(sport.key);
    try {
      await fetch(`${WORKER_URL}/fetch-sport/${sport.key}`);
      // Now query Supabase for the newly synced games
      const { data: games } = await supabase
        .from("games")
        .select("*")
        .eq("sport", sport.key)
        .in("status", ["upcoming", "live"])
        .order("start_time", { ascending: true });

      if (games && games.length > 0) {
        // Navigate to the sport page
        router.push(`/sports/${sport.key}`);
        setIsOpen(false);
      } else {
        // No events available for this sport right now
        setResults((prev) => prev.filter((r) => r.sport?.key !== sport.key));
      }
    } catch (e) {
      console.error("Failed to fetch sport:", e);
    }
    setFetchingSport(null);
  }

  function handleGameClick(game: Game) {
    router.push(`/sports/${game.sport}/${game.id}`);
    setIsOpen(false);
    setQuery("");
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Search input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          placeholder="Search events, sports, teams..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          className="w-full px-4 py-2.5 pl-10 bg-[var(--bg-button)] border border-[var(--border)] rounded-lg text-white placeholder-[var(--text-muted)] focus:border-[var(--accent-green)] focus:outline-none text-sm"
        />
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        {query && (
          <button
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Dropdown results */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg shadow-2xl max-h-96 overflow-y-auto z-50">
          {loading && (
            <div className="px-4 py-3 text-gray-500 text-sm text-center">
              Searching...
            </div>
          )}

          {!loading && results.length === 0 && query.trim() && (
            <div className="px-4 py-6 text-gray-500 text-sm text-center">
              No events found for &ldquo;{query}&rdquo;
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="py-2">
              {/* Section: Games in database */}
              {results.some((r) => r.type === "game") && (
                <>
                  <div className="px-4 py-1.5 text-xs font-semibold text-gray-500 uppercase">
                    Games
                  </div>
                  {results
                    .filter((r) => r.type === "game")
                    .map((r) => (
                      <button
                        key={r.game!.id}
                        onClick={() => handleGameClick(r.game!)}
                        className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-800 transition text-left"
                      >
                        <SportIcon sport={r.game!.sport} className="w-5 h-5 text-[var(--text-secondary)]" />
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">
                            {r.game!.away_team
                              ? `${r.game!.away_team} @ ${r.game!.home_team}`
                              : r.game!.home_team}
                          </p>
                          <p className="text-gray-500 text-xs">
                            {getSportLabel(r.game!.sport)} &middot;{" "}
                            {new Date(r.game!.start_time).toLocaleDateString(
                              "en-US",
                              { weekday: "short", month: "short", day: "numeric" }
                            )}
                            {r.game!.status === "live" && (
                              <span className="text-red-500 ml-1 font-bold">
                                LIVE
                              </span>
                            )}
                          </p>
                        </div>
                        <svg
                          className="w-4 h-4 text-gray-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </button>
                    ))}
                </>
              )}

              {/* Section: Sports to explore */}
              {results.some((r) => r.type === "sport") && (
                <>
                  <div className="px-4 py-1.5 text-xs font-semibold text-gray-500 uppercase mt-2">
                    {query.trim() ? "Sports & Futures" : "All Active Sports"}
                  </div>
                  {results
                    .filter((r) => r.type === "sport")
                    .map((r) => (
                      <button
                        key={r.sport!.key}
                        onClick={() => handleFetchSport(r.sport!)}
                        disabled={fetchingSport === r.sport!.key}
                        className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-800 transition text-left disabled:opacity-50"
                      >
                        <SportIcon sport={r.sport!.key} className="w-5 h-5 text-[var(--text-secondary)]" />
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">
                            {r.sport!.title}
                          </p>
                          <p className="text-gray-500 text-xs">
                            {r.sport!.group}
                            {isOutrightSport(r.sport!.key) && (
                              <span className="text-green-500 ml-1">
                                Futures
                              </span>
                            )}
                            {!r.sport!.active && (
                              <span className="text-yellow-600 ml-1">
                                Off-season
                              </span>
                            )}
                          </p>
                        </div>
                        {fetchingSport === r.sport!.key ? (
                          <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg
                            className="w-4 h-4 text-gray-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        )}
                      </button>
                    ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
