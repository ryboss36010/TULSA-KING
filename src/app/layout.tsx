import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/layout/AppShell";
import { BetSlipProvider } from "@/components/betslip/BetSlipContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TULSA KING",
  description: "Private P2P Sportsbook",
  manifest: "/manifest.json",
  themeColor: "#0a0e17",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} min-h-full bg-gray-950 text-white antialiased`}>
        <BetSlipProvider>
          <AppShell>{children}</AppShell>
        </BetSlipProvider>
      </body>
    </html>
  );
}
