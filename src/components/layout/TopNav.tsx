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
    <nav className="hidden md:flex items-center justify-between px-6 h-16 bg-gray-900 border-b border-gray-800">
      <Link href="/" className="text-xl font-bold text-white tracking-wider">
        TULSA <span className="text-green-500">KING</span>
      </Link>
      <div className="flex gap-6">
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
                  ? "text-green-500"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
      <Link
        href="/settings"
        className="text-gray-400 hover:text-white text-sm"
      >
        Settings
      </Link>
    </nav>
  );
}
