"use client";

import { getSportIcon, getSportLabel } from "@/lib/types";

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
    <div className="flex gap-1 overflow-x-auto no-scrollbar py-1">
      <button
        onClick={() => onSelect(null)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
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
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
            activeSport === sport
              ? "bg-[var(--accent-green)] text-black"
              : "bg-[var(--bg-button)] text-[var(--text-secondary)] hover:bg-[var(--bg-button-hover)]"
          }`}
        >
          <span>{getSportIcon(sport)}</span>
          <span>{getSportLabel(sport)}</span>
          {gameCounts?.[sport] && (
            <span className="text-[10px] opacity-60">
              {gameCounts[sport]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
