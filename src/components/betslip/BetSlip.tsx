"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useBetSlip } from "./BetSlipContext";
import SwipeToConfirm from "./SwipeToConfirm";
import { formatOdds, calculatePayout } from "@/lib/odds";
import { createClient } from "@/lib/supabase/client";

function getOddsForPick(market: { home_odds: number; away_odds: number; over_odds?: number | null; under_odds?: number | null }, pick: string): number {
  if (pick === "home") return market.home_odds;
  if (pick === "away") return market.away_odds;
  if (pick === "over") return market.over_odds ?? market.home_odds;
  if (pick === "under") return market.under_odds ?? market.away_odds;
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
          className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-40 bg-green-600 text-white py-3 px-4 rounded-xl font-semibold flex justify-between items-center shadow-lg"
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
            className="fixed inset-x-0 bottom-0 md:right-0 md:left-auto md:w-96 md:top-16 z-50 bg-gray-900 border-t md:border-l border-gray-800 flex flex-col max-h-[80vh] md:max-h-full rounded-t-2xl md:rounded-none"
          >
            {/* Header */}
            <div className="flex justify-between items-center px-4 py-3 border-b border-gray-800">
              <h3 className="text-white font-bold">
                Bet Slip ({selections.length})
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>

            {/* Selections */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selections.map((sel, i) => {
                const odds = getOddsForPick(sel.market, sel.pick);
                const payout =
                  sel.wager > 0 ? calculatePayout(sel.wager, odds) : 0;

                return (
                  <div
                    key={i}
                    className="bg-gray-800 rounded-lg p-3 space-y-2"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-white text-sm font-medium">
                          {sel.game.away_team} @ {sel.game.home_team}
                        </p>
                        <p className="text-gray-400 text-xs">
                          {sel.market.name} · {sel.pick.toUpperCase()} ·{" "}
                          {formatOdds(odds)}
                        </p>
                      </div>
                      <button
                        onClick={() => removeSelection(i)}
                        className="text-gray-500 hover:text-red-400 text-sm"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
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
                          className="w-full pl-7 pr-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-green-500 focus:outline-none"
                        />
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400">Payout</p>
                        <p className="text-green-400 font-bold text-sm">
                          ${payout.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Swipe to confirm */}
            <div className="p-4 border-t border-gray-800 flex flex-col items-center gap-3">
              <div className="text-center">
                <p className="text-gray-400 text-xs">Total Wager</p>
                <p className="text-white text-lg font-bold">
                  ${totalWager.toFixed(2)}
                </p>
              </div>

              {/* Mobile: swipe */}
              <div className="md:hidden">
                <SwipeToConfirm
                  onConfirm={handleConfirm}
                  disabled={!allValid}
                />
              </div>

              {/* Desktop: button */}
              <button
                onClick={handleConfirm}
                disabled={!allValid}
                className="hidden md:block w-full py-3 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg transition disabled:opacity-50"
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
