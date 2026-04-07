"use client";

import Link from "next/link";
import type { Game, Market } from "@/lib/types";
import OddsButton from "./OddsButton";

interface GameCardProps {
  game: Game;
  markets: Market[];
  onSelectBet: (game: Game, market: Market, pick: string) => void;
}

export default function GameCard({ game, markets, onSelectBet }: GameCardProps) {
  const moneyline = markets.find((m) => m.type === "moneyline");
  const spread = markets.find((m) => m.type === "spread");
  const total = markets.find((m) => m.type === "over_under");

  const startTime = new Date(game.start_time);
  const isLive = game.status === "live";

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      {/* Game header — tappable to go to game detail */}
      <Link
        href={`/sports/${game.sport}/${game.id}`}
        className="block px-4 py-3 hover:bg-gray-800/50 transition"
      >
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <p className="text-white font-medium">{game.away_team}</p>
            <p className="text-white font-medium">{game.home_team}</p>
          </div>
          <div className="text-right">
            {isLive ? (
              <div className="flex items-center gap-2">
                <span className="text-red-500 text-xs font-bold animate-pulse">
                  LIVE
                </span>
                <div className="text-right">
                  <p className="text-white font-bold">{game.away_score}</p>
                  <p className="text-white font-bold">{game.home_score}</p>
                </div>
              </div>
            ) : (
              <p className="text-gray-400 text-xs">
                {startTime.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
                <br />
                {startTime.toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>
        </div>
      </Link>

      {/* Odds row */}
      <div className="px-4 pb-3">
        <div className="grid grid-cols-6 gap-1.5">
          {/* Spread */}
          {spread ? (
            <>
              <OddsButton
                label={`${spread.line! > 0 ? "+" : ""}${spread.line}`}
                odds={spread.home_odds}
                onClick={() => onSelectBet(game, spread, "home")}
              />
              <OddsButton
                label={`${-spread.line! > 0 ? "+" : ""}${-spread.line!}`}
                odds={spread.away_odds}
                onClick={() => onSelectBet(game, spread, "away")}
              />
            </>
          ) : (
            <div className="col-span-2" />
          )}

          {/* Total */}
          {total ? (
            <>
              <OddsButton
                label={`O ${total.line}`}
                odds={total.over_odds!}
                onClick={() => onSelectBet(game, total, "over")}
              />
              <OddsButton
                label={`U ${total.line}`}
                odds={total.under_odds!}
                onClick={() => onSelectBet(game, total, "under")}
              />
            </>
          ) : (
            <div className="col-span-2" />
          )}

          {/* Moneyline */}
          {moneyline ? (
            <>
              <OddsButton
                label="ML"
                odds={moneyline.home_odds}
                onClick={() => onSelectBet(game, moneyline, "home")}
              />
              <OddsButton
                label="ML"
                odds={moneyline.away_odds}
                onClick={() => onSelectBet(game, moneyline, "away")}
              />
            </>
          ) : (
            <div className="col-span-2" />
          )}
        </div>
      </div>
    </div>
  );
}
