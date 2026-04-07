"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Game, Market } from "@/lib/types";
import GameCard from "@/components/sports/GameCard";
import { SPORT_LABELS } from "@/lib/types";
import { useBetSlip } from "@/components/betslip/BetSlipContext";

export default function LivePage() {
  const [games, setGames] = useState<Game[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const { addSelection } = useBetSlip();

  useEffect(() => {
    async function fetchLive() {
      const { data: gamesData } = await supabase
        .from("games")
        .select("*")
        .eq("status", "live")
        .order("start_time", { ascending: true });

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

    fetchLive();

    // Refresh every 30 seconds
    const interval = setInterval(fetchLive, 30000);

    const channel = supabase
      .channel("live-games")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games", filter: "status=eq.live" },
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
      clearInterval(interval);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 animate-pulse">Loading live games...</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        <h1 className="text-2xl font-bold text-white">Live Betting</h1>
      </div>

      {games.length === 0 ? (
        <p className="text-gray-500 text-center py-12">
          No live games right now. Check back during game time.
        </p>
      ) : (
        Object.entries(gamesBySport).map(([sport, sportGames]) => (
          <section key={sport} className="space-y-3">
            <h2 className="text-lg font-bold text-white">
              {SPORT_LABELS[sport] || sport}
            </h2>
            {sportGames.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                markets={markets.filter((m) => m.game_id === game.id)}
                onSelectBet={handleSelectBet}
              />
            ))}
          </section>
        ))
      )}
    </div>
  );
}
