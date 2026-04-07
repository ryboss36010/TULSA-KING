"use client";

import { formatOdds } from "@/lib/odds";

interface OddsCellProps {
  label?: string;
  odds: number;
  isSelected?: boolean;
  onClick: () => void;
}

export default function OddsCell({
  label,
  odds,
  isSelected,
  onClick,
}: OddsCellProps) {
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className={`flex flex-col items-center justify-center rounded-sm px-1 py-1.5 min-w-0 transition-colors ${
        isSelected
          ? "bg-[var(--accent-green)] text-black"
          : "bg-[var(--bg-button)] text-[var(--text-secondary)] hover:bg-[var(--bg-button-hover)]"
      }`}
    >
      {label && (
        <span className={`text-[10px] leading-tight ${isSelected ? "text-black/70" : "text-[var(--text-muted)]"}`}>
          {label}
        </span>
      )}
      <span className={`text-xs font-semibold leading-tight ${isSelected ? "text-black" : "text-white"}`}>
        {formatOdds(odds)}
      </span>
    </button>
  );
}
