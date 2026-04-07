"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useBetSlip } from "./BetSlipContext";
import SwipeToConfirm from "./SwipeToConfirm";
import {
  formatOdds,
  calculatePayout,
  calculateParlayOdds,
  calculateParlayPayout,
} from "@/lib/odds";
import { createClient } from "@/lib/supabase/client";

const QUICK_AMOUNTS = [5, 10, 25, 50, 100];

function getOddsForPick(
  market: {
    type?: string;
    home_odds: number;
    away_odds: number;
    over_odds?: number | null;
    under_odds?: number | null;
  },
  pick: string
): number {
  if (pick === "home") return market.home_odds;
  if (pick === "away") return market.away_odds;
  if (pick === "over") return market.over_odds ?? market.home_odds;
  if (pick === "under") return market.under_odds ?? market.away_odds;
  if (market.type === "outright") return market.home_odds;
  return market.home_odds;
}

function getPickLabel(
  game: { home_team: string; away_team: string },
  market: { type?: string; name: string; line?: number | null },
  pick: string
): string {
  if (market.type === "outright") return `${pick} to win`;
  if (market.type === "over_under") {
    return pick === "over" ? `Over ${market.line}` : `Under ${market.line}`;
  }
  if (pick === "home") return game.home_team;
  if (pick === "away") return game.away_team;
  return pick;
}

