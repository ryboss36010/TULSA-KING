"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { OddsApiSport } from "@/lib/types";
import { isOutrightSport } from "@/lib/types";
import SportIcon from "@/components/icons/SportIcon";
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

  const activeSports = sports.filter((s) => s.active);

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
        <div className="text-[var(--text-muted)] animate-pulse">Loading sports...</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">Sports</h1>
      <EventSearch />

      {Object.entries(groupedActive)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([group, groupSports]) => (
          <section key={group} className="space-y-3">
            <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase">
              {group}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {groupSports.map((sport) => (
                <Link
                  key={sport.key}
                  href={`/sports/${sport.key}`}
                  className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-4 hover:border-[var(--text-muted)] transition flex items-center gap-3"
                >
                  <SportIcon sport={sport.key} className="w-6 h-6 text-[var(--text-secondary)]" />
                  <div className="flex-1 min-w-0">
                    <span className="text-white font-medium text-sm block truncate">
                      {sport.title}
                    </span>
                    {isOutrightSport(sport.key) && (
                      <span className="text-[var(--accent-green)] text-xs">Futures</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}

      {activeSports.length === 0 && (
        <p className="text-[var(--text-muted)] text-center py-8">
          No active sports available.
        </p>
      )}
    </div>
  );
}
