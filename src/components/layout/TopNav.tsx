"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
    <nav className="hidden md:flex items-center justify-between px-6 h-14 bg-[var(--bg-secondary)] border-b border-[var(--border)]">
      <Link href="/" className="text-lg font-black text-white tracking-wider">
        TULSA <span className="text-[var(--accent-green)]">KING</span>
      </Link>
      <div className="flex gap-5">
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
      <Link
        href="/settings"
        className="text-[var(--text-muted)] hover:text-white text-sm"
      >
        Settings
      </Link>
    </nav>
  );
}
