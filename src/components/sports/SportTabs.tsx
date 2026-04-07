"use client";

import { getSportLabel } from "@/lib/types";
import SportIcon from "@/components/icons/SportIcon";

interface SportTabsProps {
  sports: string[];
  activeSport: string | null;
  onSelect: (sport: string | null) => void;
  gameCounts?: Record<string, number>;
}

export default function SportTabs({
  sports,
  activeSport,
  onSelect,
  gameCounts,
}: SportTabsProps) {
  if (sports.length === 0) return null;

  return (
    <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-1">
      <button
        onClick={() => onSelect(null)}
        className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
          activeSport === null
            ? "bg-[var(--accent-green)] text-black"
            : "bg-[var(--bg-button)] text-[var(--text-secondary)] hover:bg-[var(--bg-button-hover)]"
        }`}
      >
        All
      </button>
      {sports.map((sport) => (
        <button
          key={sport}
          onClick={() => onSelect(sport)}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            activeSport === sport
              ? "bg-[var(--accent-green)] text-black"
              : "bg-[var(--bg-button)] text-[var(--text-secondary)] hover:bg-[var(--bg-button-hover)]"
          }`}
        >
          <SportIcon
            sport={sport}
            className={`w-4 h-4 ${activeSport === sport ? "text-black" : ""}`}
          />
          <span>{getSportLabel(sport)}</span>
          {gameCounts?.[sport] && (
            <span className="text-xs opacity-60">
              {gameCounts[sport]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
