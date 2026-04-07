"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Game, Market } from "@/lib/types";
import { isOutrightSport } from "@/lib/types";
import SportSection from "@/components/sports/SportSection";
import GameRow from "@/components/sports/GameRow";
import SportTabs from "@/components/sports/SportTabs";
import EventSearch from "@/components/search/EventSearch";
import { formatDateLabel } from "@/lib/time";
import { filterBettableGames } from "@/lib/games";

export default function HomePage() {
  const [games, setGames] = useState<Game[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSport, setActiveSport] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const supabase = createClient();
  useEffect(() => {
    async function fetchGames() {
      const { data: gamesData } = await supabase
        .from("games")
        .select("*")
        .in("status", ["upcoming", "live"])
        .order("start_time", { ascending: true });

      if (gamesData) {
        const bettable = filterBettableGames(gamesData);
        setGames(bettable);
        const gameIds = bettable.map((g) => g.id);
        if (gameIds.length > 0) {
          const { data: marketsData } = await supabase
            .from("markets")
            .select("*")
            .in("game_id", gameIds);
          if (marketsData) setMarkets(marketsData);
        }
      }
      setLoading(false);
    }

    fetchGames();

    const channel = supabase
      .channel("home-games")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games" },
        (payload) => {
          setGames((prev) => {
            const updated = payload.new as Game;
            const idx = prev.findIndex((g) => g.id === updated.id);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = updated;
              return copy;
            }
            return [...prev, updated];
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "markets" },
        (payload) => {
          setMarkets((prev) => {
            const updated = payload.new as Market;
            const idx = prev.findIndex((m) => m.id === updated.id);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = updated;
              return copy;
            }
            return [...prev, updated];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Get unique sports for tabs
  const allSports = [...new Set(games.map((g) => g.sport))].filter(
    (s) => !isOutrightSport(s)
  );
  const gameCounts = allSports.reduce(
    (acc, s) => {
      acc[s] = games.filter((g) => g.sport === s).length;
      return acc;
    },
    {} as Record<string, number>
  );

  // Filter games
  const filteredGames = activeSport
    ? games.filter((g) => g.sport === activeSport)
    : games;

  const liveGames = filteredGames.filter((g) => g.status === "live");
  const futuresGames = filteredGames.filter(
    (g) => g.status !== "live" && isOutrightSport(g.sport)
  );
  const upcomingGames = filteredGames.filter(
    (g) => g.status !== "live" && !isOutrightSport(g.sport)
  );

  // Group upcoming by date label using timezone-aware formatter
  const gamesByDate = upcomingGames.reduce(
    (acc, game) => {
      const label = formatDateLabel(game.start_time);
      if (!acc[label]) acc[label] = [];
      acc[label].push(game);
      return acc;
    },
    {} as Record<string, Game[]>
  );

  const dateEntries = Object.entries(gamesByDate).map(([date, dateGames]) => {
    const bySport = dateGames.reduce(
      (acc, game) => {
        if (!acc[game.sport]) acc[game.sport] = [];
        acc[game.sport].push(game);
        return acc;
      },
      {} as Record<string, Game[]>
    );
    return { date, bySport };
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[var(--text-muted)] animate-pulse text-sm">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-3 md:px-6 py-4 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <h1 className="text-2xl font-black text-white md:hidden">
          TULSA <span className="text-[var(--accent-green)]">KING</span>
        </h1>
        <button
          onClick={() => setSearchOpen(!searchOpen)}
          className="p-2.5 rounded-lg bg-[var(--bg-button)] text-[var(--text-muted)] hover:text-white md:hidden"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      </div>

      {/* Search (toggled on mobile, always visible on desktop) */}
      <div className={`${searchOpen ? "block" : "hidden"} md:block`}>
        <EventSearch />
      </div>

      {/* Sport tabs */}
      <SportTabs
        sports={allSports}
        activeSport={activeSport}
        onSelect={setActiveSport}
        gameCounts={gameCounts}
      />

      {/* Live games */}
      {liveGames.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2 px-2">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm font-bold text-red-500">LIVE NOW</span>
          </div>
          <div className="space-y-1.5">
            {liveGames.map((game) => (
              <GameRow
                key={game.id}
                game={game}
                markets={markets.filter((m) => m.game_id === game.id)}

              />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming by date */}
      {dateEntries.map(({ date, bySport }) => (
        <section key={date} className="space-y-2">
          <div className="px-2">
            <span className="text-sm font-bold text-[var(--text-secondary)] uppercase">
              {date}
            </span>
          </div>
          <div className="space-y-3">
            {Object.entries(bySport).map(([sport, sportGames]) => (
              <SportSection
                key={sport}
                sport={sport}
                games={sportGames}
                markets={markets}

              />
            ))}
          </div>
        </section>
      ))}

      {/* Futures */}
      {futuresGames.length > 0 && (
        <section className="space-y-2">
          <div className="px-2">
            <span className="text-sm font-bold text-[var(--accent-green)] uppercase">
              Futures
            </span>
          </div>
          <div className="space-y-1.5">
            {futuresGames.map((game) => (
              <GameRow
                key={game.id}
                game={game}
                markets={markets.filter((m) => m.game_id === game.id)}

              />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {filteredGames.length === 0 && (
        <div className="text-center py-16">
          <p className="text-[var(--text-muted)] text-base">
            No games available. Use search to find events.
          </p>
        </div>
      )}
    </div>
  );
}
