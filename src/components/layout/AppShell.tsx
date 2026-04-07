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
    <div className="min-h-screen bg-gray-950">
      <TopNav />
      <main className="pb-20 md:pb-0">{children}</main>
      <BottomNav />
      <BetSlip />
    </div>
  );
}
