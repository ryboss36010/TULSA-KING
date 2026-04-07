"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Game, Market } from "@/lib/types";
import { isOutrightSport, getSportLabel } from "@/lib/types";
import SportSection from "@/components/sports/SportSection";
import GameRow from "@/components/sports/GameRow";
import EventSearch from "@/components/search/EventSearch";
import { formatDateLabel } from "@/lib/time";
import { filterBettableGames } from "@/lib/games";

// Major sports shown on homepage — everything else is search-only
const HOMEPAGE_SPORTS = new Set([
  "americanfootball_nfl",
  "americanfootball_ncaaf",
  "basketball_nba",
  "basketball_ncaab",
  "baseball_mlb",
  "baseball_ncaa",
  "icehockey_nhl",
]);

// Priority order for the Popular section
const SPORT_PRIORITY: Record<string, number> = {
  americanfootball_nfl: 1,
  basketball_nba: 2,
  baseball_mlb: 3,
  icehockey_nhl: 4,
  americanfootball_ncaaf: 5,
  basketball_ncaab: 6,
  baseball_ncaa: 7,
  mma_mixed_martial_arts: 8,
  soccer_usa_mls: 9,
};

export default function HomePage() {
  const [games, setGames] = useState<Game[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
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

  // Only homepage sports (major)
  const mainGames = games.filter(
    (g) => HOMEPAGE_SPORTS.has(g.sport) && !isOutrightSport(g.sport)
  );

  const liveGames = mainGames.filter((g) => g.status === "live");

  // Popular: live games first, then today's games from highest-priority sports
  const popularGames = buildPopularSection(mainGames, markets);

  // Upcoming grouped by date, excluding live + popular
  const popularIds = new Set(popularGames.map((g) => g.id));
  const upcomingGames = mainGames.filter(
    (g) => g.status !== "live" && !popularIds.has(g.id)
  );

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

  // Futures (outright)
  const futuresGames = games.filter(
    (g) => g.status !== "live" && isOutrightSport(g.sport)
  );

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
          <svg
            className="w-5 h-5"
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
        </button>
      </div>

      {/* Search */}
      <div className={`${searchOpen ? "block" : "hidden"} md:block`}>
        <EventSearch />
      </div>

      {/* POPULAR SECTION */}
      {popularGames.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2 px-2">
            <svg
              className="w-4 h-4 text-[var(--accent-green)]"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            <span className="text-sm font-bold text-[var(--accent-green)] uppercase">
              Popular
            </span>
          </div>
          {/* Group popular by sport */}
          {Object.entries(
            popularGames.reduce(
              (acc, g) => {
                if (!acc[g.sport]) acc[g.sport] = [];
                acc[g.sport].push(g);
                return acc;
              },
              {} as Record<string, Game[]>
            )
          )
            .sort(
              ([a], [b]) =>
                (SPORT_PRIORITY[a] || 99) - (SPORT_PRIORITY[b] || 99)
            )
            .map(([sport, sportGames]) => (
              <SportSection
                key={sport}
                sport={sport}
                games={sportGames}
                markets={markets}
              />
            ))}
        </section>
      )}

      {/* LIVE GAMES (if any not already in popular) */}
      {liveGames.filter((g) => !popularIds.has(g.id)).length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2 px-2">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm font-bold text-red-500">LIVE NOW</span>
          </div>
          <div className="space-y-1.5">
            {liveGames
              .filter((g) => !popularIds.has(g.id))
              .map((game) => (
                <GameRow
                  key={game.id}
                  game={game}
                  markets={markets.filter((m) => m.game_id === game.id)}
                />
              ))}
          </div>
        </section>
      )}

      {/* UPCOMING BY DATE */}
      {dateEntries.map(({ date, bySport }) => (
        <section key={date} className="space-y-2">
          <div className="px-2">
            <span className="text-sm font-bold text-[var(--text-secondary)] uppercase">
              {date}
            </span>
          </div>
          <div className="space-y-3">
            {Object.entries(bySport)
              .sort(
                ([a], [b]) =>
                  (SPORT_PRIORITY[a] || 99) - (SPORT_PRIORITY[b] || 99)
              )
              .map(([sport, sportGames]) => (
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

      {/* FUTURES */}
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
      {mainGames.length === 0 && futuresGames.length === 0 && (
        <div className="text-center py-16">
          <p className="text-[var(--text-muted)] text-base">
            No games available. Use search to find events.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Build the "Popular" section:
 * - All live games
 * - Today's games with odds, sorted by sport priority
 * - Cap at ~12 games to keep it digestible
 */
function buildPopularSection(games: Game[], markets: Market[]): Game[] {
  const marketsByGame = new Set(markets.map((m) => m.game_id));

  // Live games always popular
  const live = games.filter((g) => g.status === "live");

  // Today's games with odds, sorted by sport priority
  const now = new Date();
  const todayStr = now.toLocaleDateString("en-US");
  const todayWithOdds = games
    .filter((g) => {
      if (g.status === "live") return false; // already in live
      const gameDate = new Date(g.start_time).toLocaleDateString("en-US");
      return gameDate === todayStr && marketsByGame.has(g.id);
    })
    .sort(
      (a, b) =>
        (SPORT_PRIORITY[a.sport] || 99) - (SPORT_PRIORITY[b.sport] || 99) ||
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );

  const result = [...live, ...todayWithOdds];
  return result.slice(0, 16);
}
