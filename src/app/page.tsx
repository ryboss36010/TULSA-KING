"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Game, Market } from "@/lib/types";
import { isOutrightSport } from "@/lib/types";
import SportSection from "@/components/sports/SportSection";
import GameRow from "@/components/sports/GameRow";
import SportTabs from "@/components/sports/SportTabs";
import EventSearch from "@/components/search/EventSearch";
import { useBetSlip } from "@/components/betslip/BetSlipContext";

export default function HomePage() {
  const [games, setGames] = useState<Game[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSport, setActiveSport] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const supabase = createClient();
  const { addSelection } = useBetSlip();

  useEffect(() => {
    async function fetchGames() {
      const { data: gamesData } = await supabase
        .from("games")
        .select("*")
        .in("status", ["upcoming", "live"])
        .order("start_time", { ascending: true })
        .limit(200);

      if (gamesData) {
        setGames(gamesData);
        const gameIds = gamesData.map((g) => g.id);
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

  function handleSelectBet(game: Game, market: Market, pick: string) {
    addSelection({ game, market, pick });
  }

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

  // Group upcoming by date, then by sport
  const gamesByDate = upcomingGames.reduce(
    (acc, game) => {
      const now = new Date();
      const gameDate = new Date(game.start_time);
      const isToday = gameDate.toDateString() === now.toDateString();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const isTomorrow = gameDate.toDateString() === tomorrow.toDateString();

      let label: string;
      if (isToday) label = "Today";
      else if (isTomorrow) label = "Tomorrow";
      else
        label = gameDate.toLocaleDateString([], {
          weekday: "short",
          month: "short",
          day: "numeric",
        });

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
    <div className="max-w-4xl mx-auto px-2 md:px-4 py-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between px-2">
        <h1 className="text-xl font-black text-white md:hidden">
          TULSA <span className="text-[var(--accent-green)]">KING</span>
        </h1>
        <button
          onClick={() => setSearchOpen(!searchOpen)}
          className="p-2 rounded-lg bg-[var(--bg-button)] text-[var(--text-muted)] hover:text-white md:hidden"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <section className="space-y-0.5">
          <div className="flex items-center gap-2 px-3 py-2">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            <span className="text-xs font-semibold text-red-500">LIVE</span>
          </div>
          {liveGames.map((game) => (
            <GameRow
              key={game.id}
              game={game}
              markets={markets.filter((m) => m.game_id === game.id)}
              onSelectBet={handleSelectBet}
            />
          ))}
        </section>
      )}

      {/* Upcoming by date */}
      {dateEntries.map(({ date, bySport }) => (
        <section key={date} className="space-y-1">
          <div className="px-3 py-1.5">
            <span className="text-xs font-semibold text-[var(--text-muted)] uppercase">
              {date}
            </span>
          </div>
          {Object.entries(bySport).map(([sport, sportGames]) => (
            <SportSection
              key={sport}
              sport={sport}
              games={sportGames}
              markets={markets}
              onSelectBet={handleSelectBet}
            />
          ))}
        </section>
      ))}

      {/* Futures */}
      {futuresGames.length > 0 && (
        <section className="space-y-0.5">
          <div className="px-3 py-2">
            <span className="text-xs font-semibold text-[var(--accent-green)] uppercase">
              Futures
            </span>
          </div>
          {futuresGames.map((game) => (
            <GameRow
              key={game.id}
              game={game}
              markets={markets.filter((m) => m.game_id === game.id)}
              onSelectBet={handleSelectBet}
            />
          ))}
        </section>
      )}

      {/* Empty state */}
      {filteredGames.length === 0 && (
        <div className="text-center py-16">
          <p className="text-[var(--text-muted)] text-sm">
            No games available. Use search to find events.
          </p>
        </div>
      )}
    </div>
  );
}
