"use client";

import { formatOdds } from "@/lib/odds";

interface OddsButtonProps {
  label: string;
  odds: number;
  isSelected?: boolean;
  onClick: () => void;
}

export default function OddsButton({
  label,
  odds,
  isSelected,
  onClick,
}: OddsButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center px-4 py-2 rounded-lg border transition-colors min-w-[70px] ${
        isSelected
          ? "bg-green-600 border-green-500 text-white"
          : "bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500 active:bg-gray-700"
      }`}
    >
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-sm font-bold">{formatOdds(odds)}</span>
    </button>
  );
}
