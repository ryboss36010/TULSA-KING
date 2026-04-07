"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Game, Market } from "@/lib/types";
import MarketGroup from "@/components/sports/MarketGroup";
import { useBetSlip } from "@/components/betslip/BetSlipContext";

export default function GameDetailPage() {
  const { game: gameId } = useParams<{ sport: string; game: string }>();
  const [game, setGame] = useState<Game | null>(null);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [activeTab, setActiveTab] = useState("game-lines");
  const supabase = createClient();
  const { addSelection } = useBetSlip();

  useEffect(() => {
    async function load() {
      const { data: gameData } = await supabase
        .from("games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (gameData) {
        setGame(gameData);

        const { data: marketData } = await supabase
          .from("markets")
          .select("*")
          .eq("game_id", gameId);

        if (marketData) setMarkets(marketData);
      }
    }

    load();

    const channel = supabase
      .channel(`game-${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "markets",
          filter: `game_id=eq.${gameId}`,
        },
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
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "games",
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          setGame(payload.new as Game);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  if (!game) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 animate-pulse">Loading...</div>
      </div>
    );
  }

  const gameLines = markets.filter(
    (m) => m.type === "moneyline" || m.type === "spread" || m.type === "over_under"
  );
  const playerProps = markets.filter(
    (m) => m.type === "prop" && m.name.toLowerCase().includes("player")
  );
  const gameProps = markets.filter(
    (m) => m.type === "prop" && !m.name.toLowerCase().includes("player")
  );

  const tabs = [
    { id: "game-lines", label: "Game Lines", count: gameLines.length },
    { id: "player-props", label: "Player Props", count: playerProps.length },
    { id: "game-props", label: "Game Props", count: gameProps.length },
  ];

  function handleSelectBet(g: Game, market: Market, pick: string) {
    addSelection({ game: g, market, pick });
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Game header */}
      <div className="text-center space-y-2">
        {game.status === "live" && (
          <span className="inline-flex items-center gap-1 text-red-500 text-xs font-bold">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            LIVE
          </span>
        )}
        <div className="flex items-center justify-center gap-6">
          <div className="text-center">
            <p className="text-white text-xl font-bold">{game.away_team}</p>
            {game.status === "live" && (
              <p className="text-3xl font-bold text-white">
                {game.away_score}
              </p>
            )}
          </div>
          <span className="text-gray-500 text-sm">@</span>
          <div className="text-center">
            <p className="text-white text-xl font-bold">{game.home_team}</p>
            {game.status === "live" && (
              <p className="text-3xl font-bold text-white">
                {game.home_score}
              </p>
            )}
          </div>
        </div>
        {game.status === "upcoming" && (
          <p className="text-gray-400 text-sm">
            {new Date(game.start_time).toLocaleString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        )}
      </div>

      {/* Market tabs */}
      <div className="flex gap-1 bg-gray-900 rounded-xl p-1 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg whitespace-nowrap transition ${
              activeTab === tab.id
                ? "bg-gray-800 text-white"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-1 text-xs text-gray-500">
                ({tab.count})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Market content */}
      <div className="space-y-4">
        {activeTab === "game-lines" && (
          <>
            <MarketGroup
              title="Spread"
              markets={gameLines.filter((m) => m.type === "spread")}
              game={game}
              onSelectBet={handleSelectBet}
            />
            <MarketGroup
              title="Moneyline"
              markets={gameLines.filter((m) => m.type === "moneyline")}
              game={game}
              onSelectBet={handleSelectBet}
            />
            <MarketGroup
              title="Total"
              markets={gameLines.filter((m) => m.type === "over_under")}
              game={game}
              onSelectBet={handleSelectBet}
            />
          </>
        )}
        {activeTab === "player-props" && (
          <MarketGroup
            title="Player Props"
            markets={playerProps}
            game={game}
            onSelectBet={handleSelectBet}
          />
        )}
        {activeTab === "game-props" && (
          <MarketGroup
            title="Game Props"
            markets={gameProps}
            game={game}
            onSelectBet={handleSelectBet}
          />
        )}

        {activeTab === "player-props" && playerProps.length === 0 && (
          <p className="text-gray-500 text-center py-8">
            No player props available for this game
          </p>
        )}
        {activeTab === "game-props" && gameProps.length === 0 && (
          <p className="text-gray-500 text-center py-8">
            No game props available for this game
          </p>
        )}
      </div>
    </div>
  );
}
