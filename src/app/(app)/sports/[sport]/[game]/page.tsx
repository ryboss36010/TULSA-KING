"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Game, Market } from "@/lib/types";
import { isOutrightSport, getSportLabel } from "@/lib/types";
import MarketGroup from "@/components/sports/MarketGroup";
import LiveStats from "@/components/sports/LiveStats";
import { useBetSlip } from "@/components/betslip/BetSlipContext";
import { formatGameDateTime, formatGameDateLong } from "@/lib/time";

export default function GameDetailPage() {
  const { game: gameId } = useParams<{ sport: string; game: string }>();
  const [game, setGame] = useState<Game | null>(null);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [activeTab, setActiveTab] = useState("game-lines");
  const [searchQuery, setSearchQuery] = useState("");
  const supabase = createClient();
  const { toggleSelection } = useBetSlip();

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

  function handleSelectBet(g: Game, market: Market, pick: string) {
    toggleSelection({ game: g, market, pick });
  }

  const isOutright = isOutrightSport(game.sport);

  // Outright/futures detail page
  if (isOutright) {
    const outrightMarkets = markets
      .filter((m) => m.type === "outright")
      .sort((a, b) => {
        const aOdds = a.home_odds;
        const bOdds = b.home_odds;
        if (aOdds > 0 && bOdds > 0) return aOdds - bOdds;
        if (aOdds < 0 && bOdds < 0) return bOdds - aOdds;
        return aOdds < 0 ? -1 : 1;
      });

    const filtered = searchQuery
      ? outrightMarkets.filter((m) =>
          m.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : outrightMarkets;

    return (
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <p className="text-[var(--accent-green)] text-xs font-semibold uppercase">
            Futures
          </p>
          <h1 className="text-white text-2xl font-bold">{game.home_team}</h1>
          <p className="text-[var(--text-secondary)] text-sm">
            {getSportLabel(game.sport)} &middot; {formatGameDateLong(game.start_time)}
          </p>
          <p className="text-[var(--text-muted)] text-xs">
            {outrightMarkets.length} outcomes available
          </p>
        </div>

        {/* Search within outcomes */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search outcomes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 pl-10 bg-[var(--bg-button)] border border-[var(--border)] rounded-lg text-white placeholder-[var(--text-muted)] focus:border-[var(--accent-green)] focus:outline-none"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
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
        </div>

        {/* Outcomes list */}
        <MarketGroup
          title={`Outcomes${filtered.length !== outrightMarkets.length ? ` (${filtered.length} of ${outrightMarkets.length})` : ""}`}
          markets={filtered}
          game={game}
          onSelectBet={handleSelectBet}
        />
      </div>
    );
  }

  // Standard game detail page
  const gameLines = markets.filter(
    (m) => m.type === "moneyline" || m.type === "spread" || m.type === "over_under"
  );
  const allProps = markets.filter((m) => m.type === "prop");
  const playerProps = allProps; // All props from the Odds API are player props
  const gameProps: Market[] = [];

  const tabs = [
    { id: "game-lines", label: "Game Lines", count: gameLines.length },
    { id: "player-props", label: "Player Props", count: playerProps.length },
    { id: "game-props", label: "Game Props", count: gameProps.length },
  ];

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
          <p className="text-[var(--text-secondary)] text-sm">
            {formatGameDateTime(game.start_time)}
          </p>
        )}
      </div>

      {/* Live stats from ESPN */}
      <LiveStats game={game} />

      {/* Market tabs */}
      <div className="flex gap-1 bg-[var(--bg-secondary)] rounded-lg p-1 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg whitespace-nowrap transition ${
              activeTab === tab.id
                ? "bg-[var(--bg-button)] text-white"
                : "text-[var(--text-muted)] hover:text-white"
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
        {activeTab === "player-props" && playerProps.length > 0 && (
          <>
            {Object.entries(
              playerProps.reduce(
                (acc, m) => {
                  // Extract category from name like "LeBron James - Points" → "Points"
                  const dashIdx = m.name.lastIndexOf(" - ");
                  const category = dashIdx >= 0 ? m.name.slice(dashIdx + 3) : "Other";
                  if (!acc[category]) acc[category] = [];
                  acc[category].push(m);
                  return acc;
                },
                {} as Record<string, Market[]>
              )
            )
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([category, catMarkets]) => (
                <MarketGroup
                  key={category}
                  title={category}
                  markets={catMarkets.sort((a, b) => a.name.localeCompare(b.name))}
                  game={game}
                  onSelectBet={handleSelectBet}
                />
              ))}
          </>
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
          <p className="text-[var(--text-muted)] text-center py-8">
            No player props available for this game
          </p>
        )}
        {activeTab === "game-props" && gameProps.length === 0 && (
          <p className="text-[var(--text-muted)] text-center py-8">
            No game props available for this game
          </p>
        )}
      </div>
    </div>
  );
}
