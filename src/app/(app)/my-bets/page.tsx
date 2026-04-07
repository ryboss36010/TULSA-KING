"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatOdds } from "@/lib/odds";
import type { BetWithDetails } from "@/lib/types";

type Filter = "all" | "active" | "settled";

export default function MyBetsPage() {
  const [bets, setBets] = useState<BetWithDetails[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("bets")
        .select(
          "*, game:games(*), market:markets(*), counterparties:bet_counterparties(*, profile:profiles(*)), placer:profiles!bets_user_id_fkey(*)"
        )
        .order("created_at", { ascending: false });

      if (data) setBets(data as unknown as BetWithDetails[]);
      setLoading(false);
    }

    load();
  }, []);

  const filtered =
    filter === "all"
      ? bets
      : bets.filter((b) =>
          filter === "active" ? b.status === "active" : b.status === "settled"
        );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 animate-pulse">Loading bets...</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">My Bets</h1>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["all", "active", "settled"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition ${
              filter === f
                ? "bg-green-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Bet list */}
      <div className="space-y-3">
        {filtered.map((bet) => (
          <div
            key={bet.id}
            className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-white font-medium text-sm">
                  {bet.game.away_team} @ {bet.game.home_team}
                </p>
                <p className="text-gray-400 text-xs">
                  {bet.market.name} · {bet.pick.toUpperCase()} ·{" "}
                  {formatOdds(bet.odds_at_placement)}
                </p>
              </div>
              <span
                className={`text-xs font-bold px-2 py-1 rounded ${
                  bet.status === "active"
                    ? "bg-yellow-500/20 text-yellow-400"
                    : bet.result === "win"
                      ? "bg-green-500/20 text-green-400"
                      : bet.result === "loss"
                        ? "bg-red-500/20 text-red-400"
                        : "bg-gray-500/20 text-gray-400"
                }`}
              >
                {bet.status === "active"
                  ? "ACTIVE"
                  : bet.result?.toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">
                Wager: ${bet.wager_amount}
              </span>
              <span className="text-gray-400">
                {bet.placer.display_name}
              </span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-gray-500 text-center py-8">No bets found</p>
        )}
      </div>
    </div>
  );
}
