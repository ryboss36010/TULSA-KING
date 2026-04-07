"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { Game, Market } from "@/lib/types";
import { isOutrightSport } from "@/lib/types";
import { formatOdds } from "@/lib/odds";
import OddsCell from "./OddsCell";
import { createClient } from "@/lib/supabase/client";

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

  // Update markets when prop changes
  useEffect(() => {
    setLiveMarkets(markets);
  }, [markets]);

  // IntersectionObserver: track visibility
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

  // Poll for fresh odds when visible
  const refreshMarkets = useCallback(async () => {
    const { data } = await supabase
      .from("markets")
      .select("*")
      .eq("game_id", game.id);
    if (data) setLiveMarkets(data);
  }, [game.id]);

  useEffect(() => {
    if (!isVisible) return;
    // Live games: refresh every 10s. Upcoming: every 60s
    const interval = game.status === "live" ? 10000 : 60000;
    const timer = setInterval(refreshMarkets, interval);
    return () => clearInterval(timer);
  }, [isVisible, game.status, refreshMarkets]);

  const isOutright = isOutrightSport(game.sport);
  const moneyline = liveMarkets.find((m) => m.type === "moneyline");
  const spread = liveMarkets.find((m) => m.type === "spread");
  const total = liveMarkets.find((m) => m.type === "over_under");
  const outrightMarkets = liveMarkets.filter((m) => m.type === "outright");

  const startTime = new Date(game.start_time);
  const isLive = game.status === "live";

  const timeStr = startTime.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  // Outright card
  if (isOutright) {
    const topPicks = outrightMarkets
      .sort((a, b) => {
        if (a.home_odds > 0 && b.home_odds > 0) return a.home_odds - b.home_odds;
        if (a.home_odds < 0 && b.home_odds < 0) return b.home_odds - a.home_odds;
        return a.home_odds < 0 ? -1 : 1;
      })
      .slice(0, 4);

    return (
      <Link
        href={`/sports/${game.sport}/${game.id}`}
        ref={rowRef as any}
        className="block bg-[var(--bg-secondary)] rounded hover:bg-[var(--bg-button)] transition-colors"
      >
        <div className="px-3 py-2 flex items-center justify-between">
          <div>
            <p className="text-sm text-white font-medium">{game.home_team}</p>
            <p className="text-[10px] text-[var(--text-muted)]">
              {outrightMarkets.length} outcomes
            </p>
          </div>
          <span className="text-[10px] text-[var(--accent-green)] font-semibold">
            FUTURES
          </span>
        </div>
        {topPicks.length > 0 && (
          <div className="px-3 pb-2 grid grid-cols-2 gap-1">
            {topPicks.map((m) => (
              <div
                key={m.id}
                className="bg-[var(--bg-button)] rounded-sm px-2 py-1 flex items-center justify-between"
              >
                <span className="text-[11px] text-[var(--text-secondary)] truncate mr-2">
                  {m.name}
                </span>
                <span className="text-xs text-white font-semibold whitespace-nowrap">
                  {formatOdds(m.home_odds)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Link>
    );
  }

  // Standard game row — Stake-style compact
  return (
    <div ref={rowRef} className="bg-[var(--bg-secondary)] rounded overflow-hidden">
      <Link
        href={`/sports/${game.sport}/${game.id}`}
        className="block hover:bg-[var(--bg-button)] transition-colors"
      >
        {/* Game info + odds grid */}
        <div className="grid grid-cols-[minmax(0,1fr)_repeat(3,64px)] md:grid-cols-[minmax(0,1fr)_repeat(3,80px)] gap-0.5 items-stretch">
          {/* Away team row */}
          <div className="flex items-center gap-2 px-3 py-1.5">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {isLive && !game.away_score && !game.home_score ? null : isLive ? (
                  <span className="text-sm text-white font-bold w-5 text-right">
                    {game.away_score}
                  </span>
                ) : (
                  <span className="text-[10px] text-[var(--text-muted)] w-10">
                    {timeStr}
                  </span>
                )}
                <span className="text-sm text-white truncate">{game.away_team}</span>
              </div>
            </div>
          </div>

          {/* Away spread */}
          {spread ? (
            <OddsCell
              label={`${-spread.line! > 0 ? "+" : ""}${-spread.line!}`}
              odds={spread.away_odds}
              onClick={() => onSelectBet(game, spread, "away")}
            />
          ) : (
            <div />
          )}

          {/* Away total (Over) */}
          {total ? (
            <OddsCell
              label={`O ${total.line}`}
              odds={total.over_odds!}
              onClick={() => onSelectBet(game, total, "over")}
            />
          ) : (
            <div />
          )}

          {/* Away moneyline */}
          {moneyline ? (
            <OddsCell
              odds={moneyline.away_odds}
              onClick={() => onSelectBet(game, moneyline, "away")}
            />
          ) : (
            <div />
          )}

          {/* Home team row */}
          <div className="flex items-center gap-2 px-3 py-1.5">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {isLive && !game.away_score && !game.home_score ? null : isLive ? (
                  <span className="text-sm text-white font-bold w-5 text-right">
                    {game.home_score}
                  </span>
                ) : (
                  <span className="w-10" />
                )}
                <span className="text-sm text-white truncate">{game.home_team}</span>
              </div>
            </div>
            {isLive && (
              <span className="text-[10px] text-red-500 font-bold animate-pulse">
                LIVE
              </span>
            )}
          </div>

          {/* Home spread */}
          {spread ? (
            <OddsCell
              label={`${spread.line! > 0 ? "+" : ""}${spread.line}`}
              odds={spread.home_odds}
              onClick={() => onSelectBet(game, spread, "home")}
            />
          ) : (
            <div />
          )}

          {/* Home total (Under) */}
          {total ? (
            <OddsCell
              label={`U ${total.line}`}
              odds={total.under_odds!}
              onClick={() => onSelectBet(game, total, "under")}
            />
          ) : (
            <div />
          )}

          {/* Home moneyline */}
          {moneyline ? (
            <OddsCell
              odds={moneyline.home_odds}
              onClick={() => onSelectBet(game, moneyline, "home")}
            />
          ) : (
            <div />
          )}
        </div>
      </Link>
    </div>
  );
}
