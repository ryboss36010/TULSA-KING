"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import EventSearch from "@/components/search/EventSearch";

const links = [
  { href: "/", label: "Home" },
  { href: "/live", label: "Live" },
  { href: "/sports", label: "Sports" },
  { href: "/my-bets", label: "My Bets" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/ledger", label: "Ledger" },
];

export default function TopNav() {
  const pathname = usePathname();

  return (
    <nav className="hidden md:flex items-center gap-4 px-4 h-14 bg-[var(--bg-secondary)] border-b border-[var(--border)] sticky top-0 z-40">
      <Link
        href="/"
        className="text-lg font-black text-white tracking-wider shrink-0"
      >
        TULSA <span className="text-[var(--accent-green)]">KING</span>
      </Link>

      {/* Desktop nav links (hidden when sidebar is visible) */}
      <div className="hidden md:flex lg:hidden gap-4 ml-4">
        {links.map((link) => {
          const isActive =
            link.href === "/"
              ? pathname === "/"
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition ${
                isActive
                  ? "text-white"
                  : "text-[var(--text-muted)] hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>

      {/* Search bar - centered */}
      <div className="flex-1 max-w-md mx-auto">
        <EventSearch />
      </div>

      <Link
        href="/settings"
        className="text-[var(--text-muted)] hover:text-white text-sm shrink-0"
      >
        Settings
      </Link>
    </nav>
  );
}
