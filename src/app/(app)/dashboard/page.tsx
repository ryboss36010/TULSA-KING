"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { SPORT_LABELS } from "@/lib/types";

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

export default function DashboardPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [allBets, setAllBets] = useState<any[]>([]);
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

      if (betsData) setAllBets(betsData);
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
      (sum: number, b: any) => sum + Number(b.wager_amount),
      0
    );

    let totalProfit = 0;
    let biggestWin = 0;
    for (const bet of userBets) {
      if (bet.result === "win") {
        const profit =
          bet.wager_amount *
          (bet.odds_at_placement > 0
            ? bet.odds_at_placement / 100
            : 100 / Math.abs(bet.odds_at_placement));
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
        streakType = bet.result as "win" | "loss";
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
        bySport[sport].profit +=
          bet.wager_amount *
          (bet.odds_at_placement > 0
            ? bet.odds_at_placement / 100
            : 100 / Math.abs(bet.odds_at_placement));
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
        <div className="text-gray-400 animate-pulse">Loading stats...</div>
      </div>
    );
  }

  const leaderboard = profiles
    .map((p) => ({ profile: p, stats: calculateStats(p.id) }))
    .sort((a, b) => b.stats.totalProfit - a.stats.totalProfit);

  const myStats = calculateStats(userId);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
      <h1 className="text-2xl font-bold text-white">Dashboard</h1>

      {/* Leaderboard */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">Leaderboard</h2>
        <div className="space-y-2">
          {leaderboard.map((entry, i) => (
            <div
              key={entry.profile.id}
              className={`flex items-center justify-between bg-gray-900 border rounded-xl px-4 py-3 ${
                entry.profile.id === userId
                  ? "border-green-500"
                  : "border-gray-800"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-gray-500">
                  #{i + 1}
                </span>
                <span className="text-white font-medium">
                  {entry.profile.display_name}
                </span>
              </div>
              <div className="text-right">
                <p
                  className={`font-bold ${
                    entry.stats.totalProfit >= 0
                      ? "text-green-400"
                      : "text-red-400"
                  }`}
                >
                  {entry.stats.totalProfit >= 0 ? "+" : ""}$
                  {entry.stats.totalProfit.toFixed(2)}
                </p>
                <p className="text-gray-400 text-xs">
                  {entry.stats.wins}W - {entry.stats.losses}L
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Your Stats */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">Your Stats</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Record"
            value={`${myStats.wins}W - ${myStats.losses}L - ${myStats.pushes}P`}
          />
          <StatCard label="Win Rate" value={`${myStats.winRate.toFixed(1)}%`} />
          <StatCard
            label="Profit/Loss"
            value={`${myStats.totalProfit >= 0 ? "+" : ""}$${myStats.totalProfit.toFixed(2)}`}
            color={myStats.totalProfit >= 0 ? "green" : "red"}
          />
          <StatCard
            label="ROI"
            value={`${myStats.roi.toFixed(1)}%`}
            color={myStats.roi >= 0 ? "green" : "red"}
          />
          <StatCard
            label="Total Wagered"
            value={`$${myStats.totalWagered.toFixed(2)}`}
          />
          <StatCard
            label="Biggest Win"
            value={`$${myStats.biggestWin.toFixed(2)}`}
            color="green"
          />
          <StatCard
            label="Streak"
            value={`${myStats.currentStreak.count} ${myStats.currentStreak.type === "win" ? "W" : "L"}`}
            color={myStats.currentStreak.type === "win" ? "green" : "red"}
          />
          <StatCard label="Total Bets" value={`${myStats.totalBets}`} />
        </div>
      </section>

      {/* Sport Breakdown */}
      {Object.keys(myStats.bySport).length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">By Sport</h2>
          <div className="space-y-2">
            {Object.entries(myStats.bySport).map(([sport, data]) => (
              <div
                key={sport}
                className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-4 py-3"
              >
                <span className="text-white text-sm">
                  {SPORT_LABELS[sport] || sport}
                </span>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-400">
                    {data.wins}W - {data.losses}L
                  </span>
                  <span
                    className={`font-bold ${
                      data.profit >= 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {data.profit >= 0 ? "+" : ""}${data.profit.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: "green" | "red";
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
      <p className="text-gray-400 text-xs">{label}</p>
      <p
        className={`text-lg font-bold ${
          color === "green"
            ? "text-green-400"
            : color === "red"
              ? "text-red-400"
              : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
