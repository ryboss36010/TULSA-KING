"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Game, Market } from "@/lib/types";
import SportSection from "@/components/sports/SportSection";
import GameCard from "@/components/sports/GameCard";
import { useBetSlip } from "@/components/betslip/BetSlipContext";

export default function HomePage() {
  const [games, setGames] = useState<Game[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const { addSelection } = useBetSlip();

  useEffect(() => {
    async function fetchGames() {
      const { data: gamesData } = await supabase
        .from("games")
        .select("*")
        .in("status", ["upcoming", "live"])
        .order("start_time", { ascending: true })
        .limit(50);

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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  function handleSelectBet(game: Game, market: Market, pick: string) {
    addSelection({ game, market, pick });
  }

  const gamesBySport = games.reduce(
    (acc, game) => {
      if (!acc[game.sport]) acc[game.sport] = [];
      acc[game.sport].push(game);
      return acc;
    },
    {} as Record<string, Game[]>
  );

  const liveGames = games.filter((g) => g.status === "live");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 animate-pulse">Loading games...</div>
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-black text-white mb-2">
          TULSA <span className="text-green-500">KING</span>
        </h1>
        <p className="text-gray-400">
          No games available right now. Check back soon.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
      {liveGames.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <h2 className="text-lg font-bold text-white">Live Now</h2>
          </div>
          {liveGames.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              markets={markets.filter((m) => m.game_id === game.id)}
              onSelectBet={handleSelectBet}
            />
          ))}
        </section>
      )}

      <div className="grid grid-cols-6 gap-1.5 px-4 text-xs text-gray-500 font-medium">
        <span className="text-center">SPREAD</span>
        <span className="text-center"></span>
        <span className="text-center">TOTAL</span>
        <span className="text-center"></span>
        <span className="text-center">MONEY</span>
        <span className="text-center"></span>
      </div>

      {Object.entries(gamesBySport).map(([sport, sportGames]) => {
        const upcoming = sportGames.filter((g) => g.status !== "live");
        if (upcoming.length === 0) return null;
        return (
          <SportSection
            key={sport}
            sport={sport}
            games={upcoming}
            markets={markets}
            onSelectBet={handleSelectBet}
          />
        );
      })}
    </div>
  );
}
