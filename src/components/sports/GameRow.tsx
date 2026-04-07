"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { Game, Market } from "@/lib/types";
import { isOutrightSport } from "@/lib/types";
import { formatOdds } from "@/lib/odds";
import { formatGameTime } from "@/lib/time";
import OddsCell from "./OddsCell";
import TeamLogo from "@/components/icons/TeamLogo";
import { createClient } from "@/lib/supabase/client";
import { useBetSlip } from "@/components/betslip/BetSlipContext";

interface GameRowProps {
  game: Game;
  markets: Market[];
  onSelectBet: (game: Game, market: Market, pick: string) => void;
}

export default function GameRow({ game, markets, onSelectBet }: GameRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [liveMarkets, setLiveMarkets] = useState(markets);
  const supabase = createClient();
  const { isSelected, toggleSelection } = useBetSlip();

  useEffect(() => {
    setLiveMarkets(markets);
  }, [markets]);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const refreshMarkets = useCallback(async () => {
    const { data } = await supabase
      .from("markets")
      .select("*")
      .eq("game_id", game.id);
    if (data) setLiveMarkets(data);
  }, [game.id]);

  useEffect(() => {
    if (!isVisible) return;
    const interval = game.status === "live" ? 10000 : 60000;
    const timer = setInterval(refreshMarkets, interval);
    return () => clearInterval(timer);
  }, [isVisible, game.status, refreshMarkets]);

  const isOutright = isOutrightSport(game.sport);
  const moneyline = liveMarkets.find((m) => m.type === "moneyline");
  const spread = liveMarkets.find((m) => m.type === "spread");
  const total = liveMarkets.find((m) => m.type === "over_under");
  const outrightMarkets = liveMarkets.filter((m) => m.type === "outright");
  const totalMarketCount = liveMarkets.length;

  const isLive = game.status === "live";
  const timeStr = formatGameTime(game.start_time);

  function handleToggle(market: Market, pick: string) {
    toggleSelection({ game, market, pick });
  }

  // Outright card
  if (isOutright) {
    const topPicks = outrightMarkets
      .sort((a, b) => {
        if (a.home_odds > 0 && b.home_odds > 0)
          return a.home_odds - b.home_odds;
        if (a.home_odds < 0 && b.home_odds < 0)
          return b.home_odds - a.home_odds;
        return a.home_odds < 0 ? -1 : 1;
      })
      .slice(0, 6);

    return (
      <div ref={rowRef} className="bg-[var(--bg-secondary)] rounded-lg overflow-hidden">
        <Link
          href={`/sports/${game.sport}/${game.id}`}
          className="block px-4 py-3 hover:bg-[var(--bg-button)] transition-colors"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base text-white font-semibold">
                {game.home_team}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {outrightMarkets.length} outcomes
              </p>
            </div>
            <span className="text-xs text-[var(--accent-green)] font-bold bg-[var(--bg-button)] px-2.5 py-1 rounded">
              FUTURES
            </span>
          </div>
        </Link>
        {topPicks.length > 0 && (
          <div className="px-3 pb-3 grid grid-cols-2 md:grid-cols-3 gap-1.5">
            {topPicks.map((m) => {
              const sel = isSelected(m.id, m.name);
              return (
                <button
                  key={m.id}
                  onClick={() => handleToggle(m, m.name)}
                  className={`rounded-md px-3 py-2 flex items-center justify-between transition-all ${
                    sel
                      ? "bg-[var(--accent-green)] text-black"
                      : "bg-[var(--bg-button)] hover:bg-[var(--bg-button-hover)]"
                  }`}
                >
                  <span
                    className={`text-sm truncate mr-2 ${sel ? "text-black" : "text-[var(--text-secondary)]"}`}
                  >
                    {m.name}
                  </span>
                  <span
                    className={`text-sm font-bold whitespace-nowrap ${sel ? "text-black" : "text-white"}`}
                  >
                    {formatOdds(m.home_odds)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {outrightMarkets.length > 6 && (
          <Link
            href={`/sports/${game.sport}/${game.id}`}
            className="block text-center text-sm text-[var(--accent-green)] hover:text-[var(--accent-green)]/80 pb-3 font-medium"
          >
            View all {outrightMarkets.length} outcomes →
          </Link>
        )}
      </div>
    );
  }

  // Standard game row
  return (
    <div ref={rowRef} className="bg-[var(--bg-secondary)] rounded-lg overflow-hidden">
      <div className="grid grid-cols-[minmax(0,1fr)_repeat(3,72px)] md:grid-cols-[minmax(0,1fr)_repeat(3,96px)] gap-1 items-stretch">
        {/* Away team row */}
        <Link
          href={`/sports/${game.sport}/${game.id}`}
          className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--bg-button)] transition-colors"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              {isLive &&
              game.away_score !== undefined &&
              game.away_score !== null ? (
                <span className="text-base text-white font-bold w-6 text-right">
                  {game.away_score}
                </span>
              ) : !isLive ? (
                <span className="text-xs text-[var(--text-muted)] w-16 shrink-0">
                  {timeStr}
                </span>
              ) : null}
              <TeamLogo teamName={game.away_team} sport={game.sport} className="w-5 h-5 shrink-0" />
              <span className="text-base text-white truncate">
                {game.away_team}
              </span>
            </div>
          </div>
          {/* +N more markets indicator */}
          {totalMarketCount > 3 && (
            <span className="text-xs text-[var(--accent-green)] font-medium shrink-0">
              +{totalMarketCount - 3}
            </span>
          )}
        </Link>

        {/* Away spread */}
        {spread ? (
          <OddsCell
            label={`${-spread.line! > 0 ? "+" : ""}${-spread.line!}`}
            odds={spread.away_odds}
            isSelected={isSelected(spread.id, "away")}
            onClick={() => handleToggle(spread, "away")}
          />
        ) : (
          <div />
        )}

        {/* Over */}
        {total ? (
          <OddsCell
            label={`O ${total.line}`}
            odds={total.over_odds!}
            isSelected={isSelected(total.id, "over")}
            onClick={() => handleToggle(total, "over")}
          />
        ) : (
          <div />
        )}

        {/* Away ML */}
        {moneyline ? (
          <OddsCell
            odds={moneyline.away_odds}
            isSelected={isSelected(moneyline.id, "away")}
            onClick={() => handleToggle(moneyline, "away")}
          />
        ) : (
          <div />
        )}

        {/* Home team row */}
        <Link
          href={`/sports/${game.sport}/${game.id}`}
          className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--bg-button)] transition-colors"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              {isLive &&
              game.home_score !== undefined &&
              game.home_score !== null ? (
                <span className="text-base text-white font-bold w-6 text-right">
                  {game.home_score}
                </span>
              ) : !isLive ? (
                <span className="w-16 shrink-0" />
              ) : null}
              <TeamLogo teamName={game.home_team} sport={game.sport} className="w-5 h-5 shrink-0" />
              <span className="text-base text-white truncate">
                {game.home_team}
              </span>
            </div>
          </div>
          {isLive && (
            <span className="text-xs text-red-500 font-bold animate-pulse shrink-0">
              LIVE
            </span>
          )}
        </Link>

        {/* Home spread */}
        {spread ? (
          <OddsCell
            label={`${spread.line! > 0 ? "+" : ""}${spread.line}`}
            odds={spread.home_odds}
            isSelected={isSelected(spread.id, "home")}
            onClick={() => handleToggle(spread, "home")}
          />
        ) : (
          <div />
        )}

        {/* Under */}
        {total ? (
          <OddsCell
            label={`U ${total.line}`}
            odds={total.under_odds!}
            isSelected={isSelected(total.id, "under")}
            onClick={() => handleToggle(total, "under")}
          />
        ) : (
          <div />
        )}

        {/* Home ML */}
        {moneyline ? (
          <OddsCell
            odds={moneyline.home_odds}
            isSelected={isSelected(moneyline.id, "home")}
            onClick={() => handleToggle(moneyline, "home")}
          />
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}
