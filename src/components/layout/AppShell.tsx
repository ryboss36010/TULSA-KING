"use client";

import { usePathname } from "next/navigation";
import TopNav from "./TopNav";
import BottomNav from "./BottomNav";
import Sidebar from "./Sidebar";
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
      <div className="flex">
        <Sidebar />
        <main className="flex-1 min-w-0 pb-16 md:pb-0">{children}</main>
      </div>
      <BottomNav />
      <BetSlip />
    </div>
  );
}
