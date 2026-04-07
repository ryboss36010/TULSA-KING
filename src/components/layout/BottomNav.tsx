"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/live", label: "Live", icon: "🔴" },
  { href: "/sports", label: "Sports", icon: "🏈" },
  { href: "/my-bets", label: "Bets", icon: "🎫" },
  { href: "/dashboard", label: "Stats", icon: "📊" },
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
              <span className="text-base">{tab.icon}</span>
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
