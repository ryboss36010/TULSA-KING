"use client";

import type { Game, Market } from "@/lib/types";
import { formatOdds } from "@/lib/odds";
import { useBetSlip } from "@/components/betslip/BetSlipContext";

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
  const { isSelected } = useBetSlip();

  if (markets.length === 0) return null;

  const isOutright = markets[0]?.type === "outright";

  return (
    <div className="space-y-3">
      <h3 className="text-white font-bold text-base border-b border-[var(--border)] pb-2">
        {title}
      </h3>
      {isOutright ? (
        // Grid layout for outrights — 2 cols on mobile, 3 on tablet, 4 on desktop
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {markets.map((market) => {
            const selected = isSelected(market.id, market.name);
            return (
              <button
                key={market.id}
                onClick={() => onSelectBet(game, market, market.name)}
                className={`flex flex-col items-center justify-center rounded-lg px-3 py-3 text-center transition-colors ${
                  selected
                    ? "bg-[var(--accent-green)] text-black"
                    : "bg-[var(--bg-secondary)] hover:bg-[var(--bg-button)] text-white"
                }`}
              >
                <span
                  className={`text-sm font-medium leading-tight mb-1 line-clamp-2 ${
                    selected ? "text-black" : "text-[var(--text-secondary)]"
                  }`}
                >
                  {market.name}
                </span>
                <span
                  className={`text-base font-bold ${
                    selected ? "text-black" : "text-white"
                  }`}
                >
                  {formatOdds(market.home_odds)}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        // Standard 2-sided markets
        <div className="space-y-1.5">
          {markets.map((market) => (
            <div
              key={market.id}
              className="flex items-center justify-between bg-[var(--bg-secondary)] rounded-lg px-4 py-3"
            >
              <span className="text-[var(--text-secondary)] text-sm flex-1">
                {market.name}
              </span>
              <div className="flex gap-2">
                {market.type === "over_under" ? (
                  <>
                    <OddsBtn
                      label={`O ${market.line}`}
                      odds={market.over_odds!}
                      selected={isSelected(market.id, "over")}
                      onClick={() => onSelectBet(game, market, "over")}
                    />
                    <OddsBtn
                      label={`U ${market.line}`}
                      odds={market.under_odds!}
                      selected={isSelected(market.id, "under")}
                      onClick={() => onSelectBet(game, market, "under")}
                    />
                  </>
                ) : (
                  <>
                    <OddsBtn
                      label={game.home_team.split(" ").pop()!}
                      odds={market.home_odds}
                      selected={isSelected(market.id, "home")}
                      onClick={() => onSelectBet(game, market, "home")}
                    />
                    <OddsBtn
                      label={game.away_team.split(" ").pop()!}
                      odds={market.away_odds}
                      selected={isSelected(market.id, "away")}
                      onClick={() => onSelectBet(game, market, "away")}
                    />
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OddsBtn({
  label,
  odds,
  selected,
  onClick,
}: {
  label: string;
  odds: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center px-4 py-2 rounded-lg border transition-colors min-w-[72px] ${
        selected
          ? "bg-[var(--accent-green)] border-[var(--accent-green)] text-black"
          : "bg-[var(--bg-button)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]"
      }`}
    >
      <span
        className={`text-xs ${selected ? "text-black/70" : "text-[var(--text-muted)]"}`}
      >
        {label}
      </span>
      <span
        className={`text-sm font-bold ${selected ? "text-black" : "text-white"}`}
      >
        {formatOdds(odds)}
      </span>
    </button>
  );
}
