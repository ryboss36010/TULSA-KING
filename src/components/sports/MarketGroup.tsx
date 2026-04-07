"use client";

import type { Game, Market } from "@/lib/types";
import OddsButton from "./OddsButton";

interface MarketGroupProps {
  title: string;
  markets: Market[];
  game: Game;
  onSelectBet: (game: Game, market: Market, pick: string) => void;
}

export default function MarketGroup({
  title,
  markets,
  game,
  onSelectBet,
}: MarketGroupProps) {
  if (markets.length === 0) return null;

  const isOutright = markets[0]?.type === "outright";

  return (
    <div className="space-y-3">
      <h3 className="text-white font-semibold text-sm border-b border-gray-800 pb-2">
        {title}
      </h3>
      {isOutright ? (
        // Outright/futures: list of outcomes with a single odds button each
        <div className="space-y-1">
          {markets.map((market) => (
            <div
              key={market.id}
              className="flex items-center justify-between bg-gray-800/50 rounded-lg px-4 py-3"
            >
              <span className="text-gray-300 text-sm flex-1">
                {market.name}
              </span>
              <OddsButton
                label="To Win"
                odds={market.home_odds}
                onClick={() => onSelectBet(game, market, market.name)}
              />
            </div>
          ))}
        </div>
      ) : (
        // Standard 2-sided markets
        markets.map((market) => (
          <div
            key={market.id}
            className="flex items-center justify-between bg-gray-800/50 rounded-lg px-4 py-3"
          >
            <span className="text-gray-300 text-sm flex-1">{market.name}</span>
            <div className="flex gap-2">
              {market.type === "over_under" ? (
                <>
                  <OddsButton
                    label={`O ${market.line}`}
                    odds={market.over_odds!}
                    onClick={() => onSelectBet(game, market, "over")}
                  />
                  <OddsButton
                    label={`U ${market.line}`}
                    odds={market.under_odds!}
                    onClick={() => onSelectBet(game, market, "under")}
                  />
                </>
              ) : (
                <>
                  <OddsButton
                    label={game.home_team.split(" ").pop()!}
                    odds={market.home_odds}
                    onClick={() => onSelectBet(game, market, "home")}
                  />
                  <OddsButton
                    label={game.away_team.split(" ").pop()!}
                    odds={market.away_odds}
                    onClick={() => onSelectBet(game, market, "away")}
                  />
                </>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
