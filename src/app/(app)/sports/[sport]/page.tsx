"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Game, Market } from "@/lib/types";
import { SPORT_LABELS } from "@/lib/types";
import GameCard from "@/components/sports/GameCard";
import { useBetSlip } from "@/components/betslip/BetSlipContext";

export default function SportPage() {
  const { sport } = useParams<{ sport: string }>();
  const [games, setGames] = useState<Game[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const { addSelection } = useBetSlip();

  useEffect(() => {
    async function load() {
      const { data: gamesData } = await supabase
        .from("games")
        .select("*")
        .eq("sport", sport)
        .in("status", ["upcoming", "live"])
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

    load();
  }, [sport]);

  function handleSelectBet(game: Game, market: Market, pick: string) {
    addSelection({ game, market, pick });
  }

  // Group by date
  const gamesByDate = games.reduce(
    (acc, game) => {
      const date = new Date(game.start_time).toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
      if (!acc[date]) acc[date] = [];
      acc[date].push(game);
      return acc;
    },
    {} as Record<string, Game[]>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">
        {SPORT_LABELS[sport] || sport}
      </h1>

      {games.length === 0 ? (
        <p className="text-gray-500 text-center py-12">
          No upcoming games for this sport.
        </p>
      ) : (
        Object.entries(gamesByDate).map(([date, dateGames]) => (
          <section key={date} className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-400 uppercase">
              {date}
            </h2>
            {dateGames.map((game) => (
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