export default function BetSlip() {
  const {
    selections,
    removeSelection,
    updateWager,
    clearSlip,
    isOpen,
    setIsOpen,
    mode,
    setMode,
    parlayWager,
    setParlayWager,
  } = useBetSlip();
  const supabase = createClient();

  async function handleConfirm() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id")
      .neq("id", user.id);

    if (!profiles || profiles.length < 2) return;

    if (mode === "parlay" && selections.length >= 2) {
      // Place parlay as a single bet group
      const parlayOdds = calculateParlayOdds(
        selections.map((s) => getOddsForPick(s.market, s.pick))
      );

      // Store parlay as individual bets linked by a parlay_group_id
      const parlayGroupId = crypto.randomUUID();

      for (const sel of selections) {
        const { data: bet } = await supabase
          .from("bets")
          .insert({
            user_id: user.id,
            game_id: sel.game.id,
            market_id: sel.market.id,
            pick: sel.pick,
            wager_amount: parlayWager,
            odds_at_placement: getOddsForPick(sel.market, sel.pick),
            status: "active",
            parlay_group_id: parlayGroupId,
          })
          .select()
          .single();

        if (!bet) continue;

        const shareAmount = parlayWager / 2;
        const counterparties = profiles.map((p) => ({
          bet_id: bet.id,
          user_id: p.id,
          share_amount: shareAmount,
        }));

        await supabase.from("bet_counterparties").insert(counterparties);
      }

      await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          betId: parlayGroupId,
          type: "new_parlay",
          legs: selections.length,
          odds: parlayOdds,
          wager: parlayWager,
        }),
      });
    } else {
      // Place individual singles
      for (const sel of selections) {
        if (sel.wager <= 0) continue;

        const { data: bet } = await supabase
          .from("bets")
          .insert({
            user_id: user.id,
            game_id: sel.game.id,
            market_id: sel.market.id,
            pick: sel.pick,
            wager_amount: sel.wager,
            odds_at_placement: getOddsForPick(sel.market, sel.pick),
            status: "active",
          })
          .select()
          .single();

        if (!bet) continue;

        const shareAmount = sel.wager / 2;
        const counterparties = profiles.map((p) => ({
          bet_id: bet.id,
          user_id: p.id,
          share_amount: shareAmount,
        }));

        await supabase.from("bet_counterparties").insert(counterparties);

        await fetch("/api/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ betId: bet.id, type: "new_bet" }),
        });
      }
    }

    clearSlip();
  }

  const isParlay = mode === "parlay" && selections.length >= 2;
  const parlayLegs = selections.map((s) => getOddsForPick(s.market, s.pick));
  const parlayOdds = isParlay ? calculateParlayOdds(parlayLegs) : 0;
  const parlayPayout = isParlay
    ? calculateParlayPayout(parlayWager, parlayLegs)
    : 0;

  const singlesTotalWager = selections.reduce(
    (sum, s) => sum + (s.wager || 0),
    0
  );
  const singlesTotalPayout = selections.reduce((sum, s) => {
    const odds = getOddsForPick(s.market, s.pick);
    return sum + (s.wager > 0 ? calculatePayout(s.wager, odds) : 0);
  }, 0);

  const totalWager = isParlay ? parlayWager : singlesTotalWager;
  const totalPayout = isParlay ? parlayPayout : singlesTotalPayout;
  const allValid = isParlay
    ? parlayWager > 0
    : selections.every((s) => s.wager > 0);

  return (
    <>
      {/* Collapsed tab */}
      {selections.length > 0 && !isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-16 md:bottom-4 left-3 right-3 md:left-auto md:right-4 md:w-80 z-40 bg-[var(--accent-green)] text-black py-3 px-4 rounded-xl font-bold flex justify-between items-center shadow-lg"
        >
          <div className="flex items-center gap-2">
            <span className="bg-black/20 w-6 h-6 rounded-full flex items-center justify-center text-sm">
              {selections.length}
            </span>
            <span>Bet Slip</span>
          </div>
          <span>${totalWager.toFixed(2)}</span>
        </button>
      )}

      {/* Expanded panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 md:right-0 md:left-auto md:w-[380px] md:top-14 z-50 bg-[var(--bg-primary)] border-t md:border-l border-[var(--border)] flex flex-col max-h-[85vh] md:max-h-full rounded-t-2xl md:rounded-none"
          >
            {/* Header */}
            <div className="flex justify-between items-center px-4 py-3 border-b border-[var(--border)]">
              <h3 className="text-white font-bold">
                Bet Slip
                <span className="ml-2 bg-[var(--accent-green)] text-black text-xs font-bold px-2 py-0.5 rounded-full">
                  {selections.length}
                </span>
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={clearSlip}
                  className="text-xs text-[var(--text-muted)] hover:text-red-400 transition"
                >
                  Clear All
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-[var(--text-muted)] hover:text-white p-1"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Mode tabs */}
            <div className="flex bg-[var(--bg-secondary)] mx-3 mt-3 rounded-lg p-1">
              <button
                onClick={() => setMode("single")}
                className={`flex-1 py-2 text-sm font-semibold rounded-md transition ${
                  mode === "single"
                    ? "bg-[var(--bg-button)] text-white"
                    : "text-[var(--text-muted)] hover:text-white"
                }`}
              >
                Single{selections.length > 0 ? ` (${selections.length})` : ""}
              </button>
              <button
                onClick={() => setMode("parlay")}
                disabled={selections.length < 2}
                className={`flex-1 py-2 text-sm font-semibold rounded-md transition ${
                  mode === "parlay"
                    ? "bg-[var(--bg-button)] text-white"
                    : "text-[var(--text-muted)] hover:text-white"
                } ${selections.length < 2 ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                Parlay
                {isParlay && (
                  <span className="ml-1 text-[var(--accent-green)]">
                    {formatOdds(parlayOdds)}
                  </span>
                )}
              </button>
            </div>

            {/* Selections */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
              {selections.map((sel, i) => {
                const odds = getOddsForPick(sel.market, sel.pick);
                const payout =
                  sel.wager > 0 ? calculatePayout(sel.wager, odds) : 0;
                const pickLabel = getPickLabel(sel.game, sel.market, sel.pick);

                return (
                  <div
                    key={`${sel.market.id}-${sel.pick}`}
                    className="bg-[var(--bg-secondary)] rounded-lg p-3 space-y-2"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-semibold truncate">
                          {pickLabel}
                        </p>
                        <p className="text-[var(--text-muted)] text-xs mt-0.5 truncate">
                          {sel.market.type === "outright"
                            ? sel.game.home_team
                            : sel.game.away_team
                              ? `${sel.game.away_team} vs ${sel.game.home_team}`
                              : sel.game.home_team}
                          {sel.market.type !== "outright" && (
                            <span className="text-[var(--text-muted)]">
                              {" "}
                              &middot; {sel.market.name}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[var(--accent-green)] font-bold text-sm">
                          {formatOdds(odds)}
                        </span>
                        <button
                          onClick={() => removeSelection(i)}
                          className="text-[var(--text-muted)] hover:text-red-400 p-0.5"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Individual wager input (singles mode only) */}
                    {mode === "single" && (
                      <div className="space-y-2">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-sm font-medium">
                            $
                          </span>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            placeholder="0.00"
                            value={sel.wager || ""}
                            onChange={(e) =>
                              updateWager(
                                i,
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-full pl-7 pr-3 py-2.5 bg-[var(--bg-button)] text-white rounded-lg border border-[var(--border)] focus:border-[var(--accent-green)] focus:outline-none text-sm font-medium"
                          />
                        </div>
                        {/* Quick amounts */}
                        <div className="flex gap-1">
                          {QUICK_AMOUNTS.map((amt) => (
                            <button
                              key={amt}
                              onClick={() => updateWager(i, amt)}
                              className="flex-1 py-1.5 text-xs font-medium bg-[var(--bg-button)] hover:bg-[var(--bg-button-hover)] text-[var(--text-secondary)] rounded transition"
                            >
                              ${amt}
                            </button>
                          ))}
                        </div>
                        {sel.wager > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-[var(--text-muted)]">
                              Potential Payout
                            </span>
                            <span className="text-[var(--accent-green)] font-bold">
                              ${payout.toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Parlay wager input (parlay mode) */}
            {isParlay && (
              <div className="px-3 py-3 border-t border-[var(--border)] space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[var(--text-secondary)] font-medium">
                    {selections.length}-Leg Parlay
                  </span>
                  <span className="text-[var(--accent-green)] font-bold">
                    {formatOdds(parlayOdds)}
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-sm font-medium">
                    $
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Wager amount"
                    value={parlayWager || ""}
                    onChange={(e) =>
                      setParlayWager(parseFloat(e.target.value) || 0)
                    }
                    className="w-full pl-7 pr-3 py-2.5 bg-[var(--bg-button)] text-white rounded-lg border border-[var(--border)] focus:border-[var(--accent-green)] focus:outline-none text-sm font-medium"
                  />
                </div>
                {/* Quick amounts */}
                <div className="flex gap-1">
                  {QUICK_AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setParlayWager(amt)}
                      className="flex-1 py-1.5 text-xs font-medium bg-[var(--bg-button)] hover:bg-[var(--bg-button-hover)] text-[var(--text-secondary)] rounded transition"
                    >
                      ${amt}
                    </button>
                  ))}
                </div>
                {parlayWager > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--text-muted)]">
                      Potential Payout
                    </span>
                    <span className="text-[var(--accent-green)] font-bold text-lg">
                      ${parlayPayout.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Confirm */}
            <div className="p-3 border-t border-[var(--border)]">
              {/* Summary */}
              {!isParlay && selections.length > 0 && singlesTotalWager > 0 && (
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <p className="text-xs text-[var(--text-muted)]">
                      Total Stake
                    </p>
                    <p className="text-white font-bold">
                      ${singlesTotalWager.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[var(--text-muted)]">
                      Total Payout
                    </p>
                    <p className="text-[var(--accent-green)] font-bold">
                      ${singlesTotalPayout.toFixed(2)}
                    </p>
                  </div>
                </div>
              )}

              <div className="md:hidden">
                <SwipeToConfirm
                  onConfirm={handleConfirm}
                  disabled={!allValid}
                />
              </div>

              <button
                onClick={handleConfirm}
                disabled={!allValid}
                className="hidden md:block w-full py-3 bg-[var(--accent-green)] hover:brightness-110 text-black font-bold rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isParlay
                  ? `Place ${selections.length}-Leg Parlay — $${totalWager.toFixed(2)}`
                  : `Place Bet${selections.length > 1 ? "s" : ""} — $${totalWager.toFixed(2)}`}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
