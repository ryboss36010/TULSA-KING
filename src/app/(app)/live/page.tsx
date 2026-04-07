"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Game, Market } from "@/lib/types";
import SportSection from "@/components/sports/SportSection";
import { useBetSlip } from "@/components/betslip/BetSlipContext";
import { filterBettableGames } from "@/lib/games";

export default function LivePage() {
  const [games, setGames] = useState<Game[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const { toggleSelection } = useBetSlip();

  useEffect(() => {
    async function fetchLive() {
      const { data: gamesData } = await supabase
        .from("games")
        .select("*")
        .eq("status", "live")
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

    fetchLive();
    const interval = setInterval(fetchLive, 15000);

    const channel = supabase
      .channel("live-games")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games" },
        (payload) => {
          const updated = payload.new as Game;
          if (updated.status === "live") {
            setGames((prev) => {
              const idx = prev.findIndex((g) => g.id === updated.id);
              if (idx >= 0) {
                const copy = [...prev];
                copy[idx] = updated;
                return copy;
              }
              return [...prev, updated];
            });
          } else {
            setGames((prev) => prev.filter((g) => g.id !== updated.id));
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  function handleSelectBet(game: Game, market: Market, pick: string) {
    toggleSelection({ game, market, pick });
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
        <div className="text-[var(--text-muted)] animate-pulse text-sm">
          Loading live games...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-2 md:px-4 py-3 space-y-3">
      <div className="flex items-center gap-2 px-2">
        <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
        <h1 className="text-lg font-bold text-white">Live</h1>
      </div>

      {games.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[var(--text-muted)] text-sm">
            No live games right now. Check back during game time.
          </p>
        </div>
      ) : (
        Object.entries(gamesBySport).map(([sport, sportGames]) => (
          <SportSection
            key={sport}
            sport={sport}
            games={sportGames}
            markets={markets}
            onSelectBet={handleSelectBet}
          />
        ))
      )}
    </div>
  );
}
