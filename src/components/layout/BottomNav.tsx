"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SportIcon from "@/components/icons/SportIcon";
import { HomeIcon, LiveIcon, TicketIcon, ChartIcon } from "@/components/icons/NavIcons";

type Tab =
  | { href: string; label: string; Icon: React.FC<{ className?: string }>; IconComponent?: false }
  | { href: string; label: string; Icon?: undefined; IconComponent: true };

const tabs: Tab[] = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/live", label: "Live", Icon: LiveIcon },
  { href: "/sports", label: "Sports", IconComponent: true },
  { href: "/my-bets", label: "Bets", Icon: TicketIcon },
  { href: "/dashboard", label: "Stats", Icon: ChartIcon },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-secondary)] border-t border-[var(--border)] md:hidden">
      <div className="flex justify-around items-center h-14">
        {tabs.map((tab) => {
          const isActive =
            tab.href === "/"
              ? pathname === "/"
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 text-[10px] ${
                isActive ? "text-[var(--accent-green)]" : "text-[var(--text-muted)]"
              }`}
            >
              {tab.IconComponent ? (
                <SportIcon sport="americanfootball_nfl" className="w-5 h-5" />
              ) : (
                <tab.Icon className="w-5 h-5" />
              )}
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
