"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { SPORT_LABELS } from "@/lib/types";
import { calculatePayout } from "@/lib/odds";

interface Stats {
  totalBets: number;
  wins: number;
  losses: number;
  pushes: number;
  winRate: number;
  totalWagered: number;
  totalProfit: number;
  roi: number;
  biggestWin: number;
  currentStreak: { type: "win" | "loss"; count: number };
  bySport: Record<string, { wins: number; losses: number; profit: number }>;
}

interface Bet {
  user_id: string;
  wager_amount: number;
  odds_at_placement: number;
  result: "win" | "loss" | "push";
  settled_at: string;
  game: { sport: string };
}

export default function DashboardPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [allBets, setAllBets] = useState<Bet[]>([]);
  const [userId, setUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("*");
      if (profilesData) setProfiles(profilesData);

      const { data: betsData } = await supabase
        .from("bets")
        .select("*, game:games(*), counterparties:bet_counterparties(*)")
        .eq("status", "settled")
        .order("settled_at", { ascending: false });

      if (betsData) setAllBets(betsData as Bet[]);
      setLoading(false);
    }

    load();
  }, []);

  function calculateStats(uid: string): Stats {
    const userBets = allBets.filter((b) => b.user_id === uid);
    const wins = userBets.filter((b) => b.result === "win");
    const losses = userBets.filter((b) => b.result === "loss");
    const pushes = userBets.filter((b) => b.result === "push");

    const totalWagered = userBets.reduce(
      (sum, b) => sum + Number(b.wager_amount),
      0
    );

    let totalProfit = 0;
    let biggestWin = 0;
    for (const bet of userBets) {
      if (bet.result === "win") {
        const profit = calculatePayout(bet.wager_amount, bet.odds_at_placement) - bet.wager_amount;
        totalProfit += profit;
        if (profit > biggestWin) biggestWin = profit;
      } else if (bet.result === "loss") {
        totalProfit -= bet.wager_amount;
      }
    }

    let streakType: "win" | "loss" = "win";
    let streakCount = 0;
    for (const bet of userBets) {
      if (bet.result === "push") continue;
      if (streakCount === 0) {
        streakType = bet.result;
        streakCount = 1;
      } else if (bet.result === streakType) {
        streakCount++;
      } else {
        break;
      }
    }

    const bySport: Record<string, { wins: number; losses: number; profit: number }> = {};
    for (const bet of userBets) {
      const sport = bet.game.sport;
      if (!bySport[sport]) bySport[sport] = { wins: 0, losses: 0, profit: 0 };
      if (bet.result === "win") {
        bySport[sport].wins++;
        bySport[sport].profit += calculatePayout(bet.wager_amount, bet.odds_at_placement) - bet.wager_amount;
      } else if (bet.result === "loss") {
        bySport[sport].losses++;
        bySport[sport].profit -= bet.wager_amount;
      }
    }

    return {
      totalBets: userBets.length,
      wins: wins.length,
      losses: losses.length,
      pushes: pushes.length,
      winRate: userBets.length > 0 ? (wins.length / userBets.length) * 100 : 0,
      totalWagered,
      totalProfit,
      roi: totalWagered > 0 ? (totalProfit / totalWagered) * 100 : 0,
      biggestWin,
      currentStreak: { type: streakType, count: streakCount },
      bySport,
    };
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[var(--text-muted)] animate-pulse text-lg">Loading stats...</div>
      </div>
    );
  }

  const leaderboard = profiles
    .map((p) => ({ profile: p, stats: calculateStats(p.id) }))
    .sort((a, b) => b.stats.totalProfit - a.stats.totalProfit);

  const myStats = calculateStats(userId);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-10">
      <h1 className="text-3xl font-bold text-white">Dashboard</h1>

      {/* Leaderboard — clear ranking with large numbers */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">Leaderboard</h2>
        <div className="space-y-3">
          {leaderboard.map((entry, i) => {
            const isYou = entry.profile.id === userId;
            const profit = entry.stats.totalProfit;
            return (
              <div
                key={entry.profile.id}
                className={`flex items-center justify-between rounded-2xl px-6 py-5 ${
                  isYou
                    ? "bg-[var(--accent-green)]/10 border-2 border-[var(--accent-green)]"
                    : "bg-[var(--bg-secondary)] border border-[var(--border)]"
                }`}
              >
                <div className="flex items-center gap-4">
                  <span className={`text-3xl font-black ${
                    i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-300" : "text-amber-600"
                  }`}>
                    #{i + 1}
                  </span>
                  <div>
                    <p className="text-white text-lg font-semibold">
                      {entry.profile.display_name}
                      {isYou && <span className="text-[var(--accent-green)] text-sm ml-2">(You)</span>}
                    </p>
                    <p className="text-[var(--text-muted)] text-base">
                      {entry.stats.wins} Wins &middot; {entry.stats.losses} Losses
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-bold ${
                    profit >= 0 ? "text-green-400" : "text-red-400"
                  }`}>
                    {profit >= 0 ? "+" : ""}${profit.toFixed(2)}
                  </p>
                  <p className="text-[var(--text-muted)] text-sm">
                    {entry.stats.winRate.toFixed(0)}% win rate
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Your Performance — large, clear cards */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">Your Performance</h2>

        {/* Hero stat: Profit/Loss — biggest, most prominent */}
        <div className={`rounded-2xl px-6 py-6 text-center ${
          myStats.totalProfit >= 0
            ? "bg-green-500/10 border border-green-500/30"
            : "bg-red-500/10 border border-red-500/30"
        }`}>
          <p className="text-[var(--text-muted)] text-base mb-1">Total Profit / Loss</p>
          <p className={`text-4xl font-black ${
            myStats.totalProfit >= 0 ? "text-green-400" : "text-red-400"
          }`}>
            {myStats.totalProfit >= 0 ? "+" : ""}${myStats.totalProfit.toFixed(2)}
          </p>
          <p className="text-[var(--text-muted)] text-base mt-2">
            on ${myStats.totalWagered.toFixed(2)} wagered &middot; {myStats.roi.toFixed(1)}% ROI
          </p>
        </div>

        {/* Key stats in a 2-column grid with generous sizing */}
        <div className="grid grid-cols-2 gap-4">
          <StatCard
            label="Record"
            value={`${myStats.wins}W - ${myStats.losses}L`}
            detail={myStats.pushes > 0 ? `${myStats.pushes} pushes` : undefined}
          />
          <StatCard
            label="Win Rate"
            value={`${myStats.winRate.toFixed(0)}%`}
            detail={`${myStats.totalBets} total bets`}
          />
          <StatCard
            label="Biggest Win"
            value={`$${myStats.biggestWin.toFixed(2)}`}
            color="green"
          />
          <StatCard
            label="Current Streak"
            value={`${myStats.currentStreak.count} ${myStats.currentStreak.type === "win" ? "Wins" : "Losses"}`}
            color={myStats.currentStreak.type === "win" ? "green" : "red"}
          />
        </div>
      </section>

      {/* Sport Breakdown — clear rows with visual indicators */}
      {Object.keys(myStats.bySport).length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white">By Sport</h2>
          <div className="space-y-3">
            {Object.entries(myStats.bySport).map(([sport, data]) => {
              const total = data.wins + data.losses;
              const winPct = total > 0 ? (data.wins / total) * 100 : 0;
              return (
                <div
                  key={sport}
                  className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl px-6 py-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white text-lg font-semibold">
                      {SPORT_LABELS[sport] || sport}
                    </span>
                    <span
                      className={`text-xl font-bold ${
                        data.profit >= 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {data.profit >= 0 ? "+" : ""}${data.profit.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[var(--text-muted)] text-base">
                      {data.wins}W - {data.losses}L
                    </span>
                    {/* Win rate bar */}
                    <div className="flex-1 bg-[var(--bg-button)] rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          data.profit >= 0 ? "bg-green-500" : "bg-red-500"
                        }`}
                        style={{ width: `${winPct}%` }}
                      />
                    </div>
                    <span className="text-[var(--text-muted)] text-base w-12 text-right">
                      {winPct.toFixed(0)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
  color,
}: {
  label: string;
  value: string;
  detail?: string;
  color?: "green" | "red";
}) {
  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl px-5 py-5">
      <p className="text-[var(--text-muted)] text-base mb-1">{label}</p>
      <p
        className={`text-2xl font-bold ${
          color === "green"
            ? "text-green-400"
            : color === "red"
              ? "text-red-400"
              : "text-white"
        }`}
      >
        {value}
      </p>
      {detail && (
        <p className="text-[var(--text-muted)] text-sm mt-1">{detail}</p>
      )}
    </div>
  );
}
