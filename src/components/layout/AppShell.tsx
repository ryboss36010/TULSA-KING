"use client";

import { usePathname } from "next/navigation";
import TopNav from "./TopNav";
import BottomNav from "./BottomNav";
import BetSlip from "@/components/betslip/BetSlip";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  if (isLogin) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <TopNav />
      <main className="pb-16 md:pb-0 md:pt-0">{children}</main>
      <BottomNav />
      <BetSlip />
    </div>
  );
}
