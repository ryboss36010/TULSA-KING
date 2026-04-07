"use client";

import Link from "next/link";
import { SPORT_LABELS } from "@/lib/types";

const sportIcons: Record<string, string> = {
  americanfootball_nfl: "🏈",
  americanfootball_ncaaf: "🏈",
  basketball_nba: "🏀",
  basketball_ncaab: "🏀",
  baseball_mlb: "⚾",
  icehockey_nhl: "🏒",
  soccer_usa_mls: "⚽",
  soccer_epl: "⚽",
  golf_pga: "⛳",
  tennis_atp: "🎾",
  mma_mixed_martial_arts: "🥊",
};

export default function SportsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">Sports</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {Object.entries(SPORT_LABELS).map(([key, label]) => (
          <Link
            key={key}
            href={`/sports/${key}`}
            className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-600 transition flex items-center gap-3"
          >
            <span className="text-2xl">{sportIcons[key] || "🏅"}</span>
            <span className="text-white font-medium text-sm">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
