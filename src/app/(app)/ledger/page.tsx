"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, LedgerEntry, NetBalance } from "@/lib/types";

export default function LedgerPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [ledger, setLedger] = useState<(LedgerEntry & { from: Profile; to: Profile })[]>([]);
  const [netBalances, setNetBalances] = useState<NetBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("*");
      if (profilesData) setProfiles(profilesData);

      const { data: ledgerData } = await supabase
        .from("ledger")
        .select(
          "*, from:profiles!ledger_from_user_id_fkey(*), to:profiles!ledger_to_user_id_fkey(*)"
        )
        .order("created_at", { ascending: false });
      if (ledgerData)
        setLedger(ledgerData as unknown as (LedgerEntry & { from: Profile; to: Profile })[]);

      const { data: balances } = await supabase
        .from("net_balances")
        .select("*");
      if (balances) setNetBalances(balances as NetBalance[]);

      setLoading(false);
    }

    load();
  }, []);

  function getNetOwed(fromId: string, toId: string): number {
    const fromTo =
      netBalances.find(
        (b) => b.from_user_id === fromId && b.to_user_id === toId
      )?.total_owed || 0;
    const toFrom =
      netBalances.find(
        (b) => b.from_user_id === toId && b.to_user_id === fromId
      )?.total_owed || 0;
    return Number(fromTo) - Number(toFrom);
  }

  function exportCSV() {
    const rows = [
      ["Date", "From", "To", "Amount", "Type", "Bet ID"],
      ...ledger.map((entry) => [
        new Date(entry.created_at).toISOString(),
        entry.from.display_name,
        entry.to.display_name,
        Number(entry.amount).toFixed(2),
        entry.type,
        entry.bet_id || "",
      ]),
    ];

    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tulsa-king-ledger-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 animate-pulse">Loading ledger...</div>
      </div>
    );
  }

  const pairs: { a: Profile; b: Profile; net: number }[] = [];
  for (let i = 0; i < profiles.length; i++) {
    for (let j = i + 1; j < profiles.length; j++) {
      const net = getNetOwed(profiles[i].id, profiles[j].id);
      pairs.push({ a: profiles[i], b: profiles[j], net });
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Ledger</h1>
        <button
          onClick={exportCSV}
          className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm hover:bg-gray-700 transition"
        >
          Export CSV
        </button>
      </div>

      {/* Net balances */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">Who Owes Who</h2>
        <div className="space-y-2">
          {pairs.map(({ a, b, net }) => {
            if (Math.abs(net) < 0.01) {
              return (
                <div
                  key={`${a.id}-${b.id}`}
                  className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-gray-400 text-sm text-center"
                >
                  {a.display_name} and {b.display_name} are even
                </div>
              );
            }

            const owes = net > 0 ? a : b;
            const owed = net > 0 ? b : a;

            return (
              <div
                key={`${a.id}-${b.id}`}
                className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex justify-between items-center"
              >
                <span className="text-white text-sm">
                  <span className="text-red-400 font-medium">
                    {owes.display_name}
                  </span>{" "}
                  owes{" "}
                  <span className="text-green-400 font-medium">
                    {owed.display_name}
                  </span>
                </span>
                <span className="text-white font-bold">
                  ${Math.abs(net).toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Transaction history */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">Transaction History</h2>
        <div className="space-y-2">
          {ledger.map((entry) => (
            <div
              key={entry.id}
              className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex justify-between items-center"
            >
              <div>
                <p className="text-white text-sm">
                  {entry.from.display_name} → {entry.to.display_name}
                </p>
                <p className="text-gray-500 text-xs">
                  {new Date(entry.created_at).toLocaleString()} ·{" "}
                  {entry.type.replace("_", " ")}
                </p>
              </div>
              <span className="text-white font-bold">
                ${Number(entry.amount).toFixed(2)}
              </span>
            </div>
          ))}
          {ledger.length === 0 && (
            <p className="text-gray-500 text-center py-8">
              No transactions yet
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
