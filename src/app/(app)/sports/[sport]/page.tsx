"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Game, Market } from "@/lib/types";
import { getSportLabel, getSportIcon, isOutrightSport } from "@/lib/types";
import GameRow from "@/components/sports/GameRow";
import { useBetSlip } from "@/components/betslip/BetSlipContext";

const WORKER_URL = "https://tulsa-king-odds.ryboss36010.workers.dev";

export default function SportPage() {
  const { sport } = useParams<{ sport: string }>();
  const [games, setGames] = useState<Game[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const { addSelection } = useBetSlip();

  useEffect(() => {
    async function load() {
      let { data: gamesData } = await supabase
        .from("games")
        .select("*")
        .eq("sport", sport)
        .in("status", ["upcoming", "live"])
        .order("start_time", { ascending: true });

      if (!gamesData || gamesData.length === 0) {
        try {
          await fetch(`${WORKER_URL}/fetch-sport/${sport}`);
          const result = await supabase
            .from("games")
            .select("*")
            .eq("sport", sport)
            .in("status", ["upcoming", "live"])
            .order("start_time", { ascending: true });
          gamesData = result.data;
        } catch (e) {
          console.error("On-demand fetch failed:", e);
        }
      }

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

  const isOutright = isOutrightSport(sport);

  const gamesByDate = !isOutright
    ? games.reduce(
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
      )
    : {};

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
      <div className="flex items-center gap-2 px-2">
        <span className="text-lg">{getSportIcon(sport)}</span>
        <h1 className="text-lg font-bold text-white">{getSportLabel(sport)}</h1>
        {isOutright && (
          <span className="text-[10px] text-[var(--accent-green)] font-semibold bg-[var(--bg-button)] px-2 py-0.5 rounded">
            FUTURES
          </span>
        )}
      </div>

      {games.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[var(--text-muted)] text-sm">
            No upcoming events.
          </p>
        </div>
      ) : isOutright ? (
        <div className="space-y-0.5">
          {games.map((game) => (
            <GameRow
              key={game.id}
              game={game}
              markets={markets.filter((m) => m.game_id === game.id)}
              onSelectBet={handleSelectBet}
            />
          ))}
        </div>
      ) : (
        Object.entries(gamesByDate).map(([date, dateGames]) => (
          <section key={date} className="space-y-1">
            <div className="px-3 py-1.5">
              <span className="text-xs font-semibold text-[var(--text-muted)] uppercase">
                {date}
              </span>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[minmax(0,1fr)_repeat(3,64px)] md:grid-cols-[minmax(0,1fr)_repeat(3,80px)] gap-0.5 items-center">
              <div />
              <span className="text-[10px] text-[var(--text-muted)] text-center font-medium">
                SPREAD
              </span>
              <span className="text-[10px] text-[var(--text-muted)] text-center font-medium">
                TOTAL
              </span>
              <span className="text-[10px] text-[var(--text-muted)] text-center font-medium">
                MONEY
              </span>
            </div>

            {dateGames.map((game) => (
              <GameRow
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
