"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { OddsApiSport } from "@/lib/types";
import { getSportIcon, isOutrightSport } from "@/lib/types";
import EventSearch from "@/components/search/EventSearch";

const WORKER_URL = "https://tulsa-king-odds.ryboss36010.workers.dev";

export default function SportsPage() {
  const [sports, setSports] = useState<OddsApiSport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const resp = await fetch(`${WORKER_URL}/all-sports`);
        const data: OddsApiSport[] = await resp.json();
        if (Array.isArray(data)) {
          setSports(data);
        }
      } catch (e) {
        console.error("Failed to load sports:", e);
      }
      setLoading(false);
    }
    load();
  }, []);

  // Group sports by their group (e.g., "American Football", "Basketball", etc.)
  const activeSports = sports.filter((s) => s.active);
  const inactiveSports = sports.filter((s) => !s.active);

  const groupedActive = activeSports.reduce(
    (acc, sport) => {
      if (!acc[sport.group]) acc[sport.group] = [];
      acc[sport.group].push(sport);
      return acc;
    },
    {} as Record<string, OddsApiSport[]>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 animate-pulse">Loading sports...</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">Sports</h1>
      <EventSearch />

      {/* Active sports grouped by category */}
      {Object.entries(groupedActive)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([group, groupSports]) => (
          <section key={group} className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-400 uppercase">
              {group}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {groupSports.map((sport) => (
                <Link
                  key={sport.key}
                  href={`/sports/${sport.key}`}
                  className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-600 transition flex items-center gap-3"
                >
                  <span className="text-2xl">{getSportIcon(sport.key)}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-white font-medium text-sm block truncate">
                      {sport.title}
                    </span>
                    {isOutrightSport(sport.key) && (
                      <span className="text-green-500 text-xs">Futures</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}

      {activeSports.length === 0 && (
        <p className="text-gray-500 text-center py-8">
          No active sports available.
        </p>
      )}
    </div>
  );
}
