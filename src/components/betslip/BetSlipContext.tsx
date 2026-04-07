"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { Game, Market } from "@/lib/types";
import { isGameBettable } from "@/lib/games";

export interface BetSelection {
  game: Game;
  market: Market;
  pick: string;
  wager: number;
}

export type BetMode = "single" | "parlay";

interface BetSlipContextValue {
  selections: BetSelection[];
  addSelection: (sel: Omit<BetSelection, "wager">) => void;
  removeSelection: (index: number) => void;
  updateWager: (index: number, wager: number) => void;
  clearSlip: () => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  mode: BetMode;
  setMode: (mode: BetMode) => void;
  parlayWager: number;
  setParlayWager: (wager: number) => void;
  toggleSelection: (sel: Omit<BetSelection, "wager">) => void;
  isSelected: (marketId: string, pick: string) => boolean;
}

const BetSlipContext = createContext<BetSlipContextValue | null>(null);

export function BetSlipProvider({ children }: { children: ReactNode }) {
  const [selections, setSelections] = useState<BetSelection[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<BetMode>("single");
  const [parlayWager, setParlayWager] = useState(0);

  function addSelection(sel: Omit<BetSelection, "wager">) {
    // CRITICAL: Never allow betting on past/started games
    if (!isGameBettable(sel.game)) return;

    // Don't add duplicates
    const exists = selections.some(
      (s) => s.market.id === sel.market.id && s.pick === sel.pick
    );
    if (exists) return;

    setSelections((prev) => [...prev, { ...sel, wager: 0 }]);
    setIsOpen(true);

    // Auto-switch to parlay when 2+ selections
    if (selections.length >= 1) {
      setMode("parlay");
    }
  }

  function toggleSelection(sel: Omit<BetSelection, "wager">) {
    const idx = selections.findIndex(
      (s) => s.market.id === sel.market.id && s.pick === sel.pick
    );
    if (idx >= 0) {
      removeSelection(idx);
    } else {
      addSelection(sel);
    }
  }

  function isSelected(marketId: string, pick: string): boolean {
    return selections.some(
      (s) => s.market.id === marketId && s.pick === pick
    );
  }

  function removeSelection(index: number) {
    setSelections((prev) => {
      const next = prev.filter((_, i) => i !== index);
      // Auto-switch back to single if only 1 selection left
      if (next.length <= 1) setMode("single");
      if (next.length === 0) setIsOpen(false);
      return next;
    });
  }

  function updateWager(index: number, wager: number) {
    setSelections((prev) =>
      prev.map((s, i) => (i === index ? { ...s, wager } : s))
    );
  }

  function clearSlip() {
    setSelections([]);
    setIsOpen(false);
    setMode("single");
    setParlayWager(0);
  }

  return (
    <BetSlipContext.Provider
      value={{
        selections,
        addSelection,
        removeSelection,
        updateWager,
        clearSlip,
        isOpen,
        setIsOpen,
        mode,
        setMode,
        parlayWager,
        setParlayWager,
        toggleSelection,
        isSelected,
      }}
    >
      {children}
    </BetSlipContext.Provider>
  );
}

export function useBetSlip() {
  const ctx = useContext(BetSlipContext);
  if (!ctx) throw new Error("useBetSlip must be used within BetSlipProvider");
  return ctx;
}
