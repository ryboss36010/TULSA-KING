"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Game, Market } from "@/lib/types";
import { getSportLabel, isOutrightSport } from "@/lib/types";
import SportIcon from "@/components/icons/SportIcon";
import { formatDateLabel } from "@/lib/time";
import GameRow from "@/components/sports/GameRow";
import { filterBettableGames } from "@/lib/games";
import { WORKER_URL } from "@/lib/config";

export default function SportPage() {
  const { sport } = useParams<{ sport: string }>();
  const [games, setGames] = useState<Game[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

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

    load();
  }, [sport]);

  const isOutright = isOutrightSport(sport);

  const gamesByDate = !isOutright
    ? games.reduce(
        (acc, game) => {
          const label = formatDateLabel(game.start_time);
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
    <div className="max-w-4xl mx-auto px-3 md:px-6 py-4 space-y-5">
      <div className="flex items-center gap-2 px-1">
        <SportIcon sport={sport} className="w-6 h-6 text-[var(--text-secondary)]" />
        <h1 className="text-xl font-bold text-white">{getSportLabel(sport)}</h1>
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
        <div className="space-y-1.5">
          {games.map((game) => (
            <GameRow
              key={game.id}
              game={game}
              markets={markets.filter((m) => m.game_id === game.id)}

            />
          ))}
        </div>
      ) : (
        Object.entries(gamesByDate).map(([date, dateGames]) => (
          <section key={date} className="space-y-2">
            <div className="px-2">
              <span className="text-sm font-bold text-[var(--text-secondary)] uppercase">
                {date}
              </span>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[minmax(0,1fr)_repeat(3,72px)] md:grid-cols-[minmax(0,1fr)_repeat(3,96px)] gap-1 items-center">
              <div />
              <span className="text-xs text-[var(--text-muted)] text-center font-semibold">
                SPREAD
              </span>
              <span className="text-xs text-[var(--text-muted)] text-center font-semibold">
                TOTAL
              </span>
              <span className="text-xs text-[var(--text-muted)] text-center font-semibold">
                MONEY
              </span>
            </div>

            <div className="space-y-1">
              {dateGames.map((game) => (
                <GameRow
                  key={game.id}
                  game={game}
                  markets={markets.filter((m) => m.game_id === game.id)}
    
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
