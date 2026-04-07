"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { Game, Market } from "@/lib/types";

export interface BetSelection {
  game: Game;
  market: Market;
  pick: string;
  wager: number;
}

interface BetSlipContextValue {
  selections: BetSelection[];
  addSelection: (sel: Omit<BetSelection, "wager">) => void;
  removeSelection: (index: number) => void;
  updateWager: (index: number, wager: number) => void;
  clearSlip: () => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const BetSlipContext = createContext<BetSlipContextValue | null>(null);

export function BetSlipProvider({ children }: { children: ReactNode }) {
  const [selections, setSelections] = useState<BetSelection[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  function addSelection(sel: Omit<BetSelection, "wager">) {
    setSelections((prev) => [...prev, { ...sel, wager: 0 }]);
    setIsOpen(true);
  }

  function removeSelection(index: number) {
    setSelections((prev) => prev.filter((_, i) => i !== index));
  }

  function updateWager(index: number, wager: number) {
    setSelections((prev) =>
      prev.map((s, i) => (i === index ? { ...s, wager } : s))
    );
  }

  function clearSlip() {
    setSelections([]);
    setIsOpen(false);
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
