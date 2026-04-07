"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useBetSlip } from "./BetSlipContext";
import SwipeToConfirm from "./SwipeToConfirm";
import { formatOdds, calculatePayout } from "@/lib/odds";
import { createClient } from "@/lib/supabase/client";

function getOddsForPick(market: { type?: string; home_odds: number; away_odds: number; over_odds?: number | null; under_odds?: number | null }, pick: string): number {
  if (pick === "home") return market.home_odds;
  if (pick === "away") return market.away_odds;
  if (pick === "over") return market.over_odds ?? market.home_odds;
  if (pick === "under") return market.under_odds ?? market.away_odds;
  if (market.type === "outright") return market.home_odds;
  return market.home_odds;
}

export default function BetSlip() {
  const {
    selections,
    removeSelection,
    updateWager,
    clearSlip,
    isOpen,
    setIsOpen,
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

    for (const sel of selections) {
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

    clearSlip();
  }

  const totalWager = selections.reduce((sum, s) => sum + (s.wager || 0), 0);
  const allValid = selections.every((s) => s.wager > 0);

  return (
    <>
      {/* Collapsed tab */}
      {selections.length > 0 && !isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-16 md:bottom-4 left-3 right-3 md:left-auto md:right-4 md:w-80 z-40 bg-[var(--accent-green)] text-black py-2.5 px-4 rounded-lg font-bold flex justify-between items-center shadow-lg text-sm"
        >
          <span>Bet Slip ({selections.length})</span>
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
            className="fixed inset-x-0 bottom-0 md:right-0 md:left-auto md:w-96 md:top-14 z-50 bg-[var(--bg-secondary)] border-t md:border-l border-[var(--border)] flex flex-col max-h-[80vh] md:max-h-full rounded-t-2xl md:rounded-none"
          >
            {/* Header */}
            <div className="flex justify-between items-center px-4 py-3 border-b border-[var(--border)]">
              <h3 className="text-white font-bold text-sm">
                Bet Slip ({selections.length})
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-[var(--text-muted)] hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Selections */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {selections.map((sel, i) => {
                const odds = getOddsForPick(sel.market, sel.pick);
                const payout =
                  sel.wager > 0 ? calculatePayout(sel.wager, odds) : 0;

                return (
                  <div
                    key={i}
                    className="bg-[var(--bg-button)] rounded-lg p-3 space-y-2"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-white text-xs font-medium">
                          {sel.game.away_team
                            ? `${sel.game.away_team} @ ${sel.game.home_team}`
                            : sel.game.home_team}
                        </p>
                        <p className="text-[var(--text-muted)] text-[11px]">
                          {sel.market.type === "outright"
                            ? `${sel.pick} to win`
                            : `${sel.market.name} · ${sel.pick.toUpperCase()}`}{" "}
                          · <span className="text-[var(--accent-green)]">{formatOdds(odds)}</span>
                        </p>
                      </div>
                      <button
                        onClick={() => removeSelection(i)}
                        className="text-[var(--text-muted)] hover:text-red-400 text-xs ml-2"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-sm">
                          $
                        </span>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          placeholder="0"
                          value={sel.wager || ""}
                          onChange={(e) =>
                            updateWager(i, parseFloat(e.target.value) || 0)
                          }
                          className="w-full pl-7 pr-3 py-2 bg-[var(--bg-primary)] text-white rounded-lg border border-[var(--border)] focus:border-[var(--accent-green)] focus:outline-none text-sm"
                        />
                      </div>
                      <div className="text-right min-w-[60px]">
                        <p className="text-[10px] text-[var(--text-muted)]">Payout</p>
                        <p className="text-[var(--accent-green)] font-bold text-sm">
                          ${payout.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Confirm */}
            <div className="p-3 border-t border-[var(--border)] flex flex-col items-center gap-2">
              <div className="text-center">
                <p className="text-[var(--text-muted)] text-[10px]">Total Wager</p>
                <p className="text-white text-base font-bold">
                  ${totalWager.toFixed(2)}
                </p>
              </div>

              <div className="md:hidden w-full">
                <SwipeToConfirm
                  onConfirm={handleConfirm}
                  disabled={!allValid}
                />
              </div>

              <button
                onClick={handleConfirm}
                disabled={!allValid}
                className="hidden md:block w-full py-2.5 bg-[var(--accent-green)] hover:brightness-110 text-black font-bold rounded-lg transition disabled:opacity-50 text-sm"
              >
                Place Bet — ${totalWager.toFixed(2)}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
