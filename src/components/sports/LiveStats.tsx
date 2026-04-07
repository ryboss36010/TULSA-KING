"use client";

import { useEffect, useState } from "react";
import { WORKER_URL } from "@/lib/config";
import type { Game } from "@/lib/types";

interface Leader {
  category: string;
  player: string;
  value: string;
}

interface TeamStats {
  team: string;
  score: string;
  linescores: number[];
  leaders: Leader[];
}

interface Situation {
  balls: number;
  strikes: number;
  outs: number;
  onFirst: boolean;
  onSecond: boolean;
  onThird: boolean;
  batter?: string;
  pitcher?: string;
}

interface ESPNLiveData {
  found: boolean;
  status: string;
  detail: string;
  clock: string;
  period: number;
  home: TeamStats;
  away: TeamStats;
  situation?: Situation;
}

export default function LiveStats({ game }: { game: Game }) {
  const [data, setData] = useState<ESPNLiveData | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const params = new URLSearchParams({
          home_team: game.home_team,
          away_team: game.away_team,
        });
        const resp = await fetch(
          `${WORKER_URL}/espn-live/${game.sport}?${params}`
        );
        const json = await resp.json();
        if (json.found) setData(json);
      } catch {
        // Silently fail — stats are supplemental
      }
    }

    fetchStats();
    // Poll every 15s for live games, 60s otherwise
    const interval = game.status === "live" ? 15000 : 60000;
    const timer = setInterval(fetchStats, interval);
    return () => clearInterval(timer);
  }, [game.id, game.sport, game.home_team, game.away_team, game.status]);

  if (!data) return null;

  const isLive =
    data.status === "STATUS_IN_PROGRESS" || data.status === "STATUS_HALFTIME";
  const isFinal = data.status === "STATUS_FINAL";
  const isBaseball = game.sport.startsWith("baseball_");
  const isHockey = game.sport.startsWith("icehockey_");
  const periodLabel = isHockey
    ? "Period"
    : isBaseball
      ? "Inning"
      : "Quarter";

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg overflow-hidden">
      {/* Score header */}
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center justify-between mb-2">
          <span
            className={`text-xs font-bold uppercase ${isLive ? "text-red-500" : isFinal ? "text-[var(--text-muted)]" : "text-[var(--accent-green)]"}`}
          >
            {data.detail || (isLive ? "LIVE" : isFinal ? "FINAL" : "UPCOMING")}
          </span>
          {isLive && data.clock && (
            <span className="text-xs text-[var(--text-secondary)] font-mono">
              {data.clock} - {periodLabel} {data.period}
            </span>
          )}
        </div>

        {/* Period/Quarter scores table */}
        {data.home.linescores.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[var(--text-muted)]">
                  <th className="text-left py-1 pr-4 font-semibold w-32">
                    Team
                  </th>
                  {data.home.linescores.map((_, i) => (
                    <th key={i} className="text-center px-1.5 py-1 font-semibold min-w-[28px]">
                      {i + 1}
                    </th>
                  ))}
                  <th className="text-center px-2 py-1 font-bold">T</th>
                </tr>
              </thead>
              <tbody>
                {[data.away, data.home].map((team) => (
                  <tr key={team.team} className="border-t border-[var(--border)]/30">
                    <td className="text-left py-1.5 pr-4 text-white font-medium truncate max-w-[120px]">
                      {team.team?.split(" ").pop()}
                    </td>
                    {team.linescores.map((score, i) => (
                      <td
                        key={i}
                        className="text-center px-1.5 py-1.5 text-[var(--text-secondary)]"
                      >
                        {score}
                      </td>
                    ))}
                    <td className="text-center px-2 py-1.5 text-white font-bold">
                      {team.score}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Baseball situation */}
      {isBaseball && data.situation && isLive && (
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-6">
          {/* Diamond */}
          <div className="relative w-16 h-16 shrink-0">
            <Diamond
              onFirst={data.situation.onFirst}
              onSecond={data.situation.onSecond}
              onThird={data.situation.onThird}
            />
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-3 text-xs">
              <span className="text-[var(--text-muted)]">Count:</span>
              <span className="text-white font-mono">
                {data.situation.balls}-{data.situation.strikes}
              </span>
              <span className="text-[var(--text-muted)] ml-2">Outs:</span>
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className={`w-2.5 h-2.5 rounded-full ${i < data.situation!.outs ? "bg-red-500" : "bg-[var(--bg-button)]"}`}
                  />
                ))}
              </div>
            </div>
            {data.situation.batter && (
              <p className="text-xs text-[var(--text-secondary)]">
                AB: <span className="text-white">{data.situation.batter}</span>
              </p>
            )}
            {data.situation.pitcher && (
              <p className="text-xs text-[var(--text-secondary)]">
                P: <span className="text-white">{data.situation.pitcher}</span>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Stat leaders */}
      {(data.home.leaders.length > 0 || data.away.leaders.length > 0) && (
        <div className="px-4 py-3">
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase mb-2">
            Leaders
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[data.away, data.home].map((team) => (
              <div key={team.team} className="space-y-2">
                <p className="text-xs font-bold text-white">
                  {team.team?.split(" ").pop()}
                </p>
                {team.leaders.map((leader) => (
                  <div key={leader.category} className="text-xs">
                    <span className="text-[var(--text-muted)] uppercase">
                      {leader.category}
                    </span>
                    <p className="text-[var(--text-secondary)]">
                      <span className="text-white">{leader.player}</span>
                      {" "}
                      <span className="text-[var(--text-muted)]">
                        {leader.value}
                      </span>
                    </p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** SVG baseball diamond showing runners on base */
function Diamond({
  onFirst,
  onSecond,
  onThird,
}: {
  onFirst: boolean;
  onSecond: boolean;
  onThird: boolean;
}) {
  return (
    <svg viewBox="0 0 60 60" className="w-full h-full">
      {/* Diamond outline */}
      <polygon
        points="30,8 52,30 30,52 8,30"
        fill="none"
        stroke="var(--border)"
        strokeWidth="1.5"
      />
      {/* Home plate */}
      <circle cx="30" cy="52" r="3" fill="var(--border)" />
      {/* First base */}
      <rect
        x="47"
        y="25"
        width="8"
        height="8"
        rx="1"
        transform="rotate(45 51 29)"
        fill={onFirst ? "#22c55e" : "var(--bg-button)"}
        stroke="var(--border)"
        strokeWidth="1"
      />
      {/* Second base */}
      <rect
        x="26"
        y="4"
        width="8"
        height="8"
        rx="1"
        transform="rotate(45 30 8)"
        fill={onSecond ? "#22c55e" : "var(--bg-button)"}
        stroke="var(--border)"
        strokeWidth="1"
      />
      {/* Third base */}
      <rect
        x="4"
        y="25"
        width="8"
        height="8"
        rx="1"
        transform="rotate(45 8 29)"
        fill={onThird ? "#22c55e" : "var(--bg-button)"}
        stroke="var(--border)"
        strokeWidth="1"
      />
    </svg>
  );
}
